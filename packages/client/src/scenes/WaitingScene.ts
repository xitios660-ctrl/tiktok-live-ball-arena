import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';

export class WaitingScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private pulse = 0;

  constructor() {
    super('WaitingScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    if (!opts.transparent) {
      this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x050508);
    }

    this.title = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60, 'AGUARDANDO A LIVE COMEÇAR', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
      })
      .setOrigin(0.5);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 20,
        phase === 'ended'
          ? 'Rodada encerrada — aguardando próxima'
          : 'Ball Arena · OBS 1080×1920 · DEMO',
        { fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#fe2c55' }
      )
      .setOrigin(0.5);

    this.add
      .text(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 90,
        'Admin: comentário/bots spawnam bolas e iniciam a rodada',
        { fontFamily: 'Arial', fontSize: '22px', color: '#888888', align: 'center' }
      )
      .setOrigin(0.5);

    this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - SAFE.bottom + 40, 'Admin DEMO: /admin', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#666666',
      })
      .setOrigin(0.5);

    if (opts.demoBadge) {
      this.add
        .text(SAFE.side, SAFE.top, 'DEMO', {
          fontFamily: 'Arial Black, Arial',
          fontSize: '16px',
          color: '#fe2c55',
          backgroundColor: '#00000088',
          padding: { x: 8, y: 4 },
        })
        .setDepth(200);
    }

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    });
  }

  private onRound = (state: RoundState) => {
    if (state.phase === 'ended') {
      this.subtitle.setText('Rodada encerrada — aguardando próxima');
    } else if (state.phase === 'waiting') {
      this.subtitle.setText('Ball Arena · OBS 1080×1920 · DEMO');
    }
  };

  update(_t: number, dt: number): void {
    this.pulse += dt * 0.002;
    this.title.setAlpha(0.7 + Math.sin(this.pulse) * 0.3);
  }
}
