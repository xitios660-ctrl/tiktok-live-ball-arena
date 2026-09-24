import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';
import { audio } from '../audio/AudioManager';
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
 * Cinematic waiting poster — energetic orange stadium matching waiting-target.png.
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

    // Warm ember dust (gated)
    const dustCount = this.overlayTransparent ? 6 : 24;
    for (let i = 0; i < dustCount; i++) {
      const color =
        i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : THEME.arenaRed;
      const d = this.add
        .circle(
          60 + Math.random() * (CANVAS_WIDTH - 120),
          100 + Math.random() * (CANVAS_HEIGHT - 200),
          1.2 + Math.random() * 2.6,
          color,
          0.4
        )
        .setDepth(2);
      this.energyDust.push(d);
    }

    this.twinkles = createAmbientTwinkles(this, this.overlayTransparent ? 8 : 18, 2);

    // Soft arena atmosphere (full intensity resumes in ArenaScene)
    audio.ensure();
    audio.startAmbient(0.55);
    this.input.once('pointerdown', () => {
      audio.ensure();
      audio.startAmbient(0.55);
    });

    // Thin cream frame
    this.add
      .rectangle(cx, cy, CANVAS_WIDTH - 28, CANVAS_HEIGHT - 28, 0x000000, 0)
      .setStrokeStyle(2, THEME.light, this.overlayTransparent ? 0.18 : 0.28)
      .setDepth(4);

    // Logo — orange energy ring + red-orange Bevan
    this.logo = createBallArenaLogo(this, cx, SAFE.top + 118, {
      scale: 0.95,
      depth: 30,
      showRings: true,
      showFlare: true,
    });

    // Hero clash pack — front and center
    const packCy = cy - 40;
    const pack = createWaitingHeroPack(this, cx, packCy);
    this.heroes = pack.balls;
    this.clash = pack.clash;

    // Arena floor — dark metallic + ORANGE segment lines (not teal orbitals)
    const floor = this.add.graphics().setDepth(15);
    this.paintArenaFloor(floor, cx, packCy + 160);

    // AGUARDANDO A LIVE — metallic light face + red-orange stacked glow
    const titleY = cy + 220;
    const titleStr = 'AGUARDANDO A LIVE';
    const layers: Array<{ dy: number; color: string; stroke: string; strokeW: number; alpha: number }> = [
      { dy: 8, color: THEME_HEX.arenaRed, stroke: THEME_HEX.arenaDark, strokeW: 14, alpha: 0.5 },
      { dy: 5, color: THEME_HEX.arenaRed, stroke: THEME_HEX.emberOrange, strokeW: 11, alpha: 0.7 },
      { dy: 2, color: THEME_HEX.emberOrange, stroke: THEME_HEX.arenaRed, strokeW: 8, alpha: 0.85 },
      { dy: 0, color: THEME_HEX.light, stroke: THEME_HEX.arenaDark, strokeW: 6, alpha: 1 },
    ];
    for (const L of layers) {
      const t = this.add
        .text(cx, titleY + L.dy, titleStr, {
          fontFamily: FONT_BLACK,
          fontSize: '50px',
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
      .text(cx, titleY - 44, '👑', { fontSize: '24px' })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0.95);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        cx,
        titleY + 54,
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

    // Wide CTA — cream/light fill + BLACK Bebas + bright orange glow (NOT dark)
    this.cta = this.add.container(cx, titleY + 132).setDepth(42);
    this.ctaGlow = this.add.graphics();
    this.drawCtaGlow(1);
    const ctaBg = this.add.graphics();
    // Outer rim (ember)
    ctaBg.fillStyle(THEME.emberOrange, 1);
    ctaBg.fillRoundedRect(-268, -40, 536, 80, 20);
    // Cream / off-white body
    ctaBg.fillStyle(THEME.cream, 1);
    ctaBg.fillRoundedRect(-260, -32, 520, 64, 16);
    // Soft inner highlight
    ctaBg.fillStyle(0xffffff, 0.55);
    ctaBg.fillRoundedRect(-252, -28, 504, 22, 10);
    // Thin gold inner stroke
    ctaBg.lineStyle(2, THEME.gold, 0.65);
    ctaBg.strokeRoundedRect(-256, -28, 512, 56, 14);
    const ctaLabel = this.add
      .text(0, 1, '💬   COMENTE PARA JOGAR', {
        fontFamily: FONT_ACCENT,
        fontSize: '40px',
        color: '#0B0B0F',
        stroke: '#F2EBD7',
        strokeThickness: 1,
      })
      .setOrigin(0.5);
    this.cta.add([this.ctaGlow, ctaBg, ctaLabel]);

    // Footer — JOGOS INDIE COM ALMA ♡ between orange hairlines
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
      .setAlpha(0.85)
      .setDepth(41);

    // Tiny admin hint only (was loud DEMO text)
    this.add
      .text(cx, CANVAS_HEIGHT - SAFE.bottom + 88, 'Admin · /admin', {
        fontFamily: FONT,
        fontSize: '12px',
        color: THEME_HEX.muted,
      })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setDepth(41);

    if (opts.demoBadge) {
      this.add
        .text(SAFE.side, SAFE.top, 'DEMO', {
          fontFamily: FONT_ACCENT,
          fontSize: '18px',
          color: THEME_HEX.light,
          backgroundColor: THEME_HEX.arenaRed + 'cc',
          padding: { x: 8, y: 4 },
        })
        .setDepth(200)
        .setAlpha(0.7);
    }

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.twinkles?.destroy();
      this.twinkles = null;
    });
  }

  /** Dark metallic floor with orange segment rings + crown marker. */
  private paintArenaFloor(g: Phaser.GameObjects.Graphics, cx: number, fy: number): void {
    if (!this.overlayTransparent) {
      g.fillStyle(THEME.stone, 0.7);
      g.fillEllipse(cx, fy, 820, 175);
      g.fillStyle(THEME.arenaDark, 0.55);
      g.fillEllipse(cx, fy, 660, 120);
      // Metallic tile hints
      g.lineStyle(1, THEME.steel, 0.25);
      for (let i = -4; i <= 4; i++) {
        g.lineBetween(cx + i * 70, fy - 40, cx + i * 70, fy + 40);
      }
    }
    // ORANGE segment rings (primary — not teal)
    g.lineStyle(3.5, THEME.emberOrange, this.overlayTransparent ? 0.45 : 0.7);
    g.strokeEllipse(cx, fy, 740, 140);
    g.lineStyle(2.5, THEME.arenaRed, 0.45);
    g.strokeEllipse(cx, fy, 580, 105);
    g.lineStyle(2, THEME.gold, 0.55);
    g.strokeEllipse(cx, fy, 420, 78);
    // Center crown pad
    g.lineStyle(2.5, THEME.gold, 0.7);
    g.strokeCircle(cx, fy, 38);
    g.fillStyle(THEME.emberOrange, 0.15);
    g.fillCircle(cx, fy, 28);
    g.fillStyle(THEME.gold, 0.85);
    // Tiny crown mark
    g.fillTriangle(cx - 10, fy + 4, cx + 10, fy + 4, cx, fy - 12);
    g.fillRect(cx - 12, fy + 2, 24, 5);
  }

  /** Stadium wash: warm ember spotlights + crowd silhouette bands. */
  private paintStadiumWash(g: Phaser.GameObjects.Graphics): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    g.fillStyle(THEME.arenaDark, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Warm ember wash (stronger than cool teal)
    g.fillStyle(THEME.emberOrange, 0.14);
    g.fillEllipse(160, 180, 560, 460);
    g.fillEllipse(CANVAS_WIDTH - 160, 200, 520, 440);
    g.fillStyle(THEME.arenaRed, 0.1);
    g.fillEllipse(cx, 260, 780, 400);
    g.fillStyle(THEME.gold, 0.06);
    g.fillEllipse(cx, 400, 600, 320);
    // Soft ground glow under arena
    g.fillStyle(THEME.emberOrange, 0.08);
    g.fillEllipse(cx, CANVAS_HEIGHT - 520, 980, 420);

    // Spotlight cones from top
    for (const [sx, sy, w, h, a] of [
      [200, 40, 180, 520, 0.07],
      [cx, 20, 220, 560, 0.09],
      [CANVAS_WIDTH - 200, 50, 170, 500, 0.07],
      [340, 60, 120, 400, 0.05],
      [CANVAS_WIDTH - 340, 70, 120, 380, 0.05],
    ] as Array<[number, number, number, number, number]>) {
      g.fillStyle(THEME.gold, a);
      g.fillTriangle(sx - 18, sy, sx + 18, sy, sx, sy + h * 0.15);
      g.fillStyle(THEME.emberOrange, a * 0.85);
      g.fillEllipse(sx, sy + h * 0.55, w, h);
    }

    // Crowd silhouette bands
    for (let row = 0; row < 7; row++) {
      const y = 320 + row * 68;
      const a = 0.16 + row * 0.035;
      g.fillStyle(0x000000, a);
      for (let i = 0; i < 15; i++) {
        const x = 30 + i * 74 + (row % 2) * 34;
        const h = 26 + (i % 3) * 12 + row * 2;
        g.fillEllipse(x, y, 32 + (i % 4) * 6, h);
      }
    }

    // Vertical banners with crown marks
    for (const bx of [90, CANVAS_WIDTH - 90]) {
      g.fillStyle(THEME.arenaRed, 0.28);
      g.fillRoundedRect(bx - 18, 290, 36, 300, 6);
      g.fillStyle(THEME.emberOrange, 0.2);
      g.fillRoundedRect(bx - 14, 294, 28, 292, 4);
      g.fillStyle(THEME.gold, 0.7);
      g.fillCircle(bx, 330, 9);
      g.fillTriangle(bx - 8, 344, bx + 8, 344, bx, 362);
    }

    // Vignette
    g.lineStyle(180, 0x000000, 0.5);
    g.strokeCircle(cx, cy, 900);
    g.lineStyle(220, 0x000000, 0.38);
    g.strokeCircle(cx, cy, 1080);
  }

  private drawFooter(y: number): void {
    const g = this.footerGfx;
    g.clear();
    const cx = CANVAS_WIDTH / 2;
    g.lineStyle(2, THEME.emberOrange, 0.7);
    g.lineBetween(cx - 290, y, cx - 155, y);
    g.lineBetween(cx + 155, y, cx + 290, y);
    g.lineStyle(1, THEME.gold, 0.4);
    g.lineBetween(cx - 290, y + 4, cx - 160, y + 4);
    g.lineBetween(cx + 160, y + 4, cx + 290, y + 4);
  }

  private drawCtaGlow(pulse: number): void {
    const g = this.ctaGlow;
    g.clear();
    const a = 0.3 + pulse * 0.35;
    // Bright ember outer bloom
    g.fillStyle(THEME.emberOrange, a);
    g.fillRoundedRect(-300, -56, 600, 112, 28);
    g.fillStyle(THEME.arenaRed, a * 0.45);
    g.fillRoundedRect(-286, -48, 572, 96, 24);
    g.fillStyle(THEME.gold, a * 0.25);
    g.fillRoundedRect(-276, -44, 552, 88, 22);
    g.lineStyle(3, THEME.emberOrange, 0.4 + pulse * 0.45);
    g.strokeRoundedRect(-280, -50, 560, 100, 24);
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

    // Title face layer breathes
    const face = this.titleStack[this.titleStack.length - 1];
    if (face) face.setAlpha(0.9 + Math.sin(this.pulse) * 0.1);
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.5) * 0.04);
    if (this.ctaGlow) this.drawCtaGlow(p);

    this.twinkles?.tick(t);
    for (let i = 0; i < this.energyDust.length; i++) {
      const d = this.energyDust[i];
      d.y -= (0.15 + (i % 5) * 0.04) * (dt / 16);
      d.setAlpha(0.18 + (0.5 + Math.sin(this.pulse * 2 + i) * 0.5) * 0.45);
      if (d.y < 40) d.y = CANVAS_HEIGHT - 60;
    }
  }
}
