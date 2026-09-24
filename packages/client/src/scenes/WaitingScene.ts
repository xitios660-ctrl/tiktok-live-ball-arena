import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';
import { THEME, THEME_HEX, FONT, FONT_BLACK } from '../theme';

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
      this.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, THEME.charcoal);
      const g = this.add.graphics();
      // Soft chalkboard wash
      g.fillStyle(THEME.coral, 0.06);
      g.fillRect(0, 0, CANVAS_WIDTH, 260);
      g.fillStyle(THEME.teal, 0.05);
      g.fillRect(0, CANVAS_HEIGHT - 400, CANVAS_WIDTH, 400);
      g.lineStyle(120, 0x000000, 0.4);
      g.strokeCircle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 920);
      // Hand-drawn star accents
      this.drawStar(g, 120, SAFE.top + 80, 10, THEME.gold, 0.7);
      this.drawStar(g, CANVAS_WIDTH - 140, SAFE.top + 110, 8, THEME.lavender, 0.65);
      this.drawStar(g, 180, CANVAS_HEIGHT - SAFE.bottom - 40, 7, THEME.sage, 0.55);
      this.drawStar(g, CANVAS_WIDTH - 160, CANVAS_HEIGHT / 2 + 200, 9, THEME.coral, 0.5);
    }

    this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 28, CANVAS_HEIGHT - 28, 0x000000, 0)
      .setStrokeStyle(3, THEME.cream, 0.35);

    // Tiny cat-eye doodle (two ovals) — homage silhouette, not a logo copy
    const eyes = this.add.graphics().setDepth(5);
    eyes.fillStyle(THEME.cream, 0.9);
    eyes.fillEllipse(CANVAS_WIDTH / 2 - 28, SAFE.top + 100, 22, 28);
    eyes.fillEllipse(CANVAS_WIDTH / 2 + 28, SAFE.top + 100, 22, 28);
    eyes.fillStyle(THEME.charcoal, 1);
    eyes.fillCircle(CANVAS_WIDTH / 2 - 28, SAFE.top + 102, 6);
    eyes.fillCircle(CANVAS_WIDTH / 2 + 28, SAFE.top + 102, 6);

    this.add
      .text(CANVAS_WIDTH / 2, SAFE.top + 150, '★  BALL ARENA  ★', {
        fontFamily: FONT_BLACK,
        fontSize: '52px',
        color: THEME_HEX.cream,
        stroke: THEME_HEX.coral,
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.title = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, 'AGUARDANDO A LIVE', {
        fontFamily: FONT_BLACK,
        fontSize: '48px',
        color: THEME_HEX.cream,
        align: 'center',
        stroke: THEME_HEX.charcoal,
        strokeThickness: 6,
        wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
      })
      .setOrigin(0.5);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 30,
        phase === 'ended'
          ? 'Rodada encerrada — próxima em breve'
          : 'Comente na live para entrar na arena',
        {
          fontFamily: FONT,
          fontSize: '28px',
          color: THEME_HEX.teal,
          align: 'center',
          wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
        }
      )
      .setOrigin(0.5);

    // Soft slogan (homage vibe — not claiming brand)
    this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90, 'Jogos indie com alma ♡', {
        fontFamily: FONT,
        fontSize: '24px',
        color: THEME_HEX.lavender,
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    this.cta = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 160, '💬  COMENTE PARA JOGAR', {
        fontFamily: FONT_BLACK,
        fontSize: '28px',
        color: THEME_HEX.charcoal,
        backgroundColor: THEME_HEX.coral,
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5);

    this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - SAFE.bottom + 36, 'Admin DEMO · /admin', {
        fontFamily: FONT,
        fontSize: '20px',
        color: THEME_HEX.muted,
      })
      .setOrigin(0.5);

    if (opts.demoBadge) {
      this.add
        .text(SAFE.side, SAFE.top, 'DEMO', {
          fontFamily: FONT_BLACK,
          fontSize: '16px',
          color: THEME_HEX.cream,
          backgroundColor: THEME_HEX.coral + 'cc',
          padding: { x: 8, y: 4 },
        })
        .setDepth(200);
    }

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    });
  }

  private drawStar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    r: number,
    color: number,
    alpha: number
  ): void {
    g.fillStyle(color, alpha);
    g.fillCircle(x, y, r * 0.35);
    g.lineStyle(2, color, alpha);
    g.lineBetween(x - r, y, x + r, y);
    g.lineBetween(x, y - r, x, y + r);
    g.lineBetween(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
    g.lineBetween(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
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
    this.title.setAlpha(0.78 + Math.sin(this.pulse) * 0.22);
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.4) * 0.035);
  }
}
