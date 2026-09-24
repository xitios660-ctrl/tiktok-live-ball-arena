import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT } from '../theme';
import { createAmbientTwinkles } from '../ui/CinematicHud';
import { createBallArenaLogo, tickBallArenaLogo, type BallArenaLogoHandles } from '../ui/BallArenaLogo';
import {
  createWaitingHeroPack,
  tickHeroBall,
  tickClashFx,
  type HeroBallHandles,
  type ClashFxHandles,
} from '../fx/CharacterBalls';

/**
 * Cinematic waiting poster — layered Phaser graphics matching waiting-mock.png.
 * OBS ?transparent=1 skips opaque stadium fills; logo + CTA stay readable.
 */
export class WaitingScene extends Phaser.Scene {
  private logo!: BallArenaLogoHandles;
  private titleStack: Phaser.GameObjects.Text[] = [];
  private subtitle!: Phaser.GameObjects.Text;
  private cta!: Phaser.GameObjects.Container;
  private ctaGlow!: Phaser.GameObjects.Graphics;
  private pulse = 0;
  private twinkles: { tick: (t: number) => void; destroy: () => void } | null = null;
  private energyDust: Phaser.GameObjects.Arc[] = [];
  private overlayTransparent = false;
  private heroes: HeroBallHandles[] = [];
  private clash: ClashFxHandles | null = null;
  private footerGfx!: Phaser.GameObjects.Graphics;
  private stadiumGfx: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('WaitingScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    this.overlayTransparent = !!opts.transparent;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    if (!this.overlayTransparent) {
      this.stadiumGfx = this.add.graphics().setDepth(0);
      this.paintStadiumWash(this.stadiumGfx);
    }

    // Soft energy dust (gated)
    const dustCount = this.overlayTransparent ? 6 : 20;
    for (let i = 0; i < dustCount; i++) {
      const color =
        i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : THEME.electricCyan;
      const d = this.add
        .circle(
          60 + Math.random() * (CANVAS_WIDTH - 120),
          100 + Math.random() * (CANVAS_HEIGHT - 200),
          1.2 + Math.random() * 2.4,
          color,
          0.35
        )
        .setDepth(2);
      this.energyDust.push(d);
    }

    this.twinkles = createAmbientTwinkles(this, this.overlayTransparent ? 8 : 16, 2);

    // Thin cream frame (readable on transparent too)
    this.add
      .rectangle(cx, cy, CANVAS_WIDTH - 28, CANVAS_HEIGHT - 28, 0x000000, 0)
      .setStrokeStyle(2, THEME.light, this.overlayTransparent ? 0.18 : 0.28)
      .setDepth(4);

    // Logo assembly — top (crown + BALL / ARENA + rings)
    this.logo = createBallArenaLogo(this, cx, SAFE.top + 118, {
      scale: 0.92,
      depth: 30,
      showRings: true,
      showFlare: true,
    });

    // Hero clash pack — center mood
    const packCy = cy - 40;
    const pack = createWaitingHeroPack(this, cx, packCy);
    this.heroes = pack.balls;
    this.clash = pack.clash;

    // Floor ellipse under heroes (skip heavy fill when transparent)
    const floor = this.add.graphics().setDepth(15);
    if (!this.overlayTransparent) {
      floor.fillStyle(THEME.stone, 0.55);
      floor.fillEllipse(cx, packCy + 160, 780, 160);
      floor.fillStyle(THEME.arenaDark, 0.4);
      floor.fillEllipse(cx, packCy + 160, 620, 110);
    }
    floor.lineStyle(2.5, THEME.electricCyan, this.overlayTransparent ? 0.35 : 0.45);
    floor.strokeEllipse(cx, packCy + 160, 700, 130);
    floor.lineStyle(2, THEME.emberOrange, 0.35);
    floor.strokeEllipse(cx, packCy + 160, 520, 95);
    floor.lineStyle(2.5, THEME.gold, 0.55);
    floor.strokeCircle(cx, packCy + 160, 36);
    floor.fillStyle(THEME.gold, 0.12);
    floor.fillCircle(cx, packCy + 160, 22);

