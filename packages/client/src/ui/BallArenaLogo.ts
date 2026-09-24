/**
 * Ball Arena logo assembly — layered Phaser Graphics + Text.
 * Crown above BALL, gold stars flanking ARENA, glowing ORANGE energy ring / lens flare.
 * Red→orange gradient Bevan text. Reused by WaitingScene + CinematicHud.
 */
import Phaser from 'phaser';
import { THEME, THEME_HEX, FONT_BLACK } from '../theme';

export interface BallArenaLogoHandles {
  root: Phaser.GameObjects.Container;
  rings: Phaser.GameObjects.Graphics;
  flare: Phaser.GameObjects.Graphics;
  crown: Phaser.GameObjects.Graphics;
  starL: Phaser.GameObjects.Graphics;
  starR: Phaser.GameObjects.Graphics;
  ballGlow: Phaser.GameObjects.Text;
  ballMain: Phaser.GameObjects.Text;
  arenaGlow: Phaser.GameObjects.Text;
  arenaMain: Phaser.GameObjects.Text;
  born: number;
  scale: number;
}

export interface BallArenaLogoOpts {
  /** Overall scale (1 = waiting-hero size ~220px tall) */
  scale?: number;
  depth?: number;
  /** Compact HUD variant — smaller rings, single-line feel */
  compact?: boolean;
  showRings?: boolean;
  showFlare?: boolean;
}

export function createBallArenaLogo(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: BallArenaLogoOpts = {}
): BallArenaLogoHandles {
  const scale = opts.scale ?? (opts.compact ? 0.42 : 1);
  const depth = opts.depth ?? 100;
  const showRings = opts.showRings !== false;
  const showFlare = opts.showFlare !== false;
  const compact = !!opts.compact;

  const root = scene.add.container(x, y).setDepth(depth);

  const rings = scene.add.graphics();
  const flare = scene.add.graphics();
  const crown = scene.add.graphics();
  const starL = scene.add.graphics();
  const starR = scene.add.graphics();

  const ballSize = compact ? `${Math.round(28 * (scale / 0.42))}px` : `${Math.round(58 * scale)}px`;
  const arenaSize = compact ? `${Math.round(34 * (scale / 0.42))}px` : `${Math.round(66 * scale)}px`;
  const ballY = compact ? -10 * scale : -28 * scale;
  const arenaY = compact ? 18 * scale : 34 * scale;

  // Deep red outer glow under BALL (red→orange brand)
  const ballGlow = scene.add
    .text(0, ballY + 2 * scale, 'BALL', {
      fontFamily: FONT_BLACK,
      fontSize: ballSize,
      color: THEME_HEX.arenaRed,
      stroke: THEME_HEX.emberOrange,
      strokeThickness: compact ? 10 : 18,
    })
    .setOrigin(0.5)
    .setAlpha(0.55);

  // Face: cream highlight over orange body (reads as red-orange gradient)
  const ballMain = scene.add
    .text(0, ballY, 'BALL', {
      fontFamily: FONT_BLACK,
      fontSize: ballSize,
      color: THEME_HEX.emberOrange,
      stroke: THEME_HEX.arenaDark,
      strokeThickness: compact ? 5 : 9,
    })
    .setOrigin(0.5);

  const ballHi = scene.add
    .text(0, ballY - 1.5 * scale, 'BALL', {
      fontFamily: FONT_BLACK,
      fontSize: ballSize,
      color: THEME_HEX.light,
    })
    .setOrigin(0.5)
    .setAlpha(0.28);

  // ARENA — stronger red outer + orange face
  const arenaGlow = scene.add
    .text(0, arenaY + 3 * scale, 'ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: arenaSize,
      color: THEME_HEX.arenaRed,
      stroke: THEME_HEX.emberOrange,
      strokeThickness: compact ? 12 : 20,
    })
    .setOrigin(0.5)
    .setAlpha(0.65);

  const arenaMain = scene.add
    .text(0, arenaY, 'ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: arenaSize,
      color: THEME_HEX.arenaRed,
      stroke: THEME_HEX.arenaDark,
      strokeThickness: compact ? 5 : 9,
    })
    .setOrigin(0.5);

  // Soft cream/orange highlight on ARENA (gradient illusion)
  const arenaHi = scene.add
    .text(0, arenaY - 1.5 * scale, 'ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: arenaSize,
      color: THEME_HEX.emberOrange,
    })
    .setOrigin(0.5)
    .setAlpha(0.55);

  const arenaCream = scene.add
    .text(0, arenaY - 3 * scale, 'ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: arenaSize,
      color: THEME_HEX.light,
    })
    .setOrigin(0.5)
    .setAlpha(0.18);

  root.add([
    rings,
    flare,
    ballGlow,
    ballMain,
    ballHi,
    arenaGlow,
    arenaMain,
    arenaHi,
    arenaCream,
    crown,
    starL,
    starR,
  ]);

  const handles: BallArenaLogoHandles = {
    root,
    rings,
    flare,
    crown,
    starL,
    starR,
    ballGlow,
    ballMain,
    arenaGlow,
    arenaMain,
    born: scene.time.now,
    scale,
  };

  drawLogoChrome(handles, 0.5, { showRings, showFlare, compact });
  return handles;
}

