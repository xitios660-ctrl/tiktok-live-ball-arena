/**
 * Waiting-scene hero balls — glossy Phaser circles + angry face arcs.
 * Procedural only (no photos). King ball gets a tiny gold crown.
 * Clash energy: sparks / impact lines + ember/cyan speed trails.
 */
import Phaser from 'phaser';
import { THEME } from '../theme';
import { drawCrown } from './GlossBall';

export type FaceMood = 'angry' | 'fierce' | 'ko' | 'smirk';

export interface HeroBallSpec {
  x: number;
  y: number;
  r: number;
  color: number;
  mood: FaceMood;
  king?: boolean;
  depth?: number;
  /** Speed trail color (ember for red, cyan for blue) */
  trailColor?: number;
}

export interface HeroBallHandles {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Graphics;
  crown: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Arc;
  trail: Phaser.GameObjects.Graphics | null;
  spec: HeroBallSpec;
  phase: number;
}

export interface ClashFxHandles {
  root: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  sparks: Phaser.GameObjects.Arc[];
  born: number;
}

export function createHeroBall(scene: Phaser.Scene, spec: HeroBallSpec): HeroBallHandles {
  const depth = spec.depth ?? 20;
  const root = scene.add.container(spec.x, spec.y).setDepth(depth);
  const glow = scene.add.circle(0, 0, spec.r * 1.4, spec.color, 0.22);
  const trail = spec.trailColor != null ? scene.add.graphics() : null;
  const body = scene.add.graphics();
  const face = scene.add.graphics();
  const crown = scene.add.graphics().setVisible(!!spec.king);

  paintGlossBall(body, 0, 0, spec.r, spec.color);
  paintFace(face, 0, 0, spec.r, spec.mood);
  if (spec.king) {
    drawCrown(crown, 0, -spec.r - 10, Math.max(0.7, spec.r / 36));
  }

  const kids: Phaser.GameObjects.GameObject[] = [glow];
  if (trail) kids.push(trail);
  kids.push(body, face, crown);
  root.add(kids);
  return { root, body, face, crown, glow, trail, spec, phase: Math.random() * Math.PI * 2 };
}

function paintGlossBall(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(x, y + r * 0.78, r * 1.5, r * 0.38);

  g.fillStyle(color, 1);
  g.fillCircle(x, y, r);

  g.fillStyle(0x000000, 0.22);
  g.fillCircle(x + r * 0.08, y + r * 0.18, r * 0.92);

  g.fillStyle(0xffffff, 0.12);
  g.fillEllipse(x - r * 0.15, y - r * 0.25, r * 1.1, r * 0.7);

  g.fillStyle(0xffffff, 0.55);
  g.fillEllipse(x - r * 0.32, y - r * 0.38, r * 0.45, r * 0.28);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x - r * 0.38, y - r * 0.42, r * 0.1);

  g.lineStyle(2.5, THEME.light, 0.45);
  g.strokeCircle(x, y, r - 1);
}

