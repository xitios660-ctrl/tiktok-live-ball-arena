/**
 * Cinematic title / phase chrome for the OBS overlay.
 * Reuses BallArenaLogo (crown + stars + rings) — not plain text only.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '@arena/shared';
import { THEME, THEME_HEX, FONT_BLACK, FONT_ACCENT } from '../theme';
import {
  createBallArenaLogo,
  tickBallArenaLogo,
  type BallArenaLogoHandles,
} from './BallArenaLogo';

export interface CinematicHudHandles {
  root: Phaser.GameObjects.Container;
  logo: BallArenaLogoHandles;
  /** @deprecated kept for ArenaScene titleText alias — points at logo.ballMain */
  titleMain: Phaser.GameObjects.Text;
  titleGlow: Phaser.GameObjects.Text;
  titleGlow2: Phaser.GameObjects.Text;
  accentLine: Phaser.GameObjects.Graphics;
  neonFrame: Phaser.GameObjects.Graphics;
  phaseLabel: Phaser.GameObjects.Text;
  starsLeft: Phaser.GameObjects.Text;
  starsRight: Phaser.GameObjects.Text;
  scanline: Phaser.GameObjects.Rectangle;
  livePill: Phaser.GameObjects.Container | null;
  born: number;
  lastPhaseLabel: string;
}

