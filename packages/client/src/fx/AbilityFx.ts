import Phaser from 'phaser';
import type { AbilityFxEvent } from '@arena/shared';
import { THEME } from '../theme';

/** Adaptive particle budget 0..1 from ArenaScene */
export type FxBudget = number;

/**
 * Lightweight one-shot ability VFX (arcs/circles/tweens only — no filters).
 */
export function playAbilityFx(
  scene: Phaser.Scene,
  event: AbilityFxEvent,
  budget: FxBudget
): void {
  switch (event.ability) {
    case 'lightning_zap':
      spawnLightningBolt(
        scene,
        event.x,
        event.y,
        event.targetX ?? event.x,
        event.targetY ?? event.y,
        !!event.targetId,
        budget
      );
      break;
    case 'magnet_pulse':
      spawnMagnetPulse(scene, event.x, event.y, budget);
      break;
    case 'freeze_aura':
      spawnFreezeBurst(scene, event.x, event.y, budget);
      break;
    case 'dash_burst':
      spawnDashBurst(scene, event.x, event.y, event.targetX, event.targetY, budget);
      break;
    case 'reflect_shield':
      spawnReflectActivate(scene, event.x, event.y);
      break;
    case 'reflect_hit':
      spawnReflectHit(scene, event.x, event.y, event.targetX, event.targetY, budget);
      break;
    case 'weapon_shot':
      spawnWeaponShot(scene, event.x, event.y, event.targetX ?? event.x, event.targetY ?? event.y, budget);
      break;
    case 'weapon_explosion':
    case 'mine_trigger':
      spawnWeaponExplosion(scene, event.x, event.y, event.value ?? 60, budget);
      break;
    case 'heal_pulse':
      spawnSparks(scene, event.x, event.y, THEME.coral, 6, budget);
      break;
    case 'heal_orb':
      spawnHealOrbFlash(scene, event.x, event.y, budget);
      break;
    default:
      if (budget > 0.4) spawnSparks(scene, event.x, event.y, THEME.electricCyan, 6, budget);
      break;
  }
}

function spawnWeaponShot(scene: Phaser.Scene, x: number, y: number, tx: number, ty: number, budget: FxBudget): void {
  const line = scene.add.line(0, 0, x, y, tx, ty, THEME.gold, 0.9).setLineWidth(Math.max(2, 4 * budget)).setDepth(72);
  scene.tweens.add({ targets: line, alpha: 0, duration: 130, onComplete: () => line.destroy() });
  const muzzle = scene.add.circle(x, y, Math.max(6, 12 * budget), THEME.cream, 0.9).setDepth(73);
  scene.tweens.add({ targets: muzzle, scale: 2.1, alpha: 0, duration: 120, onComplete: () => muzzle.destroy() });
  const projectile = scene.add.circle(x, y, Math.max(3, 5 * budget), THEME.gold, 1).setDepth(74);
  scene.tweens.add({ targets: projectile, x: tx, y: ty, duration: 115, ease: 'Cubic.easeIn', onComplete: () => projectile.destroy() });
  spawnSparks(scene, tx, ty, THEME.gold, 4, budget);
}
function spawnWeaponExplosion(scene: Phaser.Scene, x: number, y: number, radius: number, budget: FxBudget): void {
  const r = Math.max(18, radius * .35);
  const flash = scene.add.circle(x, y, r * .5, THEME.cream, .9).setDepth(74);
  scene.tweens.add({ targets: flash, scale: 2.8, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.circle(x, y, r * (0.7 + i * .22), THEME.emberOrange, .16).setStrokeStyle(4 - i, i ? THEME.emberOrange : THEME.gold, .9).setDepth(72);
    scene.tweens.add({ targets: ring, scale: 2.2 + i * .32, alpha: 0, duration: 360 + i * 90, onComplete: () => ring.destroy() });
  }
  spawnSparks(scene, x, y, THEME.emberOrange, 10, budget);
}

/** Soft green heal flash for floor Cura pickup */
function spawnHealOrbFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  budget: FxBudget
): void {
  const ring = scene.add
    .circle(x, y, 28, THEME.sage, 0)
    .setStrokeStyle(3, THEME.sage, 0.95)
    .setDepth(70);
  scene.tweens.add({
    targets: ring,
    scale: 2.4,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
  const glow = scene.add.circle(x, y, 22, THEME.sage, 0.45).setDepth(69);
  scene.tweens.add({
    targets: glow,
    scale: 0.2,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeIn',
    onComplete: () => glow.destroy(),
  });
  spawnSparks(scene, x, y, THEME.sage, 8, budget);
}

export function spawnSparks(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  n: number,
  budget: FxBudget
): void {
  const count = Math.max(1, Math.floor(n * Math.max(0.15, budget)));
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist = 20 + Math.random() * 40;
    const dot = scene.add.circle(x, y, 3 + Math.random() * 4, color, 1).setDepth(70);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 260 + Math.random() * 180,
      onComplete: () => dot.destroy(),
    });
  }
}

