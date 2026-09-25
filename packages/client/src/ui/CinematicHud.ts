/**
 * Cinematic title / phase chrome for the OBS overlay.
 * Reuses BallArenaLogo (crown + stars + rings) — not plain text only.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, DEFAULT_ROUND_DURATION_SEC } from '@arena/shared';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT } from '../theme';
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
  glow.fillStyle(THEME.arenaRed, 0.12);
  glow.fillRoundedRect(-505, -96, 1010, 136, 18);
  const bg = scene.add.graphics();
  bg.fillStyle(THEME.arenaDark, 0.96);
  bg.fillRoundedRect(-495, -90, 990, 124, 16);
  bg.lineStyle(2, THEME.gold, 0.65);
  bg.strokeRoundedRect(-495, -90, 990, 124, 16);
  const label = scene.add.text(0, -28, [
    '💬 COMENTE PARA ENTRAR OU RENASCER',
    '❤️ 50: +10 vida • 100: +20 vida / +1 força • 150: +10 vida • 200: +40 vida / +2 força',
    '500: vida cheia / +10 força / 🦫 • 1000: vida cheia / +15 força / 🦫×3 até o fim',
    'Metas intermediárias de 50: +10 vida • Likes individuais acumulam na rodada',
  ].join('\n'), {
    fontFamily: FONT, fontSize: '23px', color: THEME_HEX.light,
    align: 'center', lineSpacing: 5, wordWrap: { width: 950 },
  }).setOrigin(0.5);
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

/* ------------------------------------------------------------------ */
/* Cinematic timer capsule — glass pill + neon rim + progress bar      */
/* ------------------------------------------------------------------ */

const CAPSULE_W = 280;
const CAPSULE_H = 78;
const CAPSULE_R = 22;

export interface TimerCapsuleHandles {
  root: Phaser.GameObjects.Container;
  glass: Phaser.GameObjects.Graphics;
  neon: Phaser.GameObjects.Graphics;
  progress: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  born: number;
  durationSec: number;
  remaining: number;
  phase: string;
  accent: number;
}

/** Build glass/neon timer capsule (centered at x,y). */
export function createTimerCapsule(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialLabel: string,
  depth = 100
): TimerCapsuleHandles {
  const root = scene.add.container(x, y).setDepth(depth);
  const glass = scene.add.graphics();
  const neon = scene.add.graphics();
  const progress = scene.add.graphics();

  const glow = scene.add
    .text(0, -2, initialLabel, {
      fontFamily: FONT_ACCENT,
      fontSize: '72px',
      color: THEME_HEX.electricCyan,
    })
    .setOrigin(0.5)
    .setAlpha(0.28);

  const label = scene.add
    .text(0, -2, initialLabel, {
      fontFamily: FONT_ACCENT,
      fontSize: '66px',
      color: THEME_HEX.electricCyan,
      stroke: '#000000',
      strokeThickness: 8,
    })
    .setOrigin(0.5);

  root.add([glass, neon, progress, glow, label]);
  drawTimerCapsule(glass, neon, progress, THEME.electricCyan, 1, 0.5);

  return {
    root,
    glass,
    neon,
    progress,
    glow,
    label,
    born: scene.time.now,
    durationSec: DEFAULT_ROUND_DURATION_SEC,
    remaining: DEFAULT_ROUND_DURATION_SEC,
    phase: 'waiting',
    accent: THEME.electricCyan,
  };
}

function accentForTimer(remaining: number, phase: string): number {
  if (phase === 'results' || phase === 'ended') return THEME.gold;
  if (remaining <= 30) return THEME.arenaRed;
  if (remaining <= 60) return THEME.gold;
  return THEME.electricCyan;
}

