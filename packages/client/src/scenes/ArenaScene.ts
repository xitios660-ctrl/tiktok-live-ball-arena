import Phaser from 'phaser';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SOCKET_EVENTS,
  type RoundState,
  type ArenaLiveEvent,
  type GameSnapshot,
  type BallState,
} from '@arena/shared';

interface BallView {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  initials: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  avatar?: Phaser.GameObjects.Image;
}

/** Renders server-authoritative snapshots. No local physics. */
export class ArenaScene extends Phaser.Scene {
  private timerText!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private feed: string[] = [];
  private ballsLayer!: Phaser.GameObjects.Container;
  private views = new Map<string, BallView>();
  private pendingAvatars = new Set<string>();

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0e18);

    // Full-bleed arena border (matches server physics bounds visually)
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
      .text(CANVAS_WIDTH / 2, 175, `Jogadores: ${data?.round?.playerCount ?? 0}`, {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.ballsLayer = this.add.container(0, 0).setDepth(10);

    this.feedText = this.add
      .text(40, CANVAS_HEIGHT - 280, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#bbbbbb',
        wordWrap: { width: CANVAS_WIDTH - 80 },
      })
      .setDepth(100);

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.game.events.on(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    this.game.events.on(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.game.events.off(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
      this.game.events.off(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
      this.views.clear();
    });
  }

  private onRound = (state: RoundState) => {
    this.timerText.setText(this.formatTime(state.remainingSec));
    this.playersText.setText(`Jogadores: ${state.playerCount ?? 0}`);
  };

  private onLive = (event: ArenaLiveEvent) => {
    let line = `${event.type}`;
    if (event.type === 'gift') line = `🎁 ${event.user.username} → ${event.giftName}`;
    else if (event.type === 'comment') line = `💬 ${event.user.username}: ${event.comment}`;
    else if (event.type === 'like') line = `❤️ ${event.user.username} +${event.likeCount}`;
    else if (event.type === 'join') line = `👋 ${event.user.username}`;
    else if (event.type === 'follow') line = `➕ ${event.user.username}`;
    else if (event.type === 'share') line = `📤 ${event.user.username}`;
    this.feed.unshift(line);
    this.feed = this.feed.slice(0, 8);
    this.feedText.setText(this.feed.join('\n'));
  };

  private onSnapshot = (snap: GameSnapshot) => {
    this.timerText.setText(this.formatTime(snap.remainingSec));
    this.playersText.setText(`Jogadores: ${snap.playerCount}`);
    this.syncBalls(snap.balls);
  };

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

    container.add([circle, initials, hpBg, hpFg, label]);

    if (b.avatarUrl) {
      this.tryLoadAvatar(b, circle, initials, container);
    }

    return { container, circle, initials, label, hpBg, hpFg };
  }

  private updateBallView(view: BallView, b: BallState): void {
    view.container.setPosition(b.x, b.y);
    view.circle.setRadius(b.radius);
    view.circle.setFillStyle(b.color, 1);
    view.label.setText(this.truncate(b.label, 14));
    view.label.setY(b.radius + 14);
    const barW = b.radius * 2;
    view.hpBg.setPosition(0, -b.radius - 12);
    view.hpBg.setSize(barW, 8);
    const ratio = b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 0;
    view.hpFg.setPosition(-barW / 2, -b.radius - 12);
    view.hpFg.setSize(barW * ratio, 8);
    view.hpFg.setFillStyle(ratio > 0.3 ? 0x20d68a : 0xfe2c55);
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
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      // keep initials fallback
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
    const size = radius * 1.7;
    img.setDisplaySize(size, size);
    // Mask circle
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(0, 0, radius - 2);
    // Position mask with container — use geometry mask on image relative to container
    img.setMask(maskShape.createGeometryMask());
    // Parent mask with container by updating in sync is hard; simpler: just show circular-ish image
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
