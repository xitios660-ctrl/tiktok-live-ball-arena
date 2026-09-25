import Phaser from 'phaser';
import { SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { audio } from '../audio/AudioManager';
import { getOverlayOptions } from '../overlayConfig';
import { LANDSCAPE_HEIGHT } from '../phoneLandscape';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT } from '../theme';

export class PhoneLandscapeWaitingScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private frame!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private cta!: Phaser.GameObjects.Container;
  private heroLeft!: Phaser.GameObjects.Container;
  private heroRight!: Phaser.GameObjects.Container;
  private pulse = 0;

  constructor() {
    super('WaitingScene');
  }

  create(data?: { round?: RoundState }): void {
    audio.setPhoneLite(true);
    audio.prepare();
    this.input.once('pointerdown', () => void audio.startBgm(true));
    this.bg = this.add.graphics().setDepth(0);
    this.frame = this.add.graphics().setDepth(2);

    this.title = this.add
      .text(0, 0, 'BALL ARENA', {
        fontFamily: FONT_BLACK,
        fontSize: '76px',
        color: THEME_HEX.light,
        stroke: THEME_HEX.arenaRed,
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.subtitle = this.add
      .text(
        0,
        0,
        data?.round?.phase === 'ended'
          ? 'Rodada encerrada · próxima em breve'
          : 'AGUARDANDO A LIVE',
        {
          fontFamily: FONT_ACCENT,
          fontSize: '52px',
          color: THEME_HEX.gold,
          stroke: '#000000',
          strokeThickness: 6,
        }
      )
      .setOrigin(0.5)
      .setDepth(20);

    this.heroLeft = this.createHero(0xff4e45, true);
    this.heroRight = this.createHero(0x22d3ee, false);

    this.cta = this.add.container(0, 0).setDepth(25);
    const ctaBg = this.add.graphics();
    ctaBg.fillStyle(THEME.emberOrange, 1);
    ctaBg.fillRoundedRect(-330, -48, 660, 96, 26);
    ctaBg.fillStyle(THEME.light, 1);
    ctaBg.fillRoundedRect(-320, -38, 640, 76, 20);
    ctaBg.lineStyle(2, THEME.gold, 0.85);
    ctaBg.strokeRoundedRect(-320, -38, 640, 76, 20);
    const ctaText = this.add
      .text(0, 2, '💬  COMENTE PARA JOGAR', {
        fontFamily: FONT_ACCENT,
        fontSize: '44px',
        color: THEME_HEX.arenaDark,
      })
      .setOrigin(0.5);
    this.cta.add([ctaBg, ctaText]);

    this.add
      .text(24, 20, '● AO VIVO', {
        fontFamily: FONT_ACCENT,
        fontSize: '24px',
        color: THEME_HEX.arenaRed,
      })
      .setDepth(30);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    });

    this.layout();
  }

  update(_time: number, delta: number): void {
    this.pulse += delta * 0.003;
    const sway = Math.sin(this.pulse) * 12;
    if (this.heroLeft) this.heroLeft.angle = -4 + sway * 0.08;
    if (this.heroRight) this.heroRight.angle = 4 - sway * 0.08;
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.4) * 0.025);
  }

  private onRound = (state: RoundState): void => {
    if (!this.subtitle) return;
    this.subtitle.setText(
      state.phase === 'ended'
        ? 'RODADA ENCERRADA · PRÓXIMA EM BREVE'
        : 'AGUARDANDO A LIVE'
    );
  };

  private layout(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height || LANDSCAPE_HEIGHT;
    const cx = w / 2;
    const cy = h / 2;

    this.redrawBackground(w, h);

    this.title.setPosition(cx, Math.max(88, h * 0.12));
    this.subtitle.setPosition(cx, Math.max(190, h * 0.24));
    this.heroLeft.setPosition(cx - Math.min(300, w * 0.17), cy + 10);
    this.heroRight.setPosition(cx + Math.min(300, w * 0.17), cy + 10);
    this.cta.setPosition(cx, h - 105);
  }

  private redrawBackground(w: number, h: number): void {
    const g = this.bg;
    g.clear();
    g.fillStyle(THEME.arenaDark, 1);
    g.fillRect(0, 0, w, h);

    g.fillStyle(THEME.emberOrange, 0.11);
    g.fillEllipse(w * 0.2, h * 0.34, Math.max(520, w * 0.33), h * 0.82);
    g.fillEllipse(w * 0.8, h * 0.36, Math.max(520, w * 0.33), h * 0.82);

    g.fillStyle(THEME.arenaRed, 0.09);
    g.fillEllipse(w / 2, h * 0.42, Math.max(800, w * 0.48), h * 0.7);

    g.lineStyle(2, THEME.light, 0.18);
    g.strokeRoundedRect(18, 18, w - 36, h - 36, 24);

    const f = this.frame;
    f.clear();
    f.lineStyle(3, THEME.emberOrange, 0.58);
    f.strokeEllipse(w / 2, h * 0.66, Math.min(1200, w * 0.62), h * 0.32);
    f.lineStyle(2, THEME.gold, 0.42);
    f.strokeEllipse(w / 2, h * 0.66, Math.min(900, w * 0.46), h * 0.23);
  }

  private createHero(color: number, king: boolean): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0).setDepth(15);
    const glow = this.add.circle(0, 0, 120, color, 0.15);
    const body = this.add.circle(0, 0, 86, color, 1);
    body.setStrokeStyle(6, king ? THEME.gold : THEME.light, 0.9);

    const shine = this.add.ellipse(-26, -30, 54, 32, 0xffffff, 0.25);
    const eyeL = this.add.circle(-28, -8, 13, 0xffffff, 1);
    const eyeR = this.add.circle(28, -8, 13, 0xffffff, 1);
    const pupilL = this.add.circle(-24, -6, 6, 0x111111, 1);
    const pupilR = this.add.circle(24, -6, 6, 0x111111, 1);

    const brow = this.add.graphics();
    brow.lineStyle(7, 0x17120f, 1);
    brow.lineBetween(-45, -35, -12, -18);
    brow.lineBetween(12, -18, 45, -35);
    brow.lineStyle(5, 0x17120f, 1);
    brow.beginPath();
    brow.arc(0, 30, 28, Math.PI + 0.25, Math.PI * 2 - 0.25, false);
    brow.strokePath();

    root.add([glow, body, shine, eyeL, eyeR, pupilL, pupilR, brow]);

    if (king) {
      const crown = this.add
        .text(0, -118, '♛', {
          fontFamily: FONT_BLACK,
          fontSize: '54px',
          color: THEME_HEX.gold,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      root.add(crown);
    }

    return root;
  }
}
