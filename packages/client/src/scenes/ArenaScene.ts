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
} from '@arena/shared';

interface BallView {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  initials: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  lastHp: number;
}

interface KillFeedItem {
  text: Phaser.GameObjects.Text;
  born: number;
}

/** Renders server snapshots + kill feed. No local physics. */
export class ArenaScene extends Phaser.Scene {
  private timerText!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private kdaText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private feed: string[] = [];
  private ballsLayer!: Phaser.GameObjects.Container;
  private killFeedLayer!: Phaser.GameObjects.Container;
  private views = new Map<string, BallView>();
  private pendingAvatars = new Set<string>();
  private killFeed: KillFeedItem[] = [];
  private readonly killFeedTtl = 4500;

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0e18);
    this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 16, 0x10162a, 0.35)
      .setStrokeStyle(6, 0xfe2c55);

    this.add
      .text(CANVAS_WIDTH / 2, 56, 'BALL ARENA', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.timerText = this.add
      .text(CANVAS_WIDTH / 2, 120, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#20d68a',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.playersText = this.add
      .text(CANVAS_WIDTH / 2, 175, `Vivos: ${data?.round?.playerCount ?? 0}`, {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.kdaText = this.add
      .text(40, 220, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#888888',
      })
      .setDepth(100);

    this.ballsLayer = this.add.container(0, 0).setDepth(10);
    this.killFeedLayer = this.add.container(0, 0).setDepth(200);

    this.feedText = this.add
      .text(40, CANVAS_HEIGHT - 220, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#999999',
        wordWrap: { width: CANVAS_WIDTH - 80 },
      })
      .setDepth(100);

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

  update(_t: number, _dt: number): void {
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
  }

  private onRound = (state: RoundState) => {
    this.timerText.setText(this.formatTime(state.remainingSec));
    this.playersText.setText(`Vivos: ${state.playerCount ?? 0}`);
  };

  private onLive = (event: ArenaLiveEvent) => {
    let line = `${event.type}`;
    if (event.type === 'gift') line = `🎁 ${event.user.username} → ${event.giftName}`;
    else if (event.type === 'comment') line = `💬 ${event.user.username}: ${event.comment}`;
    else if (event.type === 'like') line = `❤️ ${event.user.username}`;
    else if (event.type === 'join') line = `👋 ${event.user.username}`;
    else if (event.type === 'follow') line = `➕ ${event.user.username}`;
    else if (event.type === 'share') line = `📤 ${event.user.username}`;
    this.feed.unshift(line);
    this.feed = this.feed.slice(0, 6);
    this.feedText.setText(this.feed.join('\n'));
  };

  private onSnapshot = (snap: GameSnapshot) => {
    this.timerText.setText(this.formatTime(snap.remainingSec));
    this.playersText.setText(`Vivos: ${snap.playerCount}`);
    this.syncBalls(snap.balls);
    this.updateKda(snap.stats);
  };

  private onCombat = (event: CombatEvent) => {
    if (event.type === 'hit') {
      this.spawnHitSparks(event.x, event.y, 0xffffff);
    } else if (event.type === 'kill') {
      this.pushKillFeed(event.message);
      this.spawnHitSparks(event.x, event.y, 0xfe2c55, 18);
      this.spawnDeathFlash(event.x, event.y);
    }
  };

  private updateKda(stats: PlayerStats[]): void {
    const top = stats.slice(0, 5);
    this.kdaText.setText(
      top.map((s) => `${s.alive ? '●' : '✗'} ${s.username.slice(0, 10)} ${s.kills}/${s.deaths}`).join('\n')
    );
  }

  private pushKillFeed(message: string): void {
    const text = this.add
      .text(CANVAS_WIDTH - 40, 260, message, {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#ffffff',
        backgroundColor: '#fe2c55cc',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(1, 0);
    this.killFeedLayer.add(text);
    this.killFeed.unshift({ text, born: Date.now() });
    this.killFeed = this.killFeed.slice(0, 6);
    this.layoutKillFeed();
  }

  private layoutKillFeed(): void {
    let y = 260;
    for (const item of this.killFeed) {
      item.text.setPosition(CANVAS_WIDTH - 40, y);
      y += 48;
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
        // Death removal — brief flash already handled by combat event
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

    container.add([circle, initials, hpBg, hpFg, label]);

    if (b.avatarUrl) {
      this.tryLoadAvatar(b, circle, initials, container);
    }

    return { container, circle, initials, label, hpBg, hpFg, lastHp: b.hp };
  }

  private updateBallView(view: BallView, b: BallState): void {
    view.container.setPosition(b.x, b.y);
    view.circle.setRadius(b.radius);
    const flash = b.hitFlash;
    view.circle.setFillStyle(flash ? 0xffffff : b.color, flash ? 0.9 : 1);
    view.circle.setStrokeStyle(3, flash ? 0xfe2c55 : 0xffffff, 0.85);
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
      // micro punch on damage
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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