/** Floor pickup collected — neon implosion + shock rings + sparks. */
export function playPickupCollectFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  radius = 32,
  budget: FxBudget = 1
): void {
  const r = Math.max(12, radius);
  const depth = 66;
  const b = Math.max(0, Math.min(1, budget));

  // Tiny cream flash at center (collapses with the glow)
  const flash = scene.add.circle(x, y, r * 0.4, THEME.cream, 0.9).setDepth(depth + 2);
  scene.tweens.add({
    targets: flash,
    scale: 0.12,
    alpha: 0,
    duration: 170,
    ease: 'Cubic.easeIn',
    onComplete: () => flash.destroy(),
  });

  // Ability-colored glow collapses inward
  const glow = scene.add.circle(x, y, r * 1.35, color, 0.55).setDepth(depth);
  scene.tweens.add({
    targets: glow,
    scale: 0.06,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.easeIn',
    onComplete: () => glow.destroy(),
  });

  // Shock rings expand + fade (skip on very low budget)
  if (b >= 0.3) {
    const ringCount = b >= 0.7 ? 2 : 1;
    for (let i = 0; i < ringCount; i++) {
      const stroke = i === 0 ? color : THEME.gold;
      const ring = scene.add
        .circle(x, y, r * 0.85, color, 0)
        .setStrokeStyle(2.6 - i * 0.6, stroke, 0.88 - i * 0.18)
        .setDepth(depth + 1);
      scene.tweens.add({
        targets: ring,
        scale: 2.15 + i * 0.4,
        alpha: 0,
        duration: 300 + i * 80,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  // 6–12 colored sparks outward (spawnSparks already scales by budget)
  const sparkN = Math.round(6 + 6 * b);
  spawnSparks(scene, x, y, color, sparkN, b);
}

export function spawnLightningBolt(
  scene: Phaser.Scene,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hasTarget: boolean,
  budget: FxBudget
): void {
  const g = scene.add.graphics().setDepth(70);
  const midX = (x0 + x1) / 2 + (Math.random() - 0.5) * 40;
  const midY = (y0 + y1) / 2 + (Math.random() - 0.5) * 40;
  g.lineStyle(4, THEME.gold, 0.95);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(midX, midY);
  g.lineTo(x1, y1);
  g.strokePath();
  g.lineStyle(2, THEME.cream, 0.9);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(midX + 8, midY - 6);
  g.lineTo(x1, y1);
  g.strokePath();

  const flash = scene.add.circle(x0, y0, 18, THEME.gold, 0.55).setDepth(69);
  scene.tweens.add({
    targets: flash,
    scale: 2.4,
    alpha: 0,
    duration: 180,
    onComplete: () => flash.destroy(),
  });
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: 220,
    onComplete: () => g.destroy(),
  });

  if (hasTarget) {
    spawnSparks(scene, x1, y1, THEME.gold, 12, budget);
    const spark = scene.add.circle(x1, y1, 10, THEME.cream, 0.85).setDepth(71);
    scene.tweens.add({
      targets: spark,
      scale: 2.2,
      alpha: 0,
      duration: 200,
      onComplete: () => spark.destroy(),
    });
  }
}

export function spawnMagnetPulse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  budget: FxBudget
): void {
  const rings = Math.max(2, Math.floor(4 * Math.max(0.25, budget)));
  for (let i = 0; i < rings; i++) {
    const ring = scene.add
      .circle(x, y, 30 + i * 28, THEME.electricCyan, 0)
      .setStrokeStyle(3, THEME.electricCyan, 0.7 - i * 0.12)
      .setDepth(65);
    scene.tweens.add({
      targets: ring,
      scale: 0.25,
      alpha: 0,
      duration: 380 + i * 60,
      ease: 'Cubic.easeIn',
      onComplete: () => ring.destroy(),
    });
  }
  const lines = Math.max(3, Math.floor(8 * Math.max(0.25, budget)));
  for (let i = 0; i < lines; i++) {
    const ang = (Math.PI * 2 * i) / lines;
    const dist = 90 + Math.random() * 50;
    const lx = x + Math.cos(ang) * dist;
    const ly = y + Math.sin(ang) * dist;
    const g = scene.add.graphics().setDepth(64);
    g.lineStyle(2, THEME.electricCyan, 0.7);
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(x, y);
    g.strokePath();
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 320,
      onComplete: () => g.destroy(),
    });
  }
}