    // Big subtitle — AGUARDANDO A LIVE (stacked 3D ember glow)
    const titleY = cy + 220;
    const titleStr = 'AGUARDANDO A LIVE';
    const layers: Array<{ dy: number; color: string; stroke: string; strokeW: number; alpha: number }> = [
      { dy: 6, color: THEME_HEX.arenaRed, stroke: THEME_HEX.arenaDark, strokeW: 10, alpha: 0.55 },
      { dy: 3, color: THEME_HEX.emberOrange, stroke: THEME_HEX.arenaRed, strokeW: 8, alpha: 0.7 },
      { dy: 0, color: THEME_HEX.light, stroke: THEME_HEX.arenaDark, strokeW: 6, alpha: 1 },
    ];
    for (const L of layers) {
      const t = this.add
        .text(cx, titleY + L.dy, titleStr, {
          fontFamily: FONT_BLACK,
          fontSize: '48px',
          color: L.color,
          align: 'center',
          stroke: L.stroke,
          strokeThickness: L.strokeW,
          wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
        })
        .setOrigin(0.5)
        .setAlpha(L.alpha)
        .setDepth(40);
      this.titleStack.push(t);
    }

    // Tiny crown above subtitle
    this.add
      .text(cx, titleY - 42, '👑', { fontSize: '22px' })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0.9);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        cx,
        titleY + 52,
        phase === 'ended'
          ? 'Rodada encerrada — próxima em breve'
          : 'Comente na live para entrar na arena',
        {
          fontFamily: FONT,
          fontSize: '26px',
          color: THEME_HEX.electricCyan,
          align: 'center',
          wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
        }
      )
      .setOrigin(0.5)
      .setDepth(40);

    // Wide CTA — orange glow border + speech bubble + Bebas
    this.cta = this.add.container(cx, titleY + 130).setDepth(42);
    this.ctaGlow = this.add.graphics();
    this.drawCtaGlow(1);
    const ctaBg = this.add.graphics();
    ctaBg.fillStyle(THEME.arenaDark, 0.82);
    ctaBg.fillRoundedRect(-260, -36, 520, 72, 18);
    ctaBg.fillStyle(THEME.arenaRed, 0.92);
    ctaBg.fillRoundedRect(-254, -30, 508, 60, 14);
    ctaBg.lineStyle(3, THEME.emberOrange, 0.95);
    ctaBg.strokeRoundedRect(-260, -36, 520, 72, 18);
    ctaBg.lineStyle(1.5, THEME.gold, 0.55);
    ctaBg.strokeRoundedRect(-252, -28, 504, 56, 12);
    const ctaLabel = this.add
      .text(0, 0, '💬   COMENTE PARA JOGAR', {
        fontFamily: FONT_ACCENT,
        fontSize: '38px',
        color: THEME_HEX.light,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.cta.add([this.ctaGlow, ctaBg, ctaLabel]);

    // Footer — JOGOS INDIE COM ALMA ♡ between thin ember lines
    this.footerGfx = this.add.graphics().setDepth(40);
    const footerY = CANVAS_HEIGHT - SAFE.bottom + 48;
    this.drawFooter(footerY);
    this.add
      .text(cx, footerY, 'JOGOS INDIE COM ALMA ♡', {
        fontFamily: FONT,
        fontSize: '20px',
        color: THEME_HEX.light,
      })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(41);

    this.add
      .text(cx, CANVAS_HEIGHT - SAFE.bottom + 88, 'Admin DEMO · /admin', {
        fontFamily: FONT,
        fontSize: '16px',
        color: THEME_HEX.muted,
      })
      .setOrigin(0.5)
      .setDepth(41);

    if (opts.demoBadge) {
      this.add
        .text(SAFE.side, SAFE.top, 'DEMO', {
          fontFamily: FONT_ACCENT,
          fontSize: '20px',
          color: THEME_HEX.light,
          backgroundColor: THEME_HEX.arenaRed + 'cc',
          padding: { x: 10, y: 5 },
        })
        .setDepth(200);
    }

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.twinkles?.destroy();
      this.twinkles = null;
    });
  }

  /** Stadium wash: ember spotlights + dark crowd silhouette bands (procedural). */
  private paintStadiumWash(g: Phaser.GameObjects.Graphics): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    g.fillStyle(THEME.arenaDark, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Ember spotlights from upper corners
    g.fillStyle(THEME.emberOrange, 0.09);
    g.fillEllipse(180, 200, 520, 420);
    g.fillEllipse(CANVAS_WIDTH - 180, 220, 480, 400);
    g.fillStyle(THEME.arenaRed, 0.07);
    g.fillEllipse(cx, 280, 700, 360);
    g.fillStyle(THEME.electricCyan, 0.035);
    g.fillEllipse(cx, CANVAS_HEIGHT - 500, 900, 380);

    // Crowd silhouette bands — soft dark ellipses (not a photo)
    for (let row = 0; row < 6; row++) {
      const y = 340 + row * 70;
      const a = 0.18 + row * 0.04;
      g.fillStyle(0x000000, a);
      for (let i = 0; i < 14; i++) {
        const x = 40 + i * 78 + (row % 2) * 36;
        const h = 28 + (i % 3) * 10 + row * 2;
        g.fillEllipse(x, y, 34 + (i % 4) * 6, h);
      }
    }

    // Vertical banners with tiny crown marks
    for (const bx of [90, CANVAS_WIDTH - 90]) {
      g.fillStyle(THEME.arenaRed, 0.22);
      g.fillRoundedRect(bx - 18, 300, 36, 280, 6);
      g.fillStyle(THEME.gold, 0.55);
      g.fillCircle(bx, 340, 8);
      g.fillTriangle(bx - 7, 352, bx + 7, 352, bx, 368);
    }

    // Vignette
    g.lineStyle(160, 0x000000, 0.55);
    g.strokeCircle(cx, cy, 920);
    g.lineStyle(200, 0x000000, 0.4);
    g.strokeCircle(cx, cy, 1100);
  }

  private drawFooter(y: number): void {
    const g = this.footerGfx;
    g.clear();
    const cx = CANVAS_WIDTH / 2;
    g.lineStyle(1.5, THEME.emberOrange, 0.55);
    g.lineBetween(cx - 280, y, cx - 150, y);
    g.lineBetween(cx + 150, y, cx + 280, y);
    g.lineStyle(1, THEME.gold, 0.35);
    g.lineBetween(cx - 280, y + 3, cx - 155, y + 3);
    g.lineBetween(cx + 155, y + 3, cx + 280, y + 3);
  }

  private drawCtaGlow(pulse: number): void {
    const g = this.ctaGlow;
    g.clear();
    const a = 0.22 + pulse * 0.28;
    g.fillStyle(THEME.emberOrange, a);
    g.fillRoundedRect(-280, -50, 560, 100, 24);
    g.fillStyle(THEME.arenaRed, a * 0.55);
    g.fillRoundedRect(-268, -42, 536, 84, 20);
    g.lineStyle(2, THEME.gold, 0.25 + pulse * 0.35);
    g.strokeRoundedRect(-272, -46, 544, 92, 22);
  }

  private onRound = (state: RoundState) => {
    if (state.phase === 'ended') {
      this.subtitle.setText('Rodada encerrada — próxima em breve');
    } else if (state.phase === 'waiting') {
      this.subtitle.setText('Comente na live para entrar na arena');
    }
  };

  update(t: number, dt: number): void {
    this.pulse += dt * 0.0025;
    const p = 0.5 + Math.sin(this.pulse) * 0.5;

    if (this.logo) tickBallArenaLogo(this.logo, t);
    for (const h of this.heroes) tickHeroBall(h, t, 5);
    if (this.clash) tickClashFx(this.clash, t);

    // Title main layer breathes
    if (this.titleStack[2]) {
      this.titleStack[2].setAlpha(0.88 + Math.sin(this.pulse) * 0.12);
    }
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.5) * 0.035);
    if (this.ctaGlow) this.drawCtaGlow(p);

    this.twinkles?.tick(t);
    for (let i = 0; i < this.energyDust.length; i++) {
      const d = this.energyDust[i];
      d.y -= (0.15 + (i % 5) * 0.04) * (dt / 16);
      d.setAlpha(0.15 + (0.5 + Math.sin(this.pulse * 2 + i) * 0.5) * 0.4);
      if (d.y < 40) d.y = CANVAS_HEIGHT - 60;
    }
  }
}
