import Phaser from 'phaser';
import { THEME } from '../theme';

export type ShieldChromeMode = 'off' | 'donut' | 'reflect';

export interface PaintBallShieldOpts {
  radius: number;
  mode: ShieldChromeMode;
  timeMs: number;
  phoneLite?: boolean;
  budget?: number;
}

const CREAM_SILVER = 0xe0e7ff;
const DONUT_ORANGE = 0xff9f1c;

/**
 * Cinematic Donut / reflect shield chrome for a ball.
 * Clears + redraws a few cheap strokes each call (same pattern as ArenaEnergyRings).
 * Layer under ball gloss/avatar; caller owns Graphics lifetime in the ball container.
 */
export function paintBallShield(g: Phaser.GameObjects.Graphics, opts: PaintBallShieldOpts): void {
  const mode = opts.mode;
  if (mode === 'off') {
    g.clear();
    g.setVisible(false);
    return;
  }
  g.setVisible(true);

  const budget = opts.budget ?? 1;
  const phoneLite = !!opts.phoneLite;
  const t = opts.timeMs / 1000;
  const baseR = mode === 'reflect' ? opts.radius + 12 : opts.radius + 8;

  // Soft sin pulse — skip / reduce when phoneLite or very low budget
  const canPulse = !phoneLite && budget >= 0.25;
  const pulse = canPulse ? 0.5 + 0.5 * Math.sin(t * 2.4 + (mode === 'reflect' ? 1.2 : 0)) : 0.5;
  const alphaScale = phoneLite ? 0.65 : budget < 0.25 ? 0.55 : 1;
  const scaleAmp = phoneLite ? 0.01 : 0.022;
  const r = baseR * (1 + (pulse - 0.5) * 2 * scaleAmp);
  const aMul = alphaScale * (0.75 + pulse * 0.25);

  const outer = mode === 'reflect' ? CREAM_SILVER : THEME.gold;
  const mid = mode === 'reflect' ? THEME.lavender : DONUT_ORANGE;
  const inner = mode === 'reflect' ? CREAM_SILVER : THEME.emberOrange;
  const spin = t * (mode === 'reflect' ? 1.55 : 0.95);

  g.clear();

  // Outer soft glow ring (low alpha ellipse-ish circle)
  g.lineStyle(7, outer, 0.14 * aMul);
  g.strokeCircle(0, 0, r + 5);
  g.lineStyle(4.5, mid, 0.22 * aMul);
  g.strokeCircle(0, 0, r + 2.5);

  // Double ring: thicker outer + thin inner
  g.lineStyle(mode === 'reflect' ? 3.6 : 3.2, outer, 0.82 * aMul);
  g.strokeCircle(0, 0, r);
  g.lineStyle(1.4, inner, 0.7 * aMul);
  g.strokeCircle(0, 0, r - 4.5);

  // Rotating dashed / segmented arc (skip on phoneLite / low budget)
  if (!phoneLite && budget >= 0.25) {
    const segs = budget >= 0.5 ? 8 : 6;
    const arcFrac = 0.085;
    const dashColor = mode === 'reflect' ? THEME.lavender : THEME.gold;
    for (let s = 0; s < segs; s++) {
      const start = spin + (s / segs) * Math.PI * 2;
      const end = start + arcFrac * Math.PI * 2;
      strokeCircleArc(g, 0, 0, r + 1.5, start, end, dashColor, 0.75 * aMul, 2);
    }
  }

  // Tiny orbiting spark dots — only when budget healthy
  if (!phoneLite && budget >= 0.5) {
    const dots = mode === 'reflect' ? 4 : 3;
    const sparkR = r + 7;
    const sparkColor = mode === 'reflect' ? CREAM_SILVER : THEME.gold;
    for (let i = 0; i < dots; i++) {
      const a = spin * 1.35 + (i / dots) * Math.PI * 2;
      const x = Math.cos(a) * sparkR;
      const y = Math.sin(a) * sparkR;
      const twinkle = 0.45 + 0.55 * Math.sin(t * 5.5 + i * 1.7);
      g.fillStyle(sparkColor, 0.55 * twinkle * aMul);
      g.fillCircle(x, y, 1.6 + twinkle * 0.6);
    }
  }
}

/** Approximate circular arc with short line segments (cheap, no Path API). */
function strokeCircleArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  color: number,
  alpha: number,
  lw: number
): void {
  const steps = Math.max(3, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 36));
  g.lineStyle(lw, color, alpha);
  let prevX = cx + Math.cos(a0) * radius;
  let prevY = cy + Math.sin(a0) * radius;
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    g.lineBetween(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}
