import Phaser from 'phaser';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SOCKET_EVENTS,
  type RoundState,
  type ArenaLiveEvent,
} from '@arena/shared';

/** Stub arena — physics in Etapa 2. Shows timer + live event feed. */
export class ArenaScene extends Phaser.Scene {
  private timerText!: Phaser.GameObjects.Text;
  private feedText!: Phaser.GameObjects.Text;
  private feed: string[] = [];

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0a0e18);
    // Placeholder arena bounds
    this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 900, 1400, 0x12182a)
      .setStrokeStyle(4, 0xfe2c55);

    this.add
      .text(CANVAS_WIDTH / 2, 80, 'BALL ARENA', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '56px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(CANVAS_WIDTH / 2, 160, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#20d68a',
      })
      .setOrigin(0.5);

    this.feedText = this.add.text(60, CANVAS_HEIGHT - 400, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#cccccc',
      wordWrap: { width: CANVAS_WIDTH - 120 },
    });

    this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 'Física na Etapa 2', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#555555',
      })
      .setOrigin(0.5);

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.game.events.on(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.game.events.off(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    });
  }

  private onRound = (state: RoundState) => {
    this.timerText.setText(this.formatTime(state.remainingSec));
  };

  private onLive = (event: ArenaLiveEvent) => {
    let line = `${event.type}`;
    if (event.type === 'gift') line = `🎁 ${event.user.username} → ${event.giftName} x${event.repeatCount}`;
    else if (event.type === 'comment') line = `💬 ${event.user.username}: ${event.comment}`;
    else if (event.type === 'like') line = `❤️ ${event.user.username} +${event.likeCount}`;
    else if (event.type === 'join') line = `👋 ${event.user.username}`;
    else if (event.type === 'follow') line = `➕ ${event.user.username}`;
    else if (event.type === 'share') line = `📤 ${event.user.username}`;
    this.feed.unshift(line);
    this.feed = this.feed.slice(0, 12);
    this.feedText.setText(this.feed.join('\n'));
  };

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
