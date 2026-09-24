/**
 * Cinematic kill / death impact VFX — dark smoke, shockwave rings,
 * ember/gold sparks, floating ELIMINADO / REVANCHE callout.
 * Style-guide: brand/ball-arena/refs. Performance-gated via particleBudget.
 */
import Phaser from 'phaser';
import { THEME, THEME_HEX, FONT_ACCENT } from '../theme';
import { fxScaleFromBudget } from './QualityTier';
import { getOverlayOptions } from '../overlayConfig';

export interface KillImpactOpts {
  revenge?: boolean;
  /** 0..1 particle budget from ArenaScene */
  budget?: number;
}

const DEPTH = 62;
const CALLOUT_DEPTH = 120;

/** Soft dark smoke ellipses drifting up/out and fading. */
function spawnSmoke(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  sizeMul: number
): void {
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * 28;
    const oy = (Math.random() - 0.5) * 18;
    const rx = (18 + Math.random() * 22) * sizeMul;
    const ry = rx * (0.55 + Math.random() * 0.35);
    const puff = scene.add
      .ellipse(x + ox, y + oy, rx, ry, THEME.arenaDark, 0.55 + Math.random() * 0.25)
      .setDepth(DEPTH - 1);
    // Slight stone tint variation
    if (i % 2 === 1) puff.setFillStyle(THEME.stone, 0.5);
    const driftX = (Math.random() - 0.5) * 50;
    const driftY = -36 - Math.random() * 48;
    scene.tweens.add({
      targets: puff,
      x: puff.x + driftX,
      y: puff.y + driftY,
      scaleX: 1.55 + Math.random() * 0.5,
      scaleY: 1.7 + Math.random() * 0.55,
      alpha: 0,
      duration: 520 + Math.random() * 380,
      ease: 'Cubic.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
}

/** Expanding stroke ring (no fill) — Arena Red or Gold. */
function spawnShockwaveRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  startR: number,
  endScale: number,
  duration: number,
  delay: number,
  lineW: number
): void {
  const g = scene.add.graphics().setDepth(DEPTH).setAlpha(0.95);
  g.lineStyle(lineW, color, 1);
  g.strokeCircle(0, 0, startR);
  g.setPosition(x, y);
  scene.tweens.add({
    targets: g,
    scale: endScale,
    alpha: 0,
    delay,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** Brief bright core flash at impact point. */
function spawnCoreFlash(scene: Phaser.Scene, x: number, y: number, sizeMul: number): void {
  const core = scene.add
    .circle(x, y, 14 * sizeMul, THEME.light, 0.92)
    .setDepth(DEPTH + 1);
  const glow = scene.add
    .circle(x, y, 22 * sizeMul, THEME.emberOrange, 0.45)
    .setDepth(DEPTH);
  scene.tweens.add({
    targets: [core, glow],
    scale: 2.2,
    alpha: 0,
    duration: 220,
    ease: 'Quad.easeOut',
    onComplete: () => {
      core.destroy();
      glow.destroy();
    },
  });
}

/**
 * Extra ember/gold sparks (AbilityFx.spawnSparks style — no filters).
 * Kept modest so it complements ArenaScene.spawnHitSparks without double-spam.
 */
function spawnEmberSparks(
  scene: Phaser.Scene,
  x: number,
  y: number,
  n: number,
  sizeMul: number
): void {
  const count = Math.max(0, Math.min(10, n));
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.35;
    const dist = 28 + Math.random() * 48;
    const c = i % 2 === 0 ? THEME.gold : THEME.emberOrange;
    const dot = scene.add
      .circle(x, y, (2.5 + Math.random() * 3.5) * sizeMul, c, 1)
      .setDepth(DEPTH + 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 8,
      alpha: 0,
      scale: 0.25,
      duration: 280 + Math.random() * 200,
      onComplete: () => dot.destroy(),
    });
  }
}

/** Floating cinematic callout — ELIMINADO / REVANCHE. */
function spawnCallout(
  scene: Phaser.Scene,
  x: number,
  y: number,
  revenge: boolean
): void {
  const label = revenge ? 'REVANCHE' : 'ELIMINADO';
  const fill = revenge ? THEME_HEX.gold : THEME_HEX.cream;
  const stroke = revenge ? '#3d2010' : '#0B0B0F';
  const text = scene.add
    .text(x, y - 28, label, {
      fontFamily: FONT_ACCENT,
      fontSize: '44px',
      color: fill,
      stroke,
      strokeThickness: 6,
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(CALLOUT_DEPTH)
    .setAlpha(0)
    .setScale(0.55);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    scale: 1,
    y: y - 52,
    duration: 220,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        y: y - 110,
        alpha: 0,
        duration: 780,
        ease: 'Cubic.easeIn',
        onComplete: () => text.destroy(),
      });
    },
  });
}

/**
 * Play full kill impact at (x, y).
 * Hard-caps particle counts; scales with fxScaleFromBudget.
 */
export function playKillImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: KillImpactOpts = {}
): void {
  const revenge = !!opts.revenge;
  const budget = opts.budget ?? 1;
  const scale = fxScaleFromBudget(budget, getOverlayOptions().phoneLite);

  // Smoke: 2–5 puffs (fewer on low budget)
  const smokeCount = Math.max(2, Math.min(5, Math.round(2 + 3 * scale.dust)));
  spawnSmoke(scene, x, y, smokeCount, scale.sparkSize);

  // Double shockwave rings
  const ringColor = revenge ? THEME.gold : THEME.arenaRed;
  const ringColor2 = revenge ? THEME.emberOrange : THEME.gold;
  spawnShockwaveRing(scene, x, y, ringColor, 12, 5.2, 420, 0, 3.5);
  spawnShockwaveRing(scene, x, y, ringColor2, 10, 4.0, 380, 60, 2.5);

  // Bright core
  spawnCoreFlash(scene, x, y, scale.sparkSize);

  // Modest extra sparks (hit sparks already fire from ArenaScene)
  const sparkN = Math.max(0, Math.min(8, Math.round(4 * scale.sparks)));
  if (sparkN > 0) spawnEmberSparks(scene, x, y, sparkN, scale.sparkSize);

  // Callout always (cheap text tween)
  spawnCallout(scene, x, y, revenge);
}
