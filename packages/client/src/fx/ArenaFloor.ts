import Phaser from 'phaser';
import { THEME } from '../theme';

const MARGIN = 8;
const CORNER = 28;

/**
 * Glossy cinematic stadium floor — rectangle physics bounds (margin 8), not a circle.
 * Opaque fills + vignette are skipped when transparent (OBS).
 * Visual only — does not change physics bounds / server authority.
 */
export function paintArenaFloor(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  transparent: boolean
): void {
  g.clear();
  if (transparent) return;

  g.fillStyle(THEME.arenaDark, 1);
  g.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.46;

  // Ember glow under center (stadium floodlight mood)
  g.fillStyle(THEME.emberOrange, 0.06);
  g.fillEllipse(cx, cy, w * 0.95, h * 0.42);
  g.fillStyle(THEME.arenaRed, 0.045);
  g.fillEllipse(cx, cy + 40, w * 0.7, h * 0.28);

  // Concentric warm stone ellipses toward center
  const bands: Array<{ rx: number; ry: number; color: number; a: number }> = [
    { rx: w * 0.62, ry: h * 0.38, color: 0x16131a, a: 0.95 },
    { rx: w * 0.5, ry: h * 0.3, color: 0x1e1a16, a: 0.88 },
    { rx: w * 0.38, ry: h * 0.22, color: 0x261f18, a: 0.72 },
    { rx: w * 0.26, ry: h * 0.15, color: 0x2e261c, a: 0.55 },
    { rx: w * 0.16, ry: h * 0.09, color: 0x3a3024, a: 0.4 },
  ];
  for (const b of bands) {
    g.fillStyle(b.color, b.a);
    g.fillEllipse(cx, cy, b.rx * 2, b.ry * 2);
  }

  // Subtle stadium grid (very light — stream-friendly)
  g.lineStyle(1, THEME.steel, 0.12);
  const gridStep = 64;
  for (let x = 40; x < w - 40; x += gridStep) {
    g.lineBetween(x, 80, x, h - 80);
  }
  for (let y = 80; y < h - 80; y += gridStep) {
    g.lineBetween(40, y, w - 40, y);
  }

  // Neon ember / cyan rings
  const rings = [
    { rx: w * 0.52, ry: h * 0.3, color: THEME.emberOrange, a: 0.16 },
    { rx: w * 0.4, ry: h * 0.23, color: THEME.arenaRed, a: 0.14 },
    { rx: w * 0.28, ry: h * 0.16, color: THEME.gold, a: 0.2 },
    { rx: w * 0.16, ry: h * 0.09, color: THEME.electricCyan, a: 0.18 },
  ];
  for (const r of rings) {
    g.lineStyle(1.5, r.color, r.a);
    g.strokeEllipse(cx, cy, r.rx * 2, r.ry * 2);
  }

  // Gold crown circle at center
  g.lineStyle(2.5, THEME.gold, 0.6);
  g.strokeCircle(cx, cy, Math.min(w, h) * 0.048);
  g.fillStyle(THEME.gold, 0.14);
  g.fillCircle(cx, cy, Math.min(w, h) * 0.03);
  g.lineStyle(1, THEME.emberOrange, 0.45);
  g.strokeCircle(cx, cy, Math.min(w, h) * 0.065);

  // Vignette ONLY when not transparent
  g.lineStyle(140, 0x000000, 0.5);
  g.strokeCircle(cx, cy, 980);
  g.lineStyle(180, 0x000000, 0.38);
  g.strokeCircle(cx, cy, 1120);
  g.lineStyle(220, 0x000000, 0.28);
  g.strokeCircle(cx, cy, 1260);
}

/**
 * Rounded gold arena rim (inset ~8px). Urgent = last 30s Arena Red thicker border.
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
    g.lineStyle(7, THEME.arenaRed, 0.95);
    g.strokeRoundedRect(x, y, rw, rh, r);
    g.lineStyle(2.5, THEME.emberOrange, 0.65);
    g.strokeRoundedRect(x + 4, y + 4, rw - 8, rh - 8, r - 4);
    g.lineStyle(1.5, THEME.gold, 0.45);
    g.strokeRoundedRect(x + 8, y + 8, rw - 16, rh - 16, r - 6);
  } else {
    g.lineStyle(4.5, THEME.gold, 0.9);
    g.strokeRoundedRect(x, y, rw, rh, r);
    g.lineStyle(1.5, THEME.light, 0.25);
    g.strokeRoundedRect(x + 3, y + 3, rw - 6, rh - 6, r - 3);
    g.lineStyle(1, THEME.electricCyan, 0.18);
    g.strokeRoundedRect(x + 7, y + 7, rw - 14, rh - 14, r - 5);
  }

  drawDashedRoundedRect(
    g,
    x + 10,
    y + 10,
    rw - 20,
    rh - 20,
    r - 8,
    spin,
    urgent ? THEME.emberOrange : THEME.light,
    urgent ? 0.55 : 0.35
  );
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
  const peri = 2 * (w + h - 2 * r) + 2 * Math.PI * r;
  const dash = 18;
  const gap = 12;
  const period = dash + gap;
  const offset = ((spin % period) + period) % period;

  g.lineStyle(1.75, color, alpha);

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

  let rem = d;
  if (rem <= straightH) return { x: x + r + rem, y };
  rem -= straightH;
  if (rem <= arc) {
    const a = -Math.PI / 2 + rem / r;
    return { x: x + w - r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
  }
  rem -= arc;
  if (rem <= straightV) return { x: x + w, y: y + r + rem };
  rem -= straightV;
  if (rem <= arc) {
    const a = 0 + rem / r;
    return { x: x + w - r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
  }
  rem -= arc;
  if (rem <= straightH) return { x: x + w - r - rem, y: y + h };
  rem -= straightH;
  if (rem <= arc) {
    const a = Math.PI / 2 + rem / r;
    return { x: x + r + Math.cos(a) * r, y: y + h - r + Math.sin(a) * r };
  }
  rem -= arc;
  if (rem <= straightV) return { x, y: y + h - r - rem };
  rem -= straightV;
  const a = Math.PI + rem / r;
  return { x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r };
}
