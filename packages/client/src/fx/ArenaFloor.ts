import Phaser from 'phaser';
import { THEME } from '../theme';

const MARGIN = 8;
const CORNER = 28;

/**
 * Warm glossy arena floor — rectangle physics bounds (margin 8), not a circle.
 * Opaque fills + vignette are skipped when transparent (OBS).
 */
export function paintArenaFloor(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  transparent: boolean
): void {
  g.clear();
  if (transparent) return;

  g.fillStyle(THEME.ink, 1);
  g.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.46;

  // Concentric warm ellipses toward center
  const bands: Array<{ rx: number; ry: number; color: number; a: number }> = [
    { rx: w * 0.62, ry: h * 0.38, color: 0x1c1712, a: 0.95 },
    { rx: w * 0.5, ry: h * 0.3, color: 0x241e18, a: 0.85 },
    { rx: w * 0.38, ry: h * 0.22, color: 0x2c241c, a: 0.7 },
    { rx: w * 0.26, ry: h * 0.15, color: 0x352b21, a: 0.55 },
    { rx: w * 0.16, ry: h * 0.09, color: 0x3d3226, a: 0.4 },
  ];
  for (const b of bands) {
    g.fillStyle(b.color, b.a);
    g.fillEllipse(cx, cy, b.rx * 2, b.ry * 2);
  }

  // Thin cream rings
  const rings = [
    { rx: w * 0.48, ry: h * 0.28, a: 0.14 },
    { rx: w * 0.34, ry: h * 0.19, a: 0.18 },
    { rx: w * 0.2, ry: h * 0.11, a: 0.22 },
  ];
  for (const r of rings) {
    g.lineStyle(1.25, THEME.cream, r.a);
    g.strokeEllipse(cx, cy, r.rx * 2, r.ry * 2);
  }

  // Gold circle at center
  g.lineStyle(2, THEME.gold, 0.55);
  g.strokeCircle(cx, cy, Math.min(w, h) * 0.045);
  g.fillStyle(THEME.gold, 0.12);
  g.fillCircle(cx, cy, Math.min(w, h) * 0.028);

  // Vignette ONLY when not transparent
  g.lineStyle(140, 0x000000, 0.45);
  g.strokeCircle(cx, cy, 980);
  g.lineStyle(180, 0x000000, 0.35);
  g.strokeCircle(cx, cy, 1120);
  g.lineStyle(220, 0x000000, 0.25);
  g.strokeCircle(cx, cy, 1260);
}

/**
 * Rounded gold arena rim (inset ~8px). Urgent = last 30s coral thicker border.
 * Inner cream dashed stroke advances with `spin`.
 */
export function paintArenaRim(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  spin: number,
  urgent: boolean
): void {
  g.clear();

  const x = MARGIN;
  const y = MARGIN;
  const rw = w - MARGIN * 2;
  const rh = h - MARGIN * 2;
  const r = CORNER;

  if (urgent) {
    g.lineStyle(7, THEME.coral, 0.95);
    g.strokeRoundedRect(x, y, rw, rh, r);
    g.lineStyle(2.5, THEME.gold, 0.55);
    g.strokeRoundedRect(x + 4, y + 4, rw - 8, rh - 8, r - 4);
  } else {
    g.lineStyle(4.5, THEME.gold, 0.9);
    g.strokeRoundedRect(x, y, rw, rh, r);
    g.lineStyle(1.5, THEME.cream, 0.25);
    g.strokeRoundedRect(x + 3, y + 3, rw - 6, rh - 6, r - 3);
  }

  // Inner cream dashed stroke that advances with spin
  drawDashedRoundedRect(g, x + 10, y + 10, rw - 20, rh - 20, r - 8, spin, THEME.cream, urgent ? 0.55 : 0.35);
}

function drawDashedRoundedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  spin: number,
  color: number,
  alpha: number
): void {
  const r = Math.max(4, Math.min(radius, Math.min(w, h) / 2));
  const peri =
    2 * (w + h - 2 * r) + 2 * Math.PI * r;
  const dash = 18;
  const gap = 12;
  const period = dash + gap;
  const offset = ((spin % period) + period) % period;

  g.lineStyle(1.75, color, alpha);

  // Sample along perimeter
  const steps = Math.max(80, Math.floor(peri / 6));
  let drawing = false;
  let prevX = 0;
  let prevY = 0;

  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * peri;
    const local = (d + offset) % period;
    const on = local < dash;
    const p = pointOnRoundedRect(x, y, w, h, r, d, peri);
    if (on) {
      if (!drawing) {
        drawing = true;
        prevX = p.x;
        prevY = p.y;
      } else {
        g.lineBetween(prevX, prevY, p.x, p.y);
        prevX = p.x;
        prevY = p.y;
      }
    } else {
      drawing = false;
    }
  }
}

function pointOnRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  dist: number,
  peri: number
): { x: number; y: number } {
  const d = ((dist % peri) + peri) % peri;
  const straightH = w - 2 * r;
  const straightV = h - 2 * r;
  const arc = (Math.PI / 2) * r;

  // Top edge L→R
  let rem = d;
  if (rem <= straightH) return { x: x + r + rem, y };
  rem -= straightH;
  // Top-right arc
  if (rem <= arc) {
    const a = -Math.PI / 2 + rem / r;
    return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
  }
  rem -= arc;
  // Right edge T→B
  if (rem <= straightV) return { x: x + w, y: y + r + rem };
  rem -= straightV;
  // Bottom-right arc
  if (rem <= arc) {
    const a = 0 + rem / r;
    return { x: x + w - r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
  }
  rem -= arc;
  // Bottom edge R→L
  if (rem <= straightH) return { x: x + w - r - rem, y: y + h };
  rem -= straightH;
  // Bottom-left arc
  if (rem <= arc) {
    const a = Math.PI / 2 + rem / r;
    return { x: x + r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
  }
  rem -= arc;
  // Left edge B→T
  if (rem <= straightV) return { x, y: y + h - r - rem };
  rem -= straightV;
  // Top-left arc
  const a = Math.PI + rem / r;
  return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
}