function drawTimerCapsule(
  glass: Phaser.GameObjects.Graphics,
  neon: Phaser.GameObjects.Graphics,
  progress: Phaser.GameObjects.Graphics,
  accent: number,
  frac: number,
  pulse: number
): void {
  const hw = CAPSULE_W / 2;
  const hh = CAPSULE_H / 2;
  const a = 0.45 + pulse * 0.4;

  glass.clear();
  glass.fillStyle(accent, 0.1 + pulse * 0.08);
  glass.fillRoundedRect(-hw - 6, -hh - 4, CAPSULE_W + 12, CAPSULE_H + 8, CAPSULE_R + 4);
  glass.fillStyle(THEME.ink, 0.72);
  glass.fillRoundedRect(-hw, -hh, CAPSULE_W, CAPSULE_H, CAPSULE_R);
  glass.fillStyle(THEME.stone, 0.38);
  glass.fillRoundedRect(-hw + 3, -hh + 3, CAPSULE_W - 6, CAPSULE_H - 6, CAPSULE_R - 3);
  glass.fillStyle(THEME.light, 0.06);
  glass.fillRoundedRect(-hw + 10, -hh + 6, CAPSULE_W - 20, 14, 8);
  glass.fillStyle(THEME.gold, 0.55 + pulse * 0.3);
  glass.fillCircle(-hw + 16, 0, 2.2);
  glass.fillCircle(hw - 16, 0, 2.2);

  neon.clear();
  neon.lineStyle(2.5, accent, a);
  neon.strokeRoundedRect(-hw, -hh, CAPSULE_W, CAPSULE_H, CAPSULE_R);
  neon.lineStyle(1.2, THEME.light, a * 0.35);
  neon.strokeRoundedRect(-hw + 3, -hh + 3, CAPSULE_W - 6, CAPSULE_H - 6, CAPSULE_R - 3);
  const tick = 14;
  neon.lineStyle(2, accent, a * 0.9);
  neon.lineBetween(-hw + 8, -hh + 2, -hw + 8 + tick, -hh + 2);
  neon.lineBetween(-hw + 2, -hh + 8, -hw + 2, -hh + 8 + tick);
  neon.lineBetween(hw - 8, -hh + 2, hw - 8 - tick, -hh + 2);
  neon.lineBetween(hw - 2, -hh + 8, hw - 2, -hh + 8 + tick);
  neon.lineBetween(-hw + 8, hh - 2, -hw + 8 + tick, hh - 2);
  neon.lineBetween(-hw + 2, hh - 8, -hw + 2, hh - 8 - tick);
  neon.lineBetween(hw - 8, hh - 2, hw - 8 - tick, hh - 2);
  neon.lineBetween(hw - 2, hh - 8, hw - 2, hh - 8 - tick);

  progress.clear();
  const barW = CAPSULE_W - 36;
  const barH = 5;
  const barY = hh - 14;
  const barX = -barW / 2;
  progress.fillStyle(THEME.ink, 0.55);
  progress.fillRoundedRect(barX, barY, barW, barH, 3);
  const fill = Math.max(0, Math.min(1, frac));
  if (fill > 0.01) {
    progress.fillStyle(accent, 0.85 + pulse * 0.15);
    progress.fillRoundedRect(barX, barY, barW * fill, barH, 3);
    progress.fillStyle(THEME.light, 0.35);
    progress.fillRoundedRect(barX, barY, barW * fill, 2, 1);
  }
}

/** Apply remaining/phase visuals (call from round state updates). */
export function setTimerCapsule(
  cap: TimerCapsuleHandles,
  label: string,
  remaining: number,
  phase: string,
  durationSec?: number
): void {
  if (durationSec != null && durationSec > 0) cap.durationSec = durationSec;
  cap.remaining = remaining;
  cap.phase = phase;
  const accent = accentForTimer(remaining, phase);
  cap.accent = accent;

  if (phase === 'results' || phase === 'ended') {
    cap.label.setText('RESULTADOS').setColor(THEME_HEX.gold).setFontSize('52px');
    cap.glow.setText('RESULTADOS').setColor(THEME_HEX.gold).setFontSize('56px').setAlpha(0.35);
  } else if (remaining <= 10 && phase === 'running') {
    cap.label.setText(label).setColor(THEME_HEX.arenaRed).setFontSize('78px');
    cap.glow.setText(label).setColor(THEME_HEX.arenaRed).setFontSize('82px').setAlpha(0.5);
  } else if (remaining <= 30) {
    cap.label.setText(label).setColor(THEME_HEX.arenaRed).setFontSize('68px');
    cap.glow.setText(label).setColor(THEME_HEX.arenaRed).setFontSize('72px').setAlpha(0.42);
  } else if (remaining <= 60) {
    cap.label.setText(label).setColor(THEME_HEX.gold).setFontSize('64px');
    cap.glow.setText(label).setColor(THEME_HEX.gold).setFontSize('68px').setAlpha(0.32);
  } else {
    cap.label.setText(label).setColor(THEME_HEX.electricCyan).setFontSize('62px');
    cap.glow.setText(label).setColor(THEME_HEX.electricCyan).setFontSize('66px').setAlpha(0.26);
  }

  const frac =
    phase === 'results' || phase === 'ended'
      ? 0
      : Math.max(0, Math.min(1, remaining / Math.max(1, cap.durationSec)));
  drawTimerCapsule(cap.glass, cap.neon, cap.progress, accent, frac, 0.5);
}

/** Soft pulse + urgency scale — call each frame (cheap). */
export function tickTimerCapsule(cap: TimerCapsuleHandles, time: number): void {
  const t = (time - cap.born) / 1000;
  const urgent = cap.phase === 'running' && cap.remaining <= 10;
  const midUrgent = cap.phase === 'running' && cap.remaining <= 30;
  const speed = urgent ? 5.5 : midUrgent ? 3.2 : 2.2;
  const pulse = 0.5 + Math.sin(t * speed) * 0.5;
  const frac =
    cap.phase === 'results' || cap.phase === 'ended'
      ? 0
      : Math.max(0, Math.min(1, cap.remaining / Math.max(1, cap.durationSec)));
  drawTimerCapsule(cap.glass, cap.neon, cap.progress, cap.accent, frac, pulse);

  if (urgent) {
    const s = 1 + pulse * 0.045;
    cap.root.setScale(s);
    cap.glow.setAlpha(0.35 + pulse * 0.35);
  } else if (midUrgent) {
    cap.root.setScale(1 + pulse * 0.015);
    cap.glow.setAlpha(0.28 + pulse * 0.18);
  } else {
    cap.root.setScale(1);
  }
}