function paintFace(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, mood: FaceMood): void {
  g.clear();
  const eyeY = y - r * 0.12;
  const eyeGap = r * 0.32;
  const eyeR = r * 0.16;

  if (mood === 'ko') {
    g.lineStyle(3.5, 0x1a1210, 0.95);
    for (const sx of [-1, 1]) {
      const ex = x + sx * eyeGap;
      g.lineBetween(ex - eyeR, eyeY - eyeR, ex + eyeR, eyeY + eyeR);
      g.lineBetween(ex - eyeR, eyeY + eyeR, ex + eyeR, eyeY - eyeR);
    }
    g.lineStyle(3, 0x1a1210, 0.9);
    g.lineBetween(x - r * 0.22, y + r * 0.32, x + r * 0.22, y + r * 0.32);
    return;
  }

  g.fillStyle(0xffffff, 1);
  g.fillCircle(x - eyeGap, eyeY, eyeR);
  g.fillCircle(x + eyeGap, eyeY, eyeR);

  const look = mood === 'fierce' ? 0.35 : 0.2;
  g.fillStyle(0x1a1210, 1);
  g.fillCircle(x - eyeGap + eyeR * look, eyeY + eyeR * 0.1, eyeR * 0.48);
  g.fillCircle(x + eyeGap - eyeR * look, eyeY + eyeR * 0.1, eyeR * 0.48);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x - eyeGap + eyeR * look - 2, eyeY + eyeR * 0.1 - 2, eyeR * 0.14);
  g.fillCircle(x + eyeGap - eyeR * look - 2, eyeY + eyeR * 0.1 - 2, eyeR * 0.14);

  g.lineStyle(Math.max(3, r * 0.08), 0x1a1210, 0.95);
  const browY = eyeY - eyeR * 1.35;
  if (mood === 'smirk') {
    g.lineBetween(x - eyeGap - eyeR, browY + 2, x - eyeGap + eyeR, browY - 2);
    g.lineBetween(x + eyeGap - eyeR, browY - 2, x + eyeGap + eyeR, browY + 2);
  } else {
    g.lineBetween(x - eyeGap - eyeR * 1.1, browY - 2, x - eyeGap + eyeR * 0.9, browY + eyeR * 0.55);
    g.lineBetween(x + eyeGap - eyeR * 0.9, browY + eyeR * 0.55, x + eyeGap + eyeR * 1.1, browY - 2);
  }

  g.lineStyle(Math.max(2.5, r * 0.07), 0x1a1210, 0.95);
  if (mood === 'fierce') {
    g.fillStyle(0x1a1210, 0.95);
    g.fillEllipse(x, y + r * 0.35, r * 0.34, r * 0.22);
    g.fillStyle(THEME.arenaRed, 0.55);
    g.fillEllipse(x, y + r * 0.38, r * 0.2, r * 0.1);
  } else if (mood === 'smirk') {
    g.beginPath();
    g.arc(x + r * 0.05, y + r * 0.28, r * 0.28, 0.15, Math.PI - 0.05, false);
    g.strokePath();
  } else {
    g.beginPath();
    g.arc(x, y + r * 0.42, r * 0.26, Math.PI + 0.3, -0.3, false);
    g.strokePath();
  }
}

/** Clash sparks + impact lines between two points. */
export function createClashFx(
  scene: Phaser.Scene,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  depth = 25
): ClashFxHandles {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const root = scene.add.container(mx, my).setDepth(depth);
  const gfx = scene.add.graphics();
  const sparks: Phaser.GameObjects.Arc[] = [];

  const core = scene.add.circle(0, 0, 18, THEME.light, 0.8);
  const core2 = scene.add.circle(0, 0, 36, THEME.emberOrange, 0.45);
  const core3 = scene.add.circle(0, 0, 56, THEME.arenaRed, 0.2);
  root.add([core3, core2, core, gfx]);

  for (let i = 0; i < 22; i++) {
    const color =
      i % 4 === 0
        ? THEME.gold
        : i % 4 === 1
          ? THEME.emberOrange
          : i % 4 === 2
            ? THEME.arenaRed
            : THEME.light;
    const sp = scene.add.circle(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 50,
      2.5 + Math.random() * 4.5,
      color,
      0.9
    );
    root.add(sp);
    sparks.push(sp);
  }

  return { root, gfx, sparks, born: scene.time.now };
}

export function tickClashFx(fx: ClashFxHandles, time: number): void {
  const t = (time - fx.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 9) * 0.5;
  fx.gfx.clear();

  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + t * 0.8;
    const len = 34 + pulse * 28 + (i % 3) * 10;
    const inward = 6;
    fx.gfx.lineStyle(2.5, i % 2 ? THEME.gold : THEME.emberOrange, 0.5 + pulse * 0.45);
    fx.gfx.lineBetween(Math.cos(a) * inward, Math.sin(a) * inward, Math.cos(a) * len, Math.sin(a) * len);
  }
  // Cyan speed streaks (blue side) + ember (red side)
  fx.gfx.lineStyle(4, THEME.electricCyan, 0.45 + pulse * 0.3);
  fx.gfx.lineBetween(-90, -12, -30, 0);
  fx.gfx.lineBetween(-85, 8, -28, 4);
  fx.gfx.lineBetween(-78, 22, -26, 10);
  fx.gfx.lineStyle(4, THEME.emberOrange, 0.55 + pulse * 0.3);
  fx.gfx.lineBetween(30, -6, 92, -16);
  fx.gfx.lineBetween(26, 4, 88, 12);
  fx.gfx.lineBetween(28, 18, 82, 28);
  fx.gfx.lineStyle(2.5, THEME.arenaRed, 0.4 + pulse * 0.25);
  fx.gfx.lineBetween(22, -18, 78, -28);

  for (let i = 0; i < fx.sparks.length; i++) {
    const sp = fx.sparks[i];
    const ang = t * (2 + (i % 5) * 0.4) + i;
    const rad = 22 + (i % 5) * 12 + pulse * 12;
    sp.setPosition(Math.cos(ang) * rad, Math.sin(ang) * rad);
    sp.setAlpha(0.45 + pulse * 0.5);
  }
}

