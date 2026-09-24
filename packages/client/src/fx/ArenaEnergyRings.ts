import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { THEME } from '../theme';

export interface ArenaEnergyRingsOpts {
  /** 0..1 from ArenaScene particleBudget */
  budget?: number;
  phoneLite?: boolean;
  transparent?: boolean;
  /** Last ~30s urgency — slightly faster pulse */
  urgent?: boolean;
}

export interface ArenaEnergyRingsHandles {
  graphics: Phaser.GameObjects.Graphics;
  tick: (timeMs: number, opts?: ArenaEnergyRingsOpts) => void;
  destroy: () => void;
}

type RingSpec = {
  rx: number;
  ry: number;
  color: number;
  baseA: number;
  lw: number;
  phase: number;
  speed: number;
};

/**
 * Animated neon energy rings layered above the static arena floor.
 * Clears + redraws only a few stroke ellipses / arc dashes each tick —
 * never touches the heavy opaque floor Graphics.
 */
export function createArenaEnergyRings(
  scene: Phaser.Scene,
  depth = 1
): ArenaEnergyRingsHandles {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;
  const cx = w * 0.5;
  const cy = h * 0.46;

  const g = scene.add.graphics().setDepth(depth);

  const rings: RingSpec[] = [
    { rx: w * 0.55, ry: h * 0.32, color: THEME.emberOrange, baseA: 0.38, lw: 2.4, phase: 0, speed: 1.05 },
    { rx: w * 0.46, ry: h * 0.27, color: THEME.arenaRed, baseA: 0.3, lw: 1.8, phase: 1.1, speed: 0.85 },
    { rx: w * 0.38, ry: h * 0.22, color: THEME.gold, baseA: 0.34, lw: 2, phase: 2.2, speed: 1.15 },
    { rx: w * 0.28, ry: h * 0.16, color: THEME.lavender, baseA: 0.22, lw: 1.5, phase: 0.6, speed: 0.95 },
    { rx: w * 0.18, ry: h * 0.1, color: THEME.electricCyan, baseA: 0.28, lw: 1.6, phase: 3.0, speed: 1.25 },
  ];

  // Slow-spinning dash arcs on outer + mid rings (cheap polyline segments)
  const dashRings = [
    { rx: w * 0.52, ry: h * 0.3, color: THEME.gold, a: 0.45, lw: 2, segments: 10, arcFrac: 0.12, spin: 0.18 },
    { rx: w * 0.34, ry: h * 0.2, color: THEME.electricCyan, a: 0.4, lw: 1.6, segments: 8, arcFrac: 0.1, spin: -0.28 },
  ];

  let lastDrawMs = -1;
  const MIN_INTERVAL_FULL = 16; // ~60fps max redraw
  const MIN_INTERVAL_LITE = 50; // ~20fps when phoneLite / low budget

  function tick(timeMs: number, opts: ArenaEnergyRingsOpts = {}): void {
    const budget = opts.budget ?? 1;
    const phoneLite = !!opts.phoneLite;
    const transparent = !!opts.transparent;
    const urgent = !!opts.urgent;

    // Skip entirely when budget is too low
    if (budget < 0.25) {
      if (g.alpha !== 0) {
        g.clear();
        g.setAlpha(0);
      }
      return;
    }
    if (g.alpha === 0) g.setAlpha(1);

    const minInterval = phoneLite || budget < 0.45 ? MIN_INTERVAL_LITE : MIN_INTERVAL_FULL;
    if (lastDrawMs >= 0 && timeMs - lastDrawMs < minInterval) return;
    lastDrawMs = timeMs;

    const t = timeMs / 1000;
    const pulseMul = urgent ? 1.55 : 1;
    // Transparent OBS: keep rings visible but subtle (no opaque wash)
    const alphaScale = transparent ? 0.55 : phoneLite ? 0.7 : 1;
    const scaleAmp = phoneLite ? 0.008 : 0.014;

    g.clear();

    // Soft pulsing concentric ellipses
    const ringCount = phoneLite || budget < 0.5 ? 3 : rings.length;
    for (let i = 0; i < ringCount; i++) {
      const r = rings[i]!;
      const pulse = 0.5 + 0.5 * Math.sin(t * r.speed * pulseMul + r.phase);
      const a = (r.baseA * (0.55 + pulse * 0.55)) * alphaScale;
      const s = 1 + (pulse - 0.5) * 2 * scaleAmp;
      g.lineStyle(r.lw, r.color, Math.min(0.85, a));
      g.strokeEllipse(cx, cy, r.rx * 2 * s, r.ry * 2 * s);
    }

    // Gold crown pulse at center (matches static floor motif)
    {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 * pulseMul + 0.3);
      const cr = Math.min(w, h) * (0.045 + pulse * 0.006);
      g.lineStyle(2.2, THEME.gold, (0.4 + pulse * 0.35) * alphaScale);
      g.strokeCircle(cx, cy, cr);
      if (!phoneLite && budget >= 0.5) {
        g.lineStyle(1.2, THEME.emberOrange, (0.25 + pulse * 0.25) * alphaScale);
        g.strokeCircle(cx, cy, cr * 1.35);
      }
    }

    // Occasional rotating dash arcs (skip on phoneLite / very low budget)
    if (!phoneLite && budget >= 0.45) {
      for (const d of dashRings) {
        const spin = t * d.spin * (urgent ? 1.4 : 1);
        const segs = d.segments;
        for (let s = 0; s < segs; s++) {
          const start = spin + (s / segs) * Math.PI * 2;
          const end = start + d.arcFrac * Math.PI * 2;
          strokeEllipseArc(g, cx, cy, d.rx, d.ry, start, end, d.color, d.a * alphaScale, d.lw);
        }
      }
    }
  }

  return {
    graphics: g,
    tick,
    destroy() {
      g.destroy();
    },
  };
}

/** Approximate elliptical arc with short line segments (cheap, no Path API). */
function strokeEllipseArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  color: number,
  alpha: number,
  lw: number
): void {
  const steps = Math.max(4, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 48));
  g.lineStyle(lw, color, alpha);
  let prevX = cx + Math.cos(a0) * rx;
  let prevY = cy + Math.sin(a0) * ry;
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    g.lineBetween(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}