export function spawnFreezeBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  budget: FxBudget
): void {
  const ring = scene.add
    .circle(x, y, 40, 0x7dd3fc, 0)
    .setStrokeStyle(4, 0xbae6fd, 0.85)
    .setDepth(66);
  scene.tweens.add({
    targets: ring,
    scale: 2.6,
    alpha: 0,
    duration: 500,
    onComplete: () => ring.destroy(),
  });
  const n = Math.max(2, Math.floor(10 * Math.max(0.25, budget)));
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const flake = scene.add.circle(x, y, 3 + Math.random() * 3, 0xe0f2fe, 0.95).setDepth(67);
    scene.tweens.add({
      targets: flake,
      x: x + Math.cos(ang) * (50 + Math.random() * 70),
      y: y + Math.sin(ang) * (50 + Math.random() * 70),
      alpha: 0,
      duration: 450 + Math.random() * 250,
      onComplete: () => flake.destroy(),
    });
  }
}

export function spawnDashBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tx: number | undefined,
  ty: number | undefined,
  budget: FxBudget
): void {
  const dx = (tx ?? x + 40) - x;
  const dy = (ty ?? y) - y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const ghosts = Math.max(2, Math.floor(5 * Math.max(0.25, budget)));
  for (let i = 0; i < ghosts; i++) {
    const ghost = scene.add
      .circle(x - nx * i * 18, y - ny * i * 18, 22 - i * 3, THEME.emberOrange, 0.35 - i * 0.05)
      .setDepth(62);
    scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.6,
      duration: 280 + i * 40,
      onComplete: () => ghost.destroy(),
    });
  }
  spawnSparks(scene, x, y, THEME.emberOrange, 6, budget);
}

export function spawnReflectActivate(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add
    .circle(x, y, 28, 0xe0e7ff, 0)
    .setStrokeStyle(5, THEME.cream, 0.9)
    .setDepth(68);
  scene.tweens.add({
    targets: ring,
    scale: 2.0,
    alpha: 0,
    duration: 420,
    onComplete: () => ring.destroy(),
  });
}

