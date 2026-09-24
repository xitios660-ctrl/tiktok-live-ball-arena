/**
 * Cinematic title / phase chrome for the OBS overlay.
 * Futuristic neon energy on cozy Ticulinho palette — homage only.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '@arena/shared';
import { THEME, THEME_HEX, FONT_BLACK } from '../theme';

export interface CinematicHudHandles {
  root: Phaser.GameObjects.Container;
  titleMain: Phaser.GameObjects.Text;
  titleGlow: Phaser.GameObjects.Text;
  titleGlow2: Phaser.GameObjects.Text;
  accentLine: Phaser.GameObjects.Graphics;
  neonFrame: Phaser.GameObjects.Graphics;
  phaseLabel: Phaser.GameObjects.Text;
  starsLeft: Phaser.GameObjects.Text;
  starsRight: Phaser.GameObjects.Text;
  scanline: Phaser.GameObjects.Rectangle;
  born: number;
  lastPhaseLabel: string;
}

/** Build weighty “BALL ARENA” header with neon glow + scanline. */
export function createCinematicTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 100
): CinematicHudHandles {
  const root = scene.add.container(x, y).setDepth(depth);

  const titleGlow2 = scene.add
    .text(0, 0, 'BALL ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: '50px',
      color: THEME_HEX.lavender,
      stroke: THEME_HEX.lavender,
      strokeThickness: 14,
    })
    .setOrigin(0.5)
    .setAlpha(0.18);

  const titleGlow = scene.add
    .text(0, 0, 'BALL ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: '46px',
      color: THEME_HEX.gold,
      stroke: THEME_HEX.coral,
      strokeThickness: 12,
    })
    .setOrigin(0.5)
    .setAlpha(0.4);

  const titleMain = scene.add
    .text(0, 0, 'BALL ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: '44px',
      color: THEME_HEX.cream,
      stroke: THEME_HEX.charcoal,
      strokeThickness: 8,
    })
    .setOrigin(0.5);

  try {
    (titleMain as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(4);
  } catch {
    /* Phaser version without letter-spacing */
  }

  const starsLeft = scene.add
    .text(-218, 0, '★', {
      fontFamily: FONT_BLACK,
      fontSize: '22px',
      color: THEME_HEX.gold,
    })
    .setOrigin(0.5)
    .setAlpha(0.9);

  const starsRight = scene.add
    .text(218, 0, '★', {
      fontFamily: FONT_BLACK,
      fontSize: '22px',
      color: THEME_HEX.gold,
    })
    .setOrigin(0.5)
    .setAlpha(0.9);

  const accentLine = scene.add.graphics();
  drawAccentLine(accentLine, 0, 28, 290, 0.5);

  const neonFrame = scene.add.graphics();
  // soft under-title neon bar area
  neonFrame.fillStyle(THEME.gold, 0.08);
  neonFrame.fillRoundedRect(-160, 18, 320, 14, 6);

  const scanline = scene.add
    .rectangle(0, -8, 420, 3, THEME.cream, 0.12)
    .setOrigin(0.5);

  const phaseLabel = scene.add
    .text(0, 50, 'RODADA', {
      fontFamily: FONT_BLACK,
      fontSize: '20px',
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

  root.add([
    titleGlow2,
    titleGlow,
    titleMain,
    starsLeft,
    starsRight,
    neonFrame,
    accentLine,
    scanline,
    phaseLabel,
  ]);

  return {
    root,
    titleMain,
    titleGlow,
    titleGlow2,
    accentLine,
    neonFrame,
    phaseLabel,
    starsLeft,
    starsRight,
    scanline,
    born: scene.time.now,
    lastPhaseLabel: 'RODADA',
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
  g.lineStyle(1, THEME.teal, a * 0.7);
  g.lineBetween(cx - halfW + 8, cy + 3, cx - 24, cy + 3);
  g.lineBetween(cx + 24, cy + 3, cx + halfW - 8, cy + 3);
  g.fillStyle(THEME.coral, 0.95);
  g.fillCircle(cx, cy, 4.5);
  g.fillStyle(THEME.lavender, 0.75);
  g.fillCircle(cx - halfW * 0.55, cy, 2.5);
  g.fillCircle(cx + halfW * 0.55, cy, 2.5);
}

/** Soft pulse / scanline — call each frame (cheap). */
export function tickCinematicHud(hud: CinematicHudHandles, time: number): void {
  const t = (time - hud.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 2.5) * 0.5;
  drawAccentLine(hud.accentLine, 0, 28, 290, pulse);
  hud.titleGlow.setAlpha(0.28 + pulse * 0.22);
  hud.titleGlow2.setAlpha(0.1 + pulse * 0.12);
  hud.starsLeft.setAlpha(0.7 + pulse * 0.25);
  hud.starsRight.setAlpha(0.7 + pulse * 0.25);
  // scanline drift
  const sy = -18 + ((t * 28) % 40);
  hud.scanline.setY(sy);
  hud.scanline.setAlpha(0.08 + pulse * 0.1);
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
      targets: [hud.titleMain, hud.titleGlow],
      scale: 1.06,
      duration: 180,
      yoyo: true,
      ease: 'Sine.Out',
    });
  }

  if (remainingSec != null && remainingSec <= 10 && phase === 'running') {
    hud.titleMain.setColor(THEME_HEX.coral);
    hud.starsLeft.setColor(THEME_HEX.coral);
    hud.starsRight.setColor(THEME_HEX.coral);
  } else if (phase === 'results' || phase === 'ended') {
    hud.titleMain.setColor(THEME_HEX.gold);
    hud.starsLeft.setColor(THEME_HEX.gold);
    hud.starsRight.setColor(THEME_HEX.gold);
  } else {
    hud.titleMain.setColor(THEME_HEX.cream);
    hud.starsLeft.setColor(THEME_HEX.gold);
    hud.starsRight.setColor(THEME_HEX.gold);
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
  title.setFontSize('58px').setColor(THEME_HEX.gold);
  body.setFontSize('32px').setColor(THEME_HEX.cream);
  hint.setFontSize('28px').setColor(THEME_HEX.teal);
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
    const color = i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.lavender : THEME.teal;
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