/** Build weighty Ball Arena header with logo assembly + phase chrome. */
export function createCinematicTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 100
): CinematicHudHandles {
  const root = scene.add.container(x, y).setDepth(depth);

  const logo = createBallArenaLogo(scene, 0, 0, {
    compact: true,
    scale: 0.48,
    depth: 0,
    showRings: true,
    showFlare: true,
  });
  // Detach logo root into our container (re-parent)
  root.add(logo.root);
  logo.root.setPosition(0, 0);

  // Keep legacy glow text refs pointing at logo layers for tick/phase color hooks
  const titleGlow2 = logo.arenaGlow;
  const titleGlow = logo.ballGlow;
  const titleMain = logo.ballMain;

  const starsLeft = scene.add
    .text(-0, 0, '', { fontSize: '1px' })
    .setVisible(false);
  const starsRight = scene.add
    .text(0, 0, '', { fontSize: '1px' })
    .setVisible(false);

  const accentLine = scene.add.graphics();
  drawAccentLine(accentLine, 0, 48, 220, 0.5);

  const neonFrame = scene.add.graphics();
  neonFrame.fillStyle(THEME.gold, 0.06);
  neonFrame.fillRoundedRect(-120, 40, 240, 10, 5);

  const scanline = scene.add.rectangle(0, -8, 280, 2, THEME.light, 0.1).setOrigin(0.5);

  const phaseLabel = scene.add
    .text(0, 68, 'RODADA', {
      fontFamily: FONT_ACCENT,
      fontSize: '22px',
      color: THEME_HEX.muted,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setAlpha(0.95);
  try {
    (phaseLabel as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(5);
  } catch {
    /* ignore */
  }

  root.add([neonFrame, accentLine, scanline, phaseLabel, starsLeft, starsRight]);

  return {
    root,
    logo,
    titleMain,
    titleGlow,
    titleGlow2,
    accentLine,
    neonFrame,
    phaseLabel,
    starsLeft,
    starsRight,
    scanline,
    livePill: null,
    born: scene.time.now,
    lastPhaseLabel: 'RODADA',
  };
}

/** Red AO VIVO pill — top chrome for live overlay. */
export function createAoVivoPill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 110
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  g.fillStyle(THEME.arenaRed, 0.95);
  g.fillRoundedRect(-52, -14, 104, 28, 14);
  g.lineStyle(1.5, THEME.light, 0.35);
  g.strokeRoundedRect(-52, -14, 104, 28, 14);
  g.fillStyle(THEME.light, 1);
  g.fillCircle(-34, 0, 5);
  const label = scene.add
    .text(6, 0, 'AO VIVO', {
      fontFamily: FONT_ACCENT,
      fontSize: '18px',
      color: THEME_HEX.light,
      stroke: '#000000',
      strokeThickness: 2,
    })
    .setOrigin(0.5);
  root.add([g, label]);
  return root;
}

/** Bottom CTA strip — shown during waiting/countdown; hide when running. */
export function createBottomCtaStrip(
  scene: Phaser.Scene,
  y: number,
  depth = 105
): { root: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics; setVisible: (v: boolean) => void } {
  const root = scene.add.container(CANVAS_WIDTH / 2, y).setDepth(depth);
  const glow = scene.add.graphics();
  glow.fillStyle(THEME.arenaRed, 0.25);
  glow.fillRoundedRect(-310, -28, 620, 56, 20);
  const bg = scene.add.graphics();
  bg.fillStyle(THEME.arenaDark, 0.78);
  bg.fillRoundedRect(-300, -22, 600, 44, 16);
  bg.lineStyle(2.5, THEME.arenaRed, 0.9);
  bg.strokeRoundedRect(-300, -22, 600, 44, 16);
  bg.lineStyle(1, THEME.emberOrange, 0.5);
  bg.strokeRoundedRect(-294, -16, 588, 32, 12);
  const label = scene.add
    .text(0, 0, 'COMENTE NA LIVE PARA ENTRAR NA ARENA', {
      fontFamily: FONT_ACCENT,
      fontSize: '24px',
      color: THEME_HEX.light,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  root.add([glow, bg, label]);
  return {
    root,
    glow,
    setVisible(v: boolean) {
      root.setVisible(v);
    },
  };
}

function drawAccentLine(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  halfW: number,
  pulse: number
): void {
  g.clear();
  const a = 0.45 + pulse * 0.4;
  g.lineStyle(2.5, THEME.gold, a);
  g.lineBetween(cx - halfW, cy, cx - 18, cy);
  g.lineBetween(cx + 18, cy, cx + halfW, cy);
  g.lineStyle(1, THEME.electricCyan, a * 0.7);
  g.lineBetween(cx - halfW + 8, cy + 3, cx - 24, cy + 3);
  g.lineBetween(cx + 24, cy + 3, cx + halfW - 8, cy + 3);
  g.fillStyle(THEME.arenaRed, 0.95);
  g.fillCircle(cx, cy, 4.5);
  g.fillStyle(THEME.emberOrange, 0.75);
  g.fillCircle(cx - halfW * 0.55, cy, 2.5);
  g.fillCircle(cx + halfW * 0.55, cy, 2.5);
}

/** Soft pulse / scanline — call each frame (cheap). */
export function tickCinematicHud(hud: CinematicHudHandles, time: number): void {
  const t = (time - hud.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 2.5) * 0.5;
  drawAccentLine(hud.accentLine, 0, 48, 220, pulse);
  tickBallArenaLogo(hud.logo, time, { compact: true, showRings: true, showFlare: true });
  const sy = -18 + ((t * 28) % 40);
  hud.scanline.setY(sy);
  hud.scanline.setAlpha(0.06 + pulse * 0.08);
  if (hud.livePill) {
    hud.livePill.setAlpha(0.75 + pulse * 0.25);
  }
}

export type PhaseChrome =
  | 'waiting'
  | 'countdown'
  | 'running'
  | 'results'
  | 'ended'
  | 'urgent'
  | 'last_minute';

/** Update phase subtitle under the title with cinema fade+scale. */
export function setPhaseChrome(
  hud: CinematicHudHandles,
  phase: string,
  remainingSec?: number,
  scene?: Phaser.Scene
): void {
  let label = 'RODADA';
  let color = THEME_HEX.muted;

  if (phase === 'waiting') {
    label = 'AGUARDANDO';
    color = THEME_HEX.teal;
  } else if (phase === 'countdown') {
    label = 'PREPARAR';
    color = THEME_HEX.gold;
  } else if (phase === 'results' || phase === 'ended') {
    label = 'RESULTADOS';
    color = THEME_HEX.gold;
  } else if (phase === 'running') {
    if (remainingSec != null && remainingSec <= 10) {
      label = 'FINAL';
      color = THEME_HEX.coral;
    } else if (remainingSec != null && remainingSec <= 60) {
      label = 'ÚLTIMO MINUTO';
      color = THEME_HEX.coral;
    } else {
      label = 'RODADA';
      color = THEME_HEX.sage;
    }
  }

  const changed = label !== hud.lastPhaseLabel;
  hud.lastPhaseLabel = label;
  hud.phaseLabel.setText(label).setColor(color);

  if (changed && scene) {
    hud.phaseLabel.setScale(0.6).setAlpha(0);
    scene.tweens.add({
      targets: hud.phaseLabel,
      scale: 1,
      alpha: 0.95,
      duration: 320,
      ease: 'Back.Out',
    });
    scene.tweens.add({
      targets: hud.root,
      scale: 1.04,
      duration: 180,
      yoyo: true,
      ease: 'Sine.Out',
    });
  }

  if (remainingSec != null && remainingSec <= 10 && phase === 'running') {
    hud.titleMain.setColor(THEME_HEX.coral);
  } else if (phase === 'results' || phase === 'ended') {
    hud.titleMain.setColor(THEME_HEX.gold);
  } else {
    hud.titleMain.setColor(THEME_HEX.light);
  }
}

/** Larger cinematic winner card chrome (cream on glass). */
export function styleWinnerPanelDramatic(
  scene: Phaser.Scene,
  panel: Phaser.GameObjects.Container,
  title: Phaser.GameObjects.Text,
  body: Phaser.GameObjects.Text,
  hint: Phaser.GameObjects.Text
): void {
  title.setFontSize('56px').setColor(THEME_HEX.gold);
  body.setFontSize('30px').setColor(THEME_HEX.light);
  hint.setFontSize('26px').setColor(THEME_HEX.electricCyan);
  void scene;
  void panel;
}

export function canvasCenterX(): number {
  return CANVAS_WIDTH / 2;
}

/**
 * Cheap star / dust twinkles in the background (few arcs, no particles).
 * Returns a tick function.
 */
export function createAmbientTwinkles(
  scene: Phaser.Scene,
  count = 18,
  depth = 1
): { tick: (time: number) => void; destroy: () => void } {
  const stars: { g: Phaser.GameObjects.Arc; phase: number; speed: number }[] = [];
  const root = scene.add.container(0, 0).setDepth(depth);
  for (let i = 0; i < count; i++) {
    const x = 40 + Math.random() * (CANVAS_WIDTH - 80);
    const y = 80 + Math.random() * (1920 - 200);
    const r = 1.2 + Math.random() * 2.2;
    const color = i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : THEME.electricCyan;
    const g = scene.add.circle(x, y, r, color, 0.35);
    root.add(g);
    stars.push({ g, phase: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 2 });
  }
  return {
    tick(time: number) {
      const t = time / 1000;
      for (const s of stars) {
        const a = 0.15 + (0.5 + Math.sin(t * s.speed + s.phase) * 0.5) * 0.45;
        s.g.setAlpha(a);
      }
    },
    destroy() {
      root.destroy(true);
    },
  };
}