function drawCrownGfx(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.clear();
  const left = x - 18 * s;
  const right = x + 18 * s;
  const mid = x;
  const baseY = y;

  g.fillStyle(THEME.gold, 0.35);
  g.fillEllipse(mid, baseY + 2 * s, 48 * s, 16 * s);

  g.fillStyle(THEME.gold, 0.98);
  g.fillRoundedRect(left, baseY, 36 * s, 9 * s, 2 * s);
  g.lineStyle(1.2, 0xb8860b, 0.85);
  g.strokeRoundedRect(left, baseY, 36 * s, 9 * s, 2 * s);

  const tips = [
    { x: left + 3 * s, peak: baseY - 16 * s },
    { x: mid, peak: baseY - 24 * s },
    { x: right - 3 * s, peak: baseY - 16 * s },
  ];
  g.fillStyle(THEME.gold, 1);
  for (const t of tips) {
    g.fillTriangle(t.x - 6 * s, baseY + 1, t.x + 6 * s, baseY + 1, t.x, t.peak);
  }
  g.fillStyle(THEME.arenaRed, 0.95);
  g.fillCircle(mid, baseY - 11 * s, 2.8 * s);
  g.fillStyle(THEME.light, 0.95);
  g.fillCircle(left + 5 * s, baseY - 7 * s, 1.8 * s);
  g.fillCircle(right - 5 * s, baseY - 7 * s, 1.8 * s);
  g.fillStyle(THEME.light, 0.7);
  g.fillCircle(mid + 8 * s, baseY - 18 * s, 1.2 * s);
}

function drawStarGfx(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, pulse: number): void {
  g.clear();
  const a = 0.8 + pulse * 0.2;
  g.fillStyle(THEME.gold, a);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push({ x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r });
  }
  for (let i = 0; i < 5; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 2) % 5];
    g.fillTriangle(x, y, p0.x, p0.y, p1.x, p1.y);
  }
  g.fillStyle(THEME.light, 0.55 + pulse * 0.3);
  g.fillCircle(x, y, r * 0.22);
  g.lineStyle(1.5, THEME.emberOrange, 0.55 + pulse * 0.3);
  g.strokeCircle(x, y, r * 0.95);
}

