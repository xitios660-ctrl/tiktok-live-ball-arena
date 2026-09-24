import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';

export class WaitingScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private cta!: Phaser.GameObjects.Text;
  private pulse = 0;

  constructor() {
    super('WaitingScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    if (!opts.transparent) {
      this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x070b14);
      const g = this.add.graphics();
      g.fillStyle(0xfe2c55, 0.08);
      g.fillRect(0, 0, CANVAS_WIDTH, 280);
      g.fillStyle(0x25f4ee, 0.05);
      g.fillRect(0, CANVAS_HEIGHT - 420, CANVAS_WIDTH, 420);
      g.lineStyle(100, 0x000000, 0.35);
      g.strokeCircle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 900);
    }

    // Soft frame
    this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 24, CANVAS_HEIGHT - 24, 0x000000, 0)
      .setStrokeStyle(4, 0xfe2c55, 0.7);

    this.add
      .text(CANVAS_WIDTH / 2, SAFE.top + 40, 'BALL ARENA', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '56px',
        color: '#ffffff',
        stroke: '#fe2c55',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.title = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, 'AGUARDANDO A LIVE', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '52px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
        wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
      })
      .setOrigin(0.5);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 40,
        phase === 'ended'
          ? 'Rodada encerrada — próxima em breve'
          : 'Comente na live para entrar na arena',
        {
          fontFamily: 'Arial',
          fontSize: '30px',
          color: '#25f4ee',
          align: 'center',
          wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
        }
      )
      .setOrigin(0.5);

    this.cta = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120, '💬  COMENTE PARA JOGAR', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '28px',
        color: '#ffd60a',
        backgroundColor: '#000000aa',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);

    this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - SAFE.bottom + 36, 'Admin DEMO · /admin', {
        fontFamily: 'monospace',
        fontSize: '20px',
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
      this.subtitle.setText('Rodada encerrada — próxima em breve');
    } else if (state.phase === 'waiting') {
      this.subtitle.setText('Comente na live para entrar na arena');
    }
  };

  update(_t: number, dt: number): void {
    this.pulse += dt * 0.0025;
    this.title.setAlpha(0.75 + Math.sin(this.pulse) * 0.25);
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.4) * 0.04);
  }
}
