import Phaser from 'phaser';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SOCKET_EVENTS,
  type RoundState,
  type ArenaLiveEvent,
  type GameSnapshot,
  type BallState,
  type CombatEvent,
  type PlayerStats,
  type WinnerInfo,
} from '@arena/shared';

interface BallView {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  initials: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  revengeMark: Phaser.GameObjects.Text;
  crown: Phaser.GameObjects.Text;
  lastHp: number;
}

interface FeedItem {
  text: Phaser.GameObjects.Text;
  born: number;
}

export class ArenaScene extends Phaser.Scene {
  private timerText!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private top5Text!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private bigCountdown!: Phaser.GameObjects.Text;
  private winnerPanel!: Phaser.GameObjects.Container;
  private winnerTitle!: Phaser.GameObjects.Text;
  private winnerBody!: Phaser.GameObjects.Text;
  private resultsHint!: Phaser.GameObjects.Text;
  private border!: Phaser.GameObjects.Rectangle;
  private feed: string[] = [];
  private ballsLayer!: Phaser.GameObjects.Container;
  private killFeedLayer!: Phaser.GameObjects.Container;
  private views = new Map<string, BallView>();
  private pendingAvatars = new Set<string>();
  private killFeed: FeedItem[] = [];
  private readonly killFeedTtl = 5000;
  private toastUntil = 0;
  private intensity = false;
  private lastRemaining = 300;

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0e18);
    this.border = this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 16, 0x10162a, 0.35)
      .setStrokeStyle(6, 0xfe2c55);

    this.add
      .text(CANVAS_WIDTH / 2, 48, 'BALL ARENA', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '44px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.timerText = this.add
      .text(CANVAS_WIDTH / 2, 110, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#20d68a',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.playersText = this.add
      .text(CANVAS_WIDTH / 2, 165, `Vivos: ${data?.round?.playerCount ?? 0}`, {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Permanent TOP 5
    this.top5Text = this.add
      .text(36, 210, 'TOP 5\n—', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#e8eaed',
        lineSpacing: 6,
      })
      .setDepth(100);

    this.toastText = this.add
      .text(CANVAS_WIDTH / 2, 250, '', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '30px',
        color: '#ffd60a',
        backgroundColor: '#000000cc',
        padding: { x: 16, y: 10 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.bigCountdown = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '220px',
        color: '#fe2c55',
      })
      .setOrigin(0.5)
      .setDepth(250)
      .setAlpha(0);

    this.ballsLayer = this.add.container(0, 0).setDepth(10);
    this.killFeedLayer = this.add.container(0, 0).setDepth(200);

    this.feedText = this.add
      .text(40, CANVAS_HEIGHT - 200, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#999999',
        wordWrap: { width: CANVAS_WIDTH - 80 },
      })
      .setDepth(100);

    // Winner panel (hidden)
    this.winnerPanel = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).setDepth(400).setAlpha(0);
    const panelBg = this.add.rectangle(0, 0, 820, 620, 0x0d1117, 0.94).setStrokeStyle(4, 0xffd60a);
    this.winnerTitle = this.add
      .text(0, -240, '🏆 VENCEDOR', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '48px',
        color: '#ffd60a',
      })
      .setOrigin(0.5);
    this.winnerBody = this.add
      .text(0, -40, '', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12,
      })
      .setOrigin(0.5);
    this.resultsHint = this.add
      .text(0, 240, 'Próxima rodada em …', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#25f4ee',
      })
      .setOrigin(0.5);
    this.winnerPanel.add([panelBg, this.winnerTitle, this.winnerBody, this.resultsHint]);

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.game.events.on(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    this.game.events.on(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
    this.game.events.on(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.game.events.off(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
      this.game.events.off(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
      this.game.events.off(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);
      this.views.clear();
    });
  }

  update(): void {
    const now = Date.now();
    this.killFeed = this.killFeed.filter((item) => {
      const age = now - item.born;
      if (age > this.killFeedTtl) {
        item.text.destroy();
        return false;
      }
      const fade = age > this.killFeedTtl - 800 ? 1 - (age - (this.killFeedTtl - 800)) / 800 : 1;
      item.text.setAlpha(fade);
      return true;
    });
    this.layoutKillFeed();

    if (this.toastUntil && now > this.toastUntil) {
      this.toastText.setAlpha(0);
      this.toastUntil = 0;
    }

    if (this.intensity) {
      const pulse = 0.5 + Math.sin(now / 120) * 0.5;
      this.border.setStrokeStyle(6 + pulse * 4, 0xfe2c55);
    }
  }

  private onRound = (state: RoundState) => {
    this.applyTimerVisuals(state.remainingSec, state.phase);
    this.playersText.setText(`Vivos: ${state.playerCount ?? 0}`);
    if (state.phase === 'results') {
      this.resultsHint.setText(`Próxima rodada em ${state.resultsRemainingSec ?? 0}s`);
    }
  };

  private onLive = (event: ArenaLiveEvent) => {
    let line = `${event.type}`;
    if (event.type === 'gift') line = `🎁 ${event.user.username} → ${event.giftName}`;
    else if (event.type === 'comment') line = `💬 ${event.user.username}: ${event.comment}`;
    else if (event.type === 'join') line = `👋 ${event.user.username}`;
    this.feed.unshift(line);
    this.feed = this.feed.slice(0, 5);
    this.feedText.setText(this.feed.join('\n'));
  };

  private onSnapshot = (snap: GameSnapshot) => {
    this.applyTimerVisuals(snap.remainingSec, snap.phase);
    this.playersText.setText(`Vivos: ${snap.playerCount}`);
    this.syncBalls(snap.balls);
    this.renderTop5(snap.top5 || snap.stats.slice(0, 5));

    if (snap.phase === 'results') {
      this.showWinner(snap.winner, snap.resultsRemainingSec ?? 0, snap.top5);
    } else {
      this.hideWinner();
    }
  };

  private onCombat = (event: CombatEvent) => {
    if (event.type === 'hit') {
      this.spawnHitSparks(event.x, event.y, 0xffffff);
    } else if (event.type === 'kill') {
      const revenge = !!event.isRevenge;
      this.pushKillFeed(event.message, revenge ? '#ffd60a' : '#ffffff', revenge ? '#8b0000cc' : '#fe2c55cc');
      this.spawnHitSparks(event.x, event.y, revenge ? 0xffd60a : 0xfe2c55, 18);
      this.spawnDeathFlash(event.x, event.y);
      if (revenge) this.showToast(event.message);
    } else if (event.type === 'announce') {
      if (event.kind === 'countdown' && event.value != null) {
        this.showBigCountdown(event.value);
      } else if (event.kind === 'last_minute') {
        this.showToast('ÚLTIMO MINUTO!');
        this.pushKillFeed(event.message, '#fe2c55', '#000000aa');
      } else if (event.kind === 'new_king') {
        this.showToast(event.message);
        this.pushKillFeed(event.message, '#ffd60a', '#3d2a00cc');
      } else if (event.kind === 'winner' || event.kind === 'next_round') {
        this.showToast(event.message);
        this.pushKillFeed(event.message, '#ffd60a', '#000000aa');
      } else {
        this.pushKillFeed(event.message, '#ffd60a', '#000000aa');
        if (event.kind === 'respawn' || event.kind === 'revenge_respawn' || event.kind === 'eliminated') {
          this.showToast(event.message);
        }
      }
    }
  };

  private applyTimerVisuals(remaining: number, phase: string): void {
    this.timerText.setText(this.formatTime(remaining));
    if (phase === 'results') {
      this.timerText.setColor('#ffd60a');
      this.timerText.setText('FIM');
      this.intensity = false;
      return;
    }
    if (remaining <= 30) {
      this.intensity = true;
      this.timerText.setColor('#fe2c55');
      this.timerText.setFontSize(remaining <= 10 ? '72px' : '60px');
    } else if (remaining <= 60) {
      this.intensity = false;
      this.timerText.setColor('#ffd60a');
      this.timerText.setFontSize('56px');
    } else {
      this.intensity = false;
      this.timerText.setColor('#20d68a');
      this.timerText.setFontSize('56px');
      this.border.setStrokeStyle(6, 0xfe2c55);
    }
    this.lastRemaining = remaining;
  }

  private showBigCountdown(n: number): void {
    this.bigCountdown.setText(String(n));
    this.bigCountdown.setAlpha(1).setScale(0.4);
    this.tweens.add({
      targets: this.bigCountdown,
      scale: 1.2,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.easeOut',
    });
  }

  private renderTop5(top5: PlayerStats[]): void {
    if (!top5.length) {
      this.top5Text.setText('TOP 5\n— aguardando —');
      return;
    }
    const lines = ['TOP 5'];
    top5.forEach((s, i) => {
      const crown = i === 0 ? '👑 ' : `${i + 1}. `;
      lines.push(`${crown}${s.username.slice(0, 12)}`);
      lines.push(`   ☠${s.kills}  💀${s.deaths}`);
    });
    this.top5Text.setText(lines.join('\n'));
  }

  private showWinner(winner: WinnerInfo | null, resultsLeft: number, top5: PlayerStats[]): void {
    this.winnerPanel.setAlpha(1);
    if (winner) {
      this.winnerTitle.setText('🏆 VENCEDOR');
      this.winnerBody.setText(
        [
          `@${winner.nickname || winner.username}`,
          '',
          `☠ Kills: ${winner.kills}`,
          `💀 Deaths: ${winner.deaths}`,
          `💥 Dano: ${winner.damageDealt}`,
          `⚡ Vel. máx: ${Math.round(winner.highestSpeed)}`,
          '',
          '— Ranking final —',
          ...top5.slice(0, 5).map((s, i) => `#${i + 1} ${s.username} ☠${s.kills} 💀${s.deaths}`),
        ].join('\n')
      );
    } else {
      this.winnerTitle.setText('FIM DA RODADA');
      this.winnerBody.setText('Nenhum vencedor');
    }
    this.resultsHint.setText(`Próxima rodada em ${resultsLeft}s`);
  }

  private hideWinner(): void {
    this.winnerPanel.setAlpha(0);
  }

  private showToast(msg: string): void {
    this.toastText.setText(msg);
    this.toastText.setAlpha(1);
    this.toastUntil = Date.now() + 3200;
  }

  private pushKillFeed(message: string, color = '#ffffff', bg = '#fe2c55cc'): void {
    const text = this.add
      .text(CANVAS_WIDTH - 40, 260, message, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color,
        backgroundColor: bg,
        padding: { x: 12, y: 8 },
        wordWrap: { width: 520 },
      })
      .setOrigin(1, 0);
    this.killFeedLayer.add(text);
    this.killFeed.unshift({ text, born: Date.now() });
    this.killFeed = this.killFeed.slice(0, 7);
    this.layoutKillFeed();
  }

  private layoutKillFeed(): void {
    let y = 260;
    for (const item of this.killFeed) {
      item.text.setPosition(CANVAS_WIDTH - 40, y);
      y += item.text.height + 8;
    }
  }

  private spawnHitSparks(x: number, y: number, color: number, n = 8): void {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const dist = 20 + Math.random() * 40;
      const dot = this.add.circle(x, y, 4 + Math.random() * 4, color, 1).setDepth(50);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 280 + Math.random() * 200,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private spawnDeathFlash(x: number, y: number): void {
    const ring = this.add.circle(x, y, 10, 0xfe2c55, 0.6).setDepth(60);
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });
  }

  private syncBalls(balls: BallState[]): void {
    const seen = new Set<string>();
    for (const b of balls) {
      seen.add(b.id);
      let view = this.views.get(b.id);
      if (!view) {
        view = this.createBallView(b);
        this.views.set(b.id, view);
        this.ballsLayer.add(view.container);
      }
      this.updateBallView(view, b);
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.container.destroy(true);
        this.views.delete(id);
      }
    }
  }

  private createBallView(b: BallState): BallView {
    const container = this.add.container(b.x, b.y);
    const circle = this.add.circle(0, 0, b.radius, b.color, 1);
    circle.setStrokeStyle(3, 0xffffff, 0.85);

    const initials = this.add
      .text(0, 0, this.getInitials(b.label), {
        fontFamily: 'Arial Black, Arial',
        fontSize: `${Math.floor(b.radius * 0.7)}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const label = this.add
      .text(0, b.radius + 14, this.truncate(b.label, 14), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0);

    const barW = b.radius * 2;
    const hpBg = this.add.rectangle(0, -b.radius - 12, barW, 8, 0x333333).setOrigin(0.5);
    const hpFg = this.add.rectangle(-barW / 2, -b.radius - 12, barW, 8, 0x20d68a).setOrigin(0, 0.5);

    const revengeMark = this.add
      .text(b.radius * 0.6, -b.radius - 8, '🎯', { fontSize: '26px' })
      .setOrigin(0.5)
      .setVisible(false);

    const crown = this.add
      .text(0, -b.radius - 30, '👑', { fontSize: '32px' })
      .setOrigin(0.5)
      .setVisible(false);

    container.add([circle, initials, hpBg, hpFg, label, revengeMark, crown]);
    if (b.avatarUrl) this.tryLoadAvatar(b, circle, initials, container);

    return { container, circle, initials, label, hpBg, hpFg, revengeMark, crown, lastHp: b.hp };
  }

  private updateBallView(view: BallView, b: BallState): void {
    view.container.setPosition(b.x, b.y);
    view.circle.setRadius(b.radius);

    const protected_ = !!b.spawnProtected;
    const flash = !!b.hitFlash;
    view.circle.setFillStyle(flash ? 0xffffff : b.color, protected_ ? 0.35 : flash ? 0.9 : 1);
    view.circle.setStrokeStyle(
      b.isKing ? 5 : 3,
      b.isKing ? 0xffd60a : protected_ ? 0x25f4ee : flash ? 0xfe2c55 : 0xffffff,
      protected_ ? 0.5 : 0.9
    );
    view.container.setAlpha(protected_ ? 0.55 : 1);

    view.revengeMark.setVisible(!!b.revengeMarked);
    view.crown.setVisible(!!b.isKing);
    view.crown.setY(-b.radius - 30);

    view.label.setText(this.truncate(b.label, 14));
    view.label.setY(b.radius + 14);
    const barW = b.radius * 2;
    view.hpBg.setPosition(0, -b.radius - 12);
    view.hpBg.setSize(barW, 8);
    const ratio = b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 0;
    view.hpFg.setPosition(-barW / 2, -b.radius - 12);
    view.hpFg.setSize(barW * ratio, 8);
    view.hpFg.setFillStyle(ratio > 0.3 ? 0x20d68a : 0xfe2c55);

    if (b.hp < view.lastHp) {
      this.tweens.add({
        targets: view.container,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 60,
        yoyo: true,
      });
    }
    view.lastHp = b.hp;
  }

  private tryLoadAvatar(
    b: BallState,
    circle: Phaser.GameObjects.Arc,
    initials: Phaser.GameObjects.Text,
    container: Phaser.GameObjects.Container
  ): void {
    if (!b.avatarUrl || this.pendingAvatars.has(b.id)) return;
    this.pendingAvatars.add(b.id);
    const key = `avatar-${b.id}`;
    if (this.textures.exists(key)) {
      this.applyAvatar(key, b.radius, circle, initials, container);
      return;
    }
    this.load.image(key, b.avatarUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.textures.exists(key)) return;
      this.applyAvatar(key, b.radius, circle, initials, container);
    });
    this.load.start();
  }

  private applyAvatar(
    key: string,
    radius: number,
    circle: Phaser.GameObjects.Arc,
    initials: Phaser.GameObjects.Text,
    container: Phaser.GameObjects.Container
  ): void {
    initials.setVisible(false);
    const img = this.add.image(0, 0, key);
    img.setDisplaySize(radius * 1.7, radius * 1.7);
    container.addAt(img, 1);
    circle.setFillStyle(circle.fillColor, 0.25);
  }

  private getInitials(label: string): string {
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return label.slice(0, 2).toUpperCase() || '?';
  }

  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  private formatTime(sec: number): string {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.floor(Math.max(0, sec) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
