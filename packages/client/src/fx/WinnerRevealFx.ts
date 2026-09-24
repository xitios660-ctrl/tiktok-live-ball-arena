/**
 * Cinematic REI DA ARENA / results card reveal.
 * Soft gold/cyan halo, rotating dash arcs, entrance pop + spark burst.
 * Client-only; respects particle budget / phoneLite.
 */
import Phaser from 'phaser';
import { THEME } from '../theme';

export interface WinnerRevealHandles {
  chrome: Phaser.GameObjects.Graphics;
  w: number;
  h: number;
  active: boolean;
}

export interface WinnerRevealTickOpts {
  budget?: number;
  phoneLite?: boolean;
}

/** Graphics child for the winner panel (drawn behind the static frame). */
export function createWinnerRevealChrome(
  scene: Phaser.Scene,
  w = 860,
  h = 700
): WinnerRevealHandles {
  const chrome = scene.add.graphics();
  return { chrome, w, h, active: false };
}

/** Clear + redraw pulsing outer neon + optional dash arcs. Call each frame while results. */
export function tickWinnerReveal(
  handles: WinnerRevealHandles,
  timeMs: number,
  opts: WinnerRevealTickOpts = {}
): void {
  if (!handles.active) {
    handles.chrome.clear();
    return;
  }

  const budget = opts.budget ?? 1;
  const phoneLite = !!opts.phoneLite;
  if (budget < 0.2) {
    handles.chrome.clear();
    return;
  }

  const g = handles.chrome;
  const hw = handles.w / 2;
  const hh = handles.h / 2;
  const t = timeMs / 1000;
  const canPulse = !phoneLite && budget >= 0.25;
  const pulse = canPulse ? 0.5 + 0.5 * Math.sin(t * 2.1) : 0.55;
  const aMul = (phoneLite ? 0.55 : budget < 0.35 ? 0.5 : 1) * (0.7 + pulse * 0.3);
  const expand = phoneLite ? 0 : (pulse - 0.5) * 10;

  g.clear();

  // Soft outer gold glow (rounded rect strokes)
  const ox = -hw - 10 - expand * 0.4;
  const oy = -hh - 10 - expand * 0.4;
  const ow = handles.w + 20 + expand * 0.8;
  const oh = handles.h + 20 + expand * 0.8;
  g.lineStyle(10, THEME.gold, 0.12 * aMul);
  g.strokeRoundedRect(ox, oy, ow, oh, 34);
  g.lineStyle(5, THEME.emberOrange, 0.18 * aMul);
  g.strokeRoundedRect(ox + 4, oy + 4, ow - 8, oh - 8, 30);
  g.lineStyle(2.5, THEME.electricCyan, 0.28 * aMul);
  g.strokeRoundedRect(-hw - 4, -hh - 4, handles.w + 8, handles.h + 8, 30);

  // Rotating dashed corner arcs — skip on phoneLite / low budget
  if (!phoneLite && budget >= 0.35) {
    const spin = t * 0.85;
    const segs = budget >= 0.6 ? 10 : 6;
    const r = Math.min(hw, hh) + 18 + expand * 0.3;
    for (let s = 0; s < segs; s++) {
      const start = spin + (s / segs) * Math.PI * 2;
      const end = start + 0.07 * Math.PI * 2;
      const color = s % 2 === 0 ? THEME.gold : THEME.electricCyan;
      strokeCircleArc(g, 0, 0, r, start, end, color, 0.65 * aMul, 2.2);
    }
  }

  // Orbit sparks when budget healthy
  if (!phoneLite && budget >= 0.5) {
    const dots = 5;
    const sparkR = Math.min(hw, hh) + 28 + expand * 0.35;
    for (let i = 0; i < dots; i++) {
      const a = t * 1.1 + (i / dots) * Math.PI * 2;
      const sx = Math.cos(a) * sparkR;
      const sy = Math.sin(a) * sparkR * 0.92;
      const c = i % 2 === 0 ? THEME.gold : THEME.light;
      g.fillStyle(c, 0.55 + pulse * 0.35);
      g.fillCircle(sx, sy, 2.4 + (i % 3) * 0.6);
    }
  }
}

/**
 * One-shot entrance burst at world coords (panel center).
 * Gold/cream rings + sparks; light when phoneLite / low budget.
 */
export function burstWinnerReveal(
  scene: Phaser.Scene,
  x: number,
  y: number,
  budget = 1,
  phoneLite = false
): void {
  if (budget < 0.2) return;
  const lite = phoneLite || budget < 0.4;
  const depth = 395;

  // Soft full-card flash
  const flash = scene.add.circle(x, y, 90, THEME.light, 0.55).setDepth(depth);
  scene.tweens.add({
    targets: flash,
    scale: lite ? 3.2 : 5.5,
    alpha: 0,
    duration: lite ? 320 : 520,
    ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy(),
  });

  const rings = lite ? 1 : 2;
  for (let i = 0; i < rings; i++) {
    const color = i === 0 ? THEME.gold : THEME.electricCyan;
    const ring = scene.add
      .circle(x, y, 40, color, 0)
      .setStrokeStyle(lite ? 3 : 4.5, color, 0.95)
      .setDepth(depth)
      .setAlpha(0.95);
    scene.tweens.add({
      targets: ring,
      scale: 4.2 + i * 0.8,
      alpha: 0,
      delay: i * 60,
      duration: 480 + i * 90,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  const n = lite ? 8 : Math.max(10, Math.floor(18 * budget));
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.25;
    const dist = 80 + Math.random() * (lite ? 90 : 160);
    const c = i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : THEME.light;
    const dot = scene.add
      .circle(x, y, 3 + Math.random() * 4, c, 1)
      .setDepth(depth + 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - (lite ? 20 : 40),
      alpha: 0,
      scale: 0.25,
      duration: 420 + Math.random() * 280,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

function strokeCircleArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  color: number,
  alpha: number,
  width: number
): void {
  const steps = Math.max(4, Math.ceil(((end - start) / (Math.PI * 2)) * 48));
  g.lineStyle(width, color, alpha);
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}