export function spawnReflectHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tx: number | undefined,
  ty: number | undefined,
  budget: FxBudget
): void {
  const flash = scene.add.circle(x, y, 16, THEME.cream, 0.85).setDepth(72);
  scene.tweens.add({
    targets: flash,
    scale: 2.8,
    alpha: 0,
    duration: 180,
    onComplete: () => flash.destroy(),
  });
  spawnSparks(scene, x, y, 0xe0e7ff, 10, budget);
  if (tx != null && ty != null) {
    const g = scene.add.graphics().setDepth(71);
    g.lineStyle(3, THEME.cream, 0.8);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(tx, ty);
    g.strokePath();
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 160,
      onComplete: () => g.destroy(),
    });
  }
}

export function spawnStrengthSparkles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  budget: FxBudget
): void {
  const n = Math.max(2, Math.floor(8 * Math.max(0.25, budget)));
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n;
    const star = scene.add.circle(x, y, 3, THEME.gold, 1).setDepth(73);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(ang) * 50,
      y: y + Math.sin(ang) * 50 - 20,
      alpha: 0,
      duration: 400,
      onComplete: () => star.destroy(),
    });
  }
}

/** Ongoing buff particles (call from sync). Returns updated lastBuffFxAt. */
export function tickBuffParticles(
  scene: Phaser.Scene,
  opts: {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    radius: number;
    isFreeze: boolean;
    isDash: boolean;
    isStrong: boolean;
    isMagnet?: boolean;
    isReflect?: boolean;
    lastBuffFxAt: number;
    budget: FxBudget;
  }
): number {
  const { budget } = opts;
  if (budget < 0.2) return opts.lastBuffFxAt;
  const now = Date.now();
  const gap = budget >= 1 ? 90 : budget >= 0.5 ? 140 : 220;
  if (now - opts.lastBuffFxAt < gap) return opts.lastBuffFxAt;

  if (opts.isFreeze) {
    const ang = Math.random() * Math.PI * 2;
    const flake = scene.add
      .circle(
        opts.x + Math.cos(ang) * (opts.radius + 8),
        opts.y + Math.sin(ang) * (opts.radius + 8),
        2.5,
        0xbae6fd,
        0.85
      )
      .setDepth(55);
    scene.tweens.add({
      targets: flake,
      y: flake.y - 18,
      alpha: 0,
      duration: 380,
      onComplete: () => flake.destroy(),
    });
    return now;
  }
  // Magnet: orbiting electricCyan dots with slight inward pull
  if (opts.isMagnet && budget >= 0.3) {
    const n = budget >= 0.7 ? 4 : budget >= 0.45 ? 3 : 2;
    const baseAng = ((now / 380) % (Math.PI * 2));
    const orbitR = opts.radius + 12;
    for (let i = 0; i < n; i++) {
      const ang = baseAng + (Math.PI * 2 * i) / n;
      const sx = opts.x + Math.cos(ang) * orbitR;
      const sy = opts.y + Math.sin(ang) * orbitR;
      const dot = scene.add.circle(sx, sy, 2.2 + (i % 2) * 0.6, THEME.electricCyan, 0.9).setDepth(55);
      scene.tweens.add({
        targets: dot,
        x: opts.x + Math.cos(ang) * (orbitR * 0.5),
        y: opts.y + Math.sin(ang) * (orbitR * 0.5),
        alpha: 0,
        duration: 300 + i * 20,
        ease: 'Cubic.easeIn',
        onComplete: () => dot.destroy(),
      });
    }
    return now;
  }
  // Reflect: soft cream/silver shimmer sparks on the ring
  if (opts.isReflect && budget >= 0.3) {
    const ang = Math.random() * Math.PI * 2;
    const ringR = opts.radius + 10;
    const color = Math.random() > 0.45 ? THEME.cream : 0xe0e7ff;
    const spark = scene.add
      .circle(
        opts.x + Math.cos(ang) * ringR,
        opts.y + Math.sin(ang) * ringR,
        2 + Math.random() * 2,
        color,
        0.92
      )
      .setDepth(55);
    scene.tweens.add({
      targets: spark,
      x: spark.x + Math.cos(ang) * 10,
      y: spark.y + Math.sin(ang) * 10,
      alpha: 0,
      scale: 0.35,
      duration: 260 + Math.random() * 80,
      onComplete: () => spark.destroy(),
    });
    return now;
  }
  if (opts.isDash) {
    const ghost = scene.add
      .circle(opts.prevX, opts.prevY, opts.radius * 0.85, THEME.emberOrange, 0.22)
      .setDepth(40);
    scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.7,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
    return now;
  }
  if (opts.isStrong && budget >= 0.5) {
    const p = scene.add.circle(opts.x, opts.y - opts.radius - 6, 2.5, THEME.gold, 0.8).setDepth(55);
    scene.tweens.add({
      targets: p,
      y: p.y - 22,
      alpha: 0,
      duration: 420,
      onComplete: () => p.destroy(),
    });
    return now;
  }
  return opts.lastBuffFxAt;
}

