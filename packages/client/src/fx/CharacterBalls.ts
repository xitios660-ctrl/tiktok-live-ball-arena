/**
 * Waiting-scene hero balls — glossy Phaser circles + angry face arcs.
 * Procedural only (no photos). King ball gets a tiny gold crown.
 * Clash energy: sparks / impact lines between the two mains.
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
}

export interface HeroBallHandles {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Graphics;
  crown: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Arc;
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
  const glow = scene.add.circle(0, 0, spec.r * 1.35, spec.color, 0.18);
  const body = scene.add.graphics();
  const face = scene.add.graphics();
  const crown = scene.add.graphics().setVisible(!!spec.king);

  paintGlossBall(body, 0, 0, spec.r, spec.color);
  paintFace(face, 0, 0, spec.r, spec.mood);
  if (spec.king) {
    drawCrown(crown, 0, -spec.r - 10, Math.max(0.7, spec.r / 36));
  }

  root.add([glow, body, face, crown]);
  return { root, body, face, crown, glow, spec, phase: Math.random() * Math.PI * 2 };
}

function paintGlossBall(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number): void {
  g.clear();
  // Soft contact shadow
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(x, y + r * 0.78, r * 1.5, r * 0.38);

  // Body
  g.fillStyle(color, 1);
  g.fillCircle(x, y, r);

  // Darker lower crescent (shade)
  g.fillStyle(0x000000, 0.22);
  g.fillCircle(x + r * 0.08, y + r * 0.18, r * 0.92);

  // Mid highlight band
  g.fillStyle(0xffffff, 0.12);
  g.fillEllipse(x - r * 0.15, y - r * 0.25, r * 1.1, r * 0.7);

  // Specular blob
  g.fillStyle(0xffffff, 0.55);
  g.fillEllipse(x - r * 0.32, y - r * 0.38, r * 0.45, r * 0.28);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x - r * 0.38, y - r * 0.42, r * 0.1);

  // Cream rim
  g.lineStyle(2.5, THEME.light, 0.45);
  g.strokeCircle(x, y, r - 1);
}

function paintFace(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, mood: FaceMood): void {
  g.clear();
  const eyeY = y - r * 0.12;
  const eyeGap = r * 0.32;
  const eyeR = r * 0.16;

  if (mood === 'ko') {
    // X eyes
    g.lineStyle(3.5, 0x1a1210, 0.95);
    for (const sx of [-1, 1]) {
      const ex = x + sx * eyeGap;
      g.lineBetween(ex - eyeR, eyeY - eyeR, ex + eyeR, eyeY + eyeR);
      g.lineBetween(ex - eyeR, eyeY + eyeR, ex + eyeR, eyeY - eyeR);
    }
    // Flat mouth
    g.lineStyle(3, 0x1a1210, 0.9);
    g.lineBetween(x - r * 0.22, y + r * 0.32, x + r * 0.22, y + r * 0.32);
    return;
  }

  // Whites
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x - eyeGap, eyeY, eyeR);
  g.fillCircle(x + eyeGap, eyeY, eyeR);

  // Pupils (look inward for clash)
  const look = mood === 'fierce' ? 0.35 : 0.2;
  g.fillStyle(0x1a1210, 1);
  g.fillCircle(x - eyeGap + eyeR * look, eyeY + eyeR * 0.1, eyeR * 0.48);
  g.fillCircle(x + eyeGap - eyeR * look, eyeY + eyeR * 0.1, eyeR * 0.48);
  // Spec in pupil
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x - eyeGap + eyeR * look - 2, eyeY + eyeR * 0.1 - 2, eyeR * 0.14);
  g.fillCircle(x + eyeGap - eyeR * look - 2, eyeY + eyeR * 0.1 - 2, eyeR * 0.14);

  // Angry brows
  g.lineStyle(Math.max(3, r * 0.08), 0x1a1210, 0.95);
  const browY = eyeY - eyeR * 1.35;
  if (mood === 'smirk') {
    g.lineBetween(x - eyeGap - eyeR, browY + 2, x - eyeGap + eyeR, browY - 2);
    g.lineBetween(x + eyeGap - eyeR, browY - 2, x + eyeGap + eyeR, browY + 2);
  } else {
    // /\ angry
    g.lineBetween(x - eyeGap - eyeR * 1.1, browY - 2, x - eyeGap + eyeR * 0.9, browY + eyeR * 0.55);
    g.lineBetween(x + eyeGap - eyeR * 0.9, browY + eyeR * 0.55, x + eyeGap + eyeR * 1.1, browY - 2);
  }

  // Mouth
  g.lineStyle(Math.max(2.5, r * 0.07), 0x1a1210, 0.95);
  if (mood === 'fierce') {
    // Open shout — small ellipse
    g.fillStyle(0x1a1210, 0.95);
    g.fillEllipse(x, y + r * 0.35, r * 0.34, r * 0.22);
    g.fillStyle(THEME.arenaRed, 0.55);
    g.fillEllipse(x, y + r * 0.38, r * 0.2, r * 0.1);
  } else if (mood === 'smirk') {
    g.beginPath();
    g.arc(x + r * 0.05, y + r * 0.28, r * 0.28, 0.15, Math.PI - 0.05, false);
    g.strokePath();
  } else {
    // Angry grit line
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

  // Impact flash core
  const core = scene.add.circle(0, 0, 14, THEME.light, 0.7);
  const core2 = scene.add.circle(0, 0, 28, THEME.emberOrange, 0.35);
  root.add([core2, core, gfx]);

  for (let i = 0; i < 14; i++) {
    const color = i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : THEME.arenaRed;
    const sp = scene.add.circle(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      2 + Math.random() * 3.5,
      color,
      0.85
    );
    root.add(sp);
    sparks.push(sp);
  }

  return { root, gfx, sparks, born: scene.time.now };
}

export function tickClashFx(fx: ClashFxHandles, time: number): void {
  const t = (time - fx.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 8) * 0.5;
  fx.gfx.clear();

  // Impact lines radiating
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + t * 0.6;
    const len = 28 + pulse * 22 + (i % 3) * 8;
    const inward = 8;
    fx.gfx.lineStyle(2.2, i % 2 ? THEME.gold : THEME.emberOrange, 0.45 + pulse * 0.4);
    fx.gfx.lineBetween(Math.cos(a) * inward, Math.sin(a) * inward, Math.cos(a) * len, Math.sin(a) * len);
  }
  // Cyan speed streaks left/right
  fx.gfx.lineStyle(3, THEME.electricCyan, 0.35 + pulse * 0.25);
  fx.gfx.lineBetween(-70, -8, -28, 2);
  fx.gfx.lineBetween(-65, 10, -24, 4);
  fx.gfx.lineStyle(3, THEME.arenaRed, 0.4 + pulse * 0.25);
  fx.gfx.lineBetween(28, -4, 72, -12);
  fx.gfx.lineBetween(24, 6, 68, 14);

  for (let i = 0; i < fx.sparks.length; i++) {
    const sp = fx.sparks[i];
    const ang = t * (1.5 + (i % 5) * 0.3) + i;
    const rad = 18 + (i % 4) * 10 + pulse * 8;
    sp.setPosition(Math.cos(ang) * rad, Math.sin(ang) * rad);
    sp.setAlpha(0.4 + pulse * 0.5);
  }
}

export function tickHeroBall(h: HeroBallHandles, time: number, bobAmp = 4): void {
  const t = time / 1000 + h.phase;
  h.root.setY(h.spec.y + Math.sin(t * 1.8) * bobAmp);
  h.glow.setAlpha(0.12 + (0.5 + Math.sin(t * 3) * 0.5) * 0.14);
  h.glow.setScale(1 + Math.sin(t * 2.4) * 0.04);
}

/** Spawn a pack matching waiting-mock: king red + blue clash + support cast. */
export function createWaitingHeroPack(
  scene: Phaser.Scene,
  cx: number,
  cy: number
): { balls: HeroBallHandles[]; clash: ClashFxHandles } {
  const balls: HeroBallHandles[] = [
    createHeroBall(scene, {
      x: cx - 110,
      y: cy - 20,
      r: 78,
      color: THEME.arenaRed,
      mood: 'fierce',
      king: true,
      depth: 22,
    }),
    createHeroBall(scene, {
      x: cx + 105,
      y: cy + 10,
      r: 68,
      color: 0x3b82f6,
      mood: 'angry',
      depth: 21,
    }),
    createHeroBall(scene, {
      x: cx - 210,
      y: cy + 90,
      r: 38,
      color: 0xa855f7,
      mood: 'ko',
      depth: 18,
    }),
    createHeroBall(scene, {
      x: cx + 200,
      y: cy + 70,
      r: 42,
      color: 0x22c55e,
      mood: 'smirk',
      depth: 18,
    }),
    createHeroBall(scene, {
      x: cx + 40,
      y: cy + 120,
      r: 32,
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