function paintSpeedTrail(
  g: Phaser.GameObjects.Graphics,
  color: number,
  dir: number,
  r: number,
  pulse: number
): void {
  g.clear();
  // dir: -1 = trail to left (red charging right), +1 = trail to right
  const streaks = 5;
  for (let i = 0; i < streaks; i++) {
    const len = r * (1.1 + i * 0.35) + pulse * 8;
    const yOff = (i - 2) * r * 0.22;
    const a = 0.55 - i * 0.08 + pulse * 0.15;
    g.lineStyle(Math.max(2, 5 - i * 0.7), color, a);
    const x0 = dir * r * 0.55;
    const x1 = dir * (r * 0.55 + len);
    g.lineBetween(x0, yOff, x1, yOff + dir * yOff * 0.15);
  }
  // Soft bloom blob behind ball
  g.fillStyle(color, 0.18 + pulse * 0.1);
  g.fillEllipse(dir * r * 0.9, 0, r * 1.6, r * 0.85);
}

export function tickHeroBall(h: HeroBallHandles, time: number, bobAmp = 4): void {
  const t = time / 1000 + h.phase;
  h.root.setY(h.spec.y + Math.sin(t * 1.8) * bobAmp);
  h.glow.setAlpha(0.14 + (0.5 + Math.sin(t * 3) * 0.5) * 0.16);
  h.glow.setScale(1 + Math.sin(t * 2.4) * 0.05);
  if (h.trail && h.spec.trailColor != null) {
    const pulse = 0.5 + Math.sin(t * 4.5) * 0.5;
    // Red king charges from left → trail left (-1); blue from right → trail right (+1)
    const dir = h.spec.king ? -1 : 1;
    paintSpeedTrail(h.trail, h.spec.trailColor, dir, h.spec.r, pulse);
  }
}

/** Spawn a pack matching waiting-target: king red + blue clash + support cast. */
export function createWaitingHeroPack(
  scene: Phaser.Scene,
  cx: number,
  cy: number
): { balls: HeroBallHandles[]; clash: ClashFxHandles } {
  const balls: HeroBallHandles[] = [
    createHeroBall(scene, {
      x: cx - 115,
      y: cy - 24,
      r: 82,
      color: THEME.arenaRed,
      mood: 'fierce',
      king: true,
      depth: 22,
      trailColor: THEME.emberOrange,
    }),
    createHeroBall(scene, {
      x: cx + 110,
      y: cy + 8,
      r: 72,
      color: 0x3b82f6,
      mood: 'angry',
      depth: 21,
      trailColor: THEME.electricCyan,
    }),
    createHeroBall(scene, {
      x: cx - 220,
      y: cy + 95,
      r: 40,
      color: 0xa855f7,
      mood: 'ko',
      depth: 18,
    }),
    createHeroBall(scene, {
      x: cx + 210,
      y: cy + 75,
      r: 44,
      color: 0x22c55e,
      mood: 'smirk',
      depth: 18,
    }),
    createHeroBall(scene, {
      x: cx + 45,
      y: cy + 125,
      r: 34,
      color: THEME.gold,
      mood: 'angry',
      depth: 17,
    }),
  ];

  const clash = createClashFx(
    scene,
    balls[0].spec.x,
    balls[0].spec.y,
    balls[1].spec.x,
    balls[1].spec.y,
    24
  );
  return { balls, clash };
}