/**
 * Cinematic ball join/respawn portal — cyan/gold rings + vertical beam + sparks.
 * Skip heavy parts when budget < 0.25; simplify on phoneLite via lower budget.
 */
export function playBallSpawnFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  budget: FxBudget = 1,
  opts?: { revenge?: boolean; phoneLite?: boolean }
): void {
  if (budget < 0.2) return;
  const r = Math.max(16, radius);
  const depth = 68;
  const accent = opts?.revenge ? THEME.gold : THEME.electricCyan;
  const secondary = opts?.revenge ? THEME.emberOrange : THEME.gold;
  const lite = !!opts?.phoneLite || budget < 0.45;

  // Soft vertical warp beam
  if (!lite) {
    const beam = scene.add
      .rectangle(x, y, Math.max(10, r * 0.35), r * 4.2, accent, 0.35)
      .setDepth(depth - 2);
    scene.tweens.add({
      targets: beam,
      scaleY: 0.15,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeIn',
      onComplete: () => beam.destroy(),
    });
  }

  // Core cream flash
  const core = scene.add.circle(x, y, r * 0.55, THEME.light, 0.75).setDepth(depth);
  scene.tweens.add({
    targets: core,
    scale: 0.15,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeIn',
    onComplete: () => core.destroy(),
  });

  // Expanding neon rings (portal)
  const ringCount = lite ? 1 : 2;
  for (let i = 0; i < ringCount; i++) {
    const color = i === 0 ? accent : secondary;
    const ring = scene.add
      .circle(x, y, r * 0.7, color, 0)
      .setStrokeStyle(lite ? 3 : 4, color, 0.95)
      .setDepth(depth)
      .setAlpha(0.95);
    scene.tweens.add({
      targets: ring,
      scale: 2.1 + i * 0.35,
      alpha: 0,
      delay: i * 55,
      duration: 420 + i * 80,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  // Soft fill bloom under rings
  const bloom = scene.add.circle(x, y, r * 1.1, accent, 0.28).setDepth(depth - 1);
  scene.tweens.add({
    targets: bloom,
    scale: 1.85,
    alpha: 0,
    duration: 380,
    ease: 'Cubic.easeOut',
    onComplete: () => bloom.destroy(),
  });

  // Outward sparks
  const sparkN = Math.max(4, Math.floor((lite ? 6 : 12) * Math.max(0.35, budget)));
  for (let i = 0; i < sparkN; i++) {
    const ang = (Math.PI * 2 * i) / sparkN + Math.random() * 0.2;
    const dist = r * 1.2 + Math.random() * r * 1.1;
    const c = i % 3 === 0 ? THEME.light : i % 3 === 1 ? secondary : accent;
    const dot = scene.add
      .circle(x, y, 2.5 + Math.random() * 3, c, 1)
      .setDepth(depth + 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist - 8,
      alpha: 0,
      scale: 0.25,
      duration: 320 + Math.random() * 200,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}