function drawLogoChrome(
  h: BallArenaLogoHandles,
  pulse: number,
  opts: { showRings: boolean; showFlare: boolean; compact: boolean }
): void {
  const s = h.scale;
  const compact = opts.compact;

  const crownY = compact ? -28 * s : -58 * s;
  drawCrownGfx(h.crown, 0, crownY, compact ? s * 0.85 : s * 1.15);

  const starY = compact ? 18 * s : 34 * s;
  const starX = compact ? 108 : 168 * s;
  const starR = compact ? 9 : 14 * s;
  drawStarGfx(h.starL, -starX, starY, starR, pulse);
  drawStarGfx(h.starR, starX, starY, starR, pulse);

  h.rings.clear();
  if (opts.showRings) {
    const baseR = compact ? 70 * (s / 0.42) * 0.42 : 138 * s;
    // ORANGE energy ring stack — primary brand glow (no teal portal tiers)
    const rings = [
      { r: baseR * 1.28, color: THEME.emberOrange, a: 0.12 + pulse * 0.1, w: 2 },
      { r: baseR * 1.1, color: THEME.emberOrange, a: 0.35 + pulse * 0.25, w: 4.5 },
      { r: baseR * 0.95, color: THEME.arenaRed, a: 0.28 + pulse * 0.18, w: 3 },
      { r: baseR * 0.78, color: THEME.gold, a: 0.32 + pulse * 0.22, w: 2 },
      { r: baseR * 0.58, color: THEME.emberOrange, a: 0.18 + pulse * 0.14, w: 1.5 },
    ];
    for (const ring of rings) {
      h.rings.lineStyle(ring.w, ring.color, ring.a);
      h.rings.strokeCircle(0, 4 * s, ring.r);
    }
    // Soft fill bloom inside ring
    h.rings.fillStyle(THEME.emberOrange, 0.04 + pulse * 0.04);
    h.rings.fillCircle(0, 4 * s, baseR * 0.9);
    // Gold arc sweeps (energy streaks)
    h.rings.lineStyle(3, THEME.gold, 0.45 + pulse * 0.3);
    h.rings.beginPath();
    h.rings.arc(0, 4 * s, baseR * 1.14, -1.4, 0.35, false);
    h.rings.strokePath();
    h.rings.lineStyle(2.5, THEME.emberOrange, 0.4 + pulse * 0.25);
    h.rings.beginPath();
    h.rings.arc(0, 4 * s, baseR * 1.02, 1.6, 3.5, false);
    h.rings.strokePath();
    // Tiny spark ticks on the ring
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + pulse * 0.8;
      const rr = baseR * 1.1;
      const sx = Math.cos(ang) * rr;
      const sy = 4 * s + Math.sin(ang) * rr;
      h.rings.fillStyle(THEME.gold, 0.5 + pulse * 0.35);
      h.rings.fillCircle(sx, sy, 2 + (i % 2));
    }
  }

  h.flare.clear();
  if (opts.showFlare) {
    const a = 0.16 + pulse * 0.18;
    h.flare.fillStyle(THEME.emberOrange, a);
    h.flare.fillCircle(0, 0, compact ? 40 : 78 * s);
    h.flare.fillStyle(THEME.arenaRed, a * 0.55);
    h.flare.fillCircle(0, 4 * s, compact ? 28 : 52 * s);
    h.flare.fillStyle(THEME.gold, a * 0.7);
    h.flare.fillCircle(0, -8 * s, compact ? 18 : 34 * s);
    h.flare.fillStyle(THEME.light, a * 0.5);
    h.flare.fillCircle(6 * s, -14 * s, compact ? 6 : 12 * s);
    // Cross lens streaks
    h.flare.lineStyle(2.5, THEME.gold, a * 0.85);
    const streak = compact ? 55 : 100 * s;
    h.flare.lineBetween(-streak, 0, streak, 0);
    h.flare.lineBetween(0, -streak * 0.45, 0, streak * 0.45);
    h.flare.lineStyle(1.5, THEME.emberOrange, a * 0.6);
    h.flare.lineBetween(-streak * 0.7, -streak * 0.25, streak * 0.7, streak * 0.25);
  }
}

/** Soft pulse — call each frame. */
export function tickBallArenaLogo(
  h: BallArenaLogoHandles,
  time: number,
  opts?: { showRings?: boolean; showFlare?: boolean; compact?: boolean }
): void {
  const t = (time - h.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
  h.ballGlow.setAlpha(0.4 + pulse * 0.3);
  h.arenaGlow.setAlpha(0.5 + pulse * 0.3);
  drawLogoChrome(h, pulse, {
    showRings: opts?.showRings !== false,
    showFlare: opts?.showFlare !== false,
    compact: !!opts?.compact,
  });
}
