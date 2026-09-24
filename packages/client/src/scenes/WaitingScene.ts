import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SOCKET_EVENTS, type RoundState } from '@arena/shared';
import { getOverlayOptions, SAFE } from '../overlayConfig';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT } from '../theme';
import { createAmbientTwinkles } from '../ui/CinematicHud';

/**
 * Cinematic waiting / idle screen — matches brand/ball-arena/refs/waiting-mock.png mood.
 * Socket flow unchanged; visual + light motion only.
 */
export class WaitingScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private cta!: Phaser.GameObjects.Container;
  private ctaLabel!: Phaser.GameObjects.Text;
  private ctaGlow!: Phaser.GameObjects.Graphics;
  private pulse = 0;
  private twinkles: { tick: (t: number) => void; destroy: () => void } | null = null;
  private energyDust: Phaser.GameObjects.Arc[] = [];
  private glassPanel!: Phaser.GameObjects.Graphics;
  private overlayTransparent = false;

  constructor() {
    super('WaitingScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    this.overlayTransparent = !!opts.transparent;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    if (!this.overlayTransparent) {
      this.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, THEME.arenaDark);
      const bg = this.add.graphics().setDepth(0);
      // Soft ember wash + cyan accent bands
      bg.fillStyle(THEME.arenaRed, 0.07);
      bg.fillEllipse(cx, cy - 80, CANVAS_WIDTH * 1.1, 520);
      bg.fillStyle(THEME.emberOrange, 0.05);
      bg.fillEllipse(cx, cy + 200, CANVAS_WIDTH * 0.9, 380);
      bg.fillStyle(THEME.electricCyan, 0.035);
      bg.fillRect(0, CANVAS_HEIGHT - 420, CANVAS_WIDTH, 420);
      // Stadium vignette rings
      bg.lineStyle(140, 0x000000, 0.5);
      bg.strokeCircle(cx, cy, 900);
      bg.lineStyle(180, 0x000000, 0.35);
      bg.strokeCircle(cx, cy, 1080);
      // Floor rings (stadium mood)
      bg.lineStyle(2, THEME.emberOrange, 0.18);
      bg.strokeEllipse(cx, cy + 120, 720, 280);
      bg.lineStyle(1.5, THEME.gold, 0.22);
      bg.strokeEllipse(cx, cy + 120, 480, 180);
      bg.lineStyle(2, THEME.gold, 0.4);
      bg.strokeCircle(cx, cy + 120, 48);
      bg.fillStyle(THEME.gold, 0.1);
      bg.fillCircle(cx, cy + 120, 28);
      // Corner energy dust seeds
      this.drawStar(bg, 110, SAFE.top + 90, 9, THEME.gold, 0.75);
      this.drawStar(bg, CANVAS_WIDTH - 120, SAFE.top + 120, 7, THEME.electricCyan, 0.65);
      this.drawStar(bg, 160, CANVAS_HEIGHT - SAFE.bottom - 50, 8, THEME.emberOrange, 0.55);
      this.drawStar(bg, CANVAS_WIDTH - 150, cy + 280, 8, THEME.arenaRed, 0.5);
    }

    // Soft energy dust (gated — fewer when transparent / low budget)
    const dustCount = this.overlayTransparent ? 8 : 22;
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

    this.twinkles = createAmbientTwinkles(this, this.overlayTransparent ? 10 : 18, 2);

    // Outer cream frame
    this.add
      .rectangle(cx, cy, CANVAS_WIDTH - 28, CANVAS_HEIGHT - 28, 0x000000, 0)
      .setStrokeStyle(2, THEME.light, 0.28)
      .setDepth(4);

    // Brand mark — crown + BALL ARENA
    this.add
      .text(cx, SAFE.top + 88, '👑', { fontSize: '36px' })
      .setOrigin(0.5)
      .setDepth(6);

    this.add
      .text(cx, SAFE.top + 148, '★  BALL ARENA  ★', {
        fontFamily: FONT_BLACK,
        fontSize: '48px',
        color: THEME_HEX.light,
        stroke: THEME_HEX.arenaRed,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Dark glass panel behind title + CTA
    this.glassPanel = this.add.graphics().setDepth(5);
    this.drawGlassPanel(0.5);

    this.title = this.add
      .text(cx, cy - 70, 'AGUARDANDO A LIVE', {
        fontFamily: FONT_BLACK,
        fontSize: '52px',
        color: THEME_HEX.light,
        align: 'center',
        stroke: THEME_HEX.arenaRed,
        strokeThickness: 7,
        wordWrap: { width: CANVAS_WIDTH - SAFE.side * 2 },
      })
      .setOrigin(0.5)
      .setDepth(7);

    const phase = data?.round?.phase || 'waiting';
    this.subtitle = this.add
      .text(
        cx,
        cy + 8,
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
      .setDepth(7);

    // CTA — glass ember button with Bebas
    this.cta = this.add.container(cx, cy + 120).setDepth(8);
    this.ctaGlow = this.add.graphics();
    this.drawCtaGlow(1);
    const ctaBg = this.add.graphics();
    ctaBg.fillStyle(THEME.arenaRed, 0.95);
    ctaBg.fillRoundedRect(-210, -34, 420, 68, 16);
    ctaBg.lineStyle(2, THEME.emberOrange, 0.9);
    ctaBg.strokeRoundedRect(-210, -34, 420, 68, 16);
    ctaBg.lineStyle(1.5, THEME.gold, 0.45);
    ctaBg.strokeRoundedRect(-204, -28, 408, 56, 12);
    this.ctaLabel = this.add
      .text(0, 0, '💬  COMENTE PARA JOGAR', {
        fontFamily: FONT_ACCENT,
        fontSize: '36px',
        color: THEME_HEX.light,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.cta.add([this.ctaGlow, ctaBg, this.ctaLabel]);

    this.add
      .text(cx, cy + 210, '— Jogos indie com alma ♡ —', {
        fontFamily: FONT,
        fontSize: '22px',
        color: THEME_HEX.light,
      })
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setDepth(7);

    this.add
      .text(cx, CANVAS_HEIGHT - SAFE.bottom + 36, 'Admin DEMO · /admin', {
        fontFamily: FONT,
        fontSize: '18px',
        color: THEME_HEX.muted,
      })
      .setOrigin(0.5)
      .setDepth(7);

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

  private drawGlassPanel(pulse: number): void {
    const g = this.glassPanel;
    g.clear();
    const w = CANVAS_WIDTH - 120;
    const h = 360;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = CANVAS_HEIGHT / 2 - 160;
    g.fillStyle(THEME.stone, 0.42 + pulse * 0.06);
    g.fillRoundedRect(x, y, w, h, 22);
    g.fillStyle(THEME.ink, 0.25);
    g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 18);
    g.lineStyle(2, THEME.steel, 0.55);
    g.strokeRoundedRect(x, y, w, h, 22);
    g.lineStyle(1.5, THEME.gold, 0.35 + pulse * 0.25);
    g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 19);
    g.lineStyle(2, THEME.electricCyan, 0.25 + pulse * 0.2);
    g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 16);
  }

  private drawCtaGlow(pulse: number): void {
    const g = this.ctaGlow;
    g.clear();
    const a = 0.25 + pulse * 0.2;
    g.fillStyle(THEME.emberOrange, a);
    g.fillRoundedRect(-230, -48, 460, 96, 22);
    g.fillStyle(THEME.arenaRed, a * 0.5);
    g.fillRoundedRect(-220, -40, 440, 80, 18);
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

  update(t: number, dt: number): void {
    this.pulse += dt * 0.0025;
    const p = 0.5 + Math.sin(this.pulse) * 0.5;
    this.title.setAlpha(0.82 + Math.sin(this.pulse) * 0.18);
    if (this.cta) this.cta.setScale(1 + Math.sin(this.pulse * 1.4) * 0.03);
    if (this.glassPanel) this.drawGlassPanel(p);
    if (this.ctaGlow) this.drawCtaGlow(p);
    this.twinkles?.tick(t);
    // Drift energy dust upward slowly
    for (let i = 0; i < this.energyDust.length; i++) {
      const d = this.energyDust[i];
      d.y -= (0.15 + (i % 5) * 0.04) * (dt / 16);
      d.setAlpha(0.15 + (0.5 + Math.sin(this.pulse * 2 + i) * 0.5) * 0.4);
      if (d.y < 40) d.y = CANVAS_HEIGHT - 60;
    }
  }
}
