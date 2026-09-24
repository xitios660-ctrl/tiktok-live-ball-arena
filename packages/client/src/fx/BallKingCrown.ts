/**
 * Cinematic king crown chrome for live balls.
 * Soft gold halo, cream dual-edge, sin pulse, orbit sparks.
 * Client-only; respects particle budget / phoneLite.
 */
import Phaser from 'phaser';
import { THEME } from '../theme';

export interface PaintKingCrownOpts {
  /** Crown tip baseline Y (negative = above ball). */
  y: number;
  scale: number;
  timeMs: number;
  phoneLite?: boolean;
  budget?: number;
}

const CREAM = 0xf2ebd7;
const JEWEL = THEME.coral;

/**
 * Clears + redraws a floating gold crown with neon polish.
 * Skip sparks / heavy pulse when phoneLite or low budget.
 */
export function paintKingCrown(g: Phaser.GameObjects.Graphics, opts: PaintKingCrownOpts): void {
  g.setVisible(true);

  const budget = opts.budget ?? 1;
  const phoneLite = !!opts.phoneLite;
  const t = opts.timeMs / 1000;
  const canPulse = !phoneLite && budget >= 0.25;
  const pulse = canPulse ? 0.5 + 0.5 * Math.sin(t * 2.6) : 0.55;
  const aMul = (phoneLite ? 0.7 : budget < 0.25 ? 0.6 : 1) * (0.78 + pulse * 0.22);
  const s = opts.scale * (1 + (pulse - 0.5) * (phoneLite ? 0.02 : 0.05));
  const x = 0;
  const baseY = opts.y;

  g.clear();

  // Soft outer gold halo behind the crown
  const haloY = baseY - 8 * s;
  g.fillStyle(THEME.gold, 0.1 * aMul);
  g.fillEllipse(x, haloY, 42 * s, 28 * s);
  g.fillStyle(THEME.emberOrange, 0.08 * aMul);
  g.fillEllipse(x, haloY + 2 * s, 28 * s, 18 * s);

  // Soft glow strokes around tips
  g.lineStyle(5, THEME.gold, 0.18 * aMul);
  g.strokeEllipse(x, haloY, 36 * s, 22 * s);
  g.lineStyle(2.5, THEME.emberOrange, 0.22 * aMul);
  g.strokeEllipse(x, haloY, 30 * s, 18 * s);

  const left = x - 16 * s;
  const right = x + 16 * s;
  const mid = x;

  // Band — gold fill + cream/ember dual edge
  g.fillStyle(THEME.gold, 0.96 * aMul);
  g.fillRoundedRect(left, baseY, 32 * s, 8 * s, 2 * s);
  g.lineStyle(1.6, CREAM, 0.55 * aMul);
  g.strokeRoundedRect(left + 0.5 * s, baseY + 0.5 * s, 31 * s, 7 * s, 2 * s);
  g.lineStyle(1.2, THEME.emberOrange, 0.75 * aMul);
  g.strokeRoundedRect(left, baseY, 32 * s, 8 * s, 2 * s);

  // Points
  const tips = [
    { x: left + 2 * s, peak: baseY - 14 * s },
    { x: mid, peak: baseY - 20 * s },
    { x: right - 2 * s, peak: baseY - 14 * s },
  ];
  g.fillStyle(THEME.gold, aMul);
  for (const tip of tips) {
    g.fillTriangle(tip.x - 5 * s, baseY + 1, tip.x + 5 * s, baseY + 1, tip.x, tip.peak);
  }
  // Cream highlight on center tip edge
  g.lineStyle(1.4, CREAM, 0.5 * aMul);
  g.lineBetween(mid - 3 * s, baseY - 2 * s, mid, tips[1].peak + 2 * s);
  g.lineBetween(mid + 3 * s, baseY - 2 * s, mid, tips[1].peak + 2 * s);

  // Jewels with soft glow
  g.fillStyle(JEWEL, 0.35 * aMul);
  g.fillCircle(mid, baseY - 10 * s, 4.2 * s);
  g.fillStyle(JEWEL, 0.95 * aMul);
  g.fillCircle(mid, baseY - 10 * s, 2.5 * s);
  g.fillStyle(CREAM, 0.92 * aMul);
  g.fillCircle(left + 4 * s, baseY - 6 * s, 1.7 * s);
  g.fillCircle(right - 4 * s, baseY - 6 * s, 1.7 * s);

  // Tiny orbiting gold/cream sparks — skip on phoneLite / low budget
  if (!phoneLite && budget >= 0.5) {
    const dots = 3;
    const sparkR = 22 * s;
    const spin = t * 1.45;
    for (let i = 0; i < dots; i++) {
      const a = spin + (i / dots) * Math.PI * 2;
      const sx = Math.cos(a) * sparkR;
      const sy = haloY + Math.sin(a) * sparkR * 0.55;
      const twinkle = 0.45 + 0.55 * Math.sin(t * 5.2 + i * 1.9);
      const c = i % 2 === 0 ? THEME.gold : CREAM;
      g.fillStyle(c, 0.55 * twinkle * aMul);
      g.fillCircle(sx, sy, 1.5 + twinkle * 0.7);
    }
  }
}

export function clearKingCrown(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.setVisible(false);
}
