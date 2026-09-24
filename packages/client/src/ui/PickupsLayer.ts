/**
 * Arena floor pickups — cinematic neon idle chrome, emoji bob, color-coded glow.
 * Perf-safe: one container per pickup; Graphics chrome redrawn cheaply in tick().
 * Collect: cinematic implosion VFX when a pickup leaves the snapshot.
 */
import Phaser from 'phaser';
import {
  PICKUP_META,
  type PickupState,
  type PickupAbilityKey,
} from '@arena/shared';
import { THEME, FONT_BLACK } from '../theme';
import { playPickupCollectFx } from '../fx/AbilityFx';

const GLOW: Record<PickupAbilityKey, number> = {
  lightning_zap: THEME.gold,
  magnet_pulse: THEME.electricCyan,
  freeze_aura: 0x7fe9ff,
  dash_burst: THEME.arenaRed,
  reflect_shield: 0xd0d6e0,
  heal_orb: THEME.sage,
};

const CREAM_GOLD = THEME.cream;

interface PickupView {
  root: Phaser.GameObjects.Container;
  halo: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  /** Solid fallback rings (visible when budget too low for Graphics chrome) */
  ring: Phaser.GameObjects.Arc;
  ring2: Phaser.GameObjects.Arc;
  /** Cinematic dashed arcs + orbit sparks (budget-gated) */
  chrome: Phaser.GameObjects.Graphics;
  emoji: Phaser.GameObjects.Text;
  ability: PickupAbilityKey;
  color: number;
  radius: number;
  born: number;
}

export class PickupsLayer {
  private layer: Phaser.GameObjects.Container;
  private views = new Map<string, PickupView>();
  private scene: Phaser.Scene;
  private budget = 1;
  /** Counter-rotation used by phone landscape presentation. */
  private presentationRotation = 0;

  constructor(scene: Phaser.Scene, depth = 8) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setDepth(depth);
  }

  /** Keep pickup emoji/chrome upright when the whole canvas is CSS-rotated. */
  setPresentationRotation(rotation: number): void {
    this.presentationRotation = rotation;
    for (const view of this.views.values()) view.root.setRotation(rotation);
  }

  /** Adaptive particle budget 0..1 from ArenaScene */
  setBudget(n: number): void {
    this.budget = Math.max(0, Math.min(1, n));
  }

  sync(pickups: PickupState[] | undefined): void {
    const list = pickups || [];
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let view = this.views.get(p.id);
      if (!view) {
        view = this.createView(p);
        this.views.set(p.id, view);
        this.layer.add(view.root);
      } else {
        view.root.setPosition(p.x, p.y);
      }
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        const color = GLOW[view.ability] ?? THEME.gold;
        playPickupCollectFx(
          this.scene,
          view.root.x,
          view.root.y,
          color,
          view.radius,
          this.budget
        );
        view.root.destroy(true);
        this.views.delete(id);
      }
    }
  }

  /** Call from scene.update for bob / orbit / chrome animation */
  tick(time: number): void {
    const budget = this.budget;
    const fancy = budget >= 0.25;
    const sparks = budget >= 0.5;

    for (const view of this.views.values()) {
      const t = (time - view.born) / 1000;
      const bob = Math.sin(t * 3.2) * 4;
      view.emoji.setY(bob);

      // Soft sin pulse on outer halo + inner glow
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const scaleAmp = budget < 0.25 ? 0.06 : 0.1;
      view.halo.setScale(1 + (pulse - 0.5) * 2 * scaleAmp * 1.2);
      view.halo.setAlpha(0.12 + pulse * 0.1);
      view.glow.setScale(1 + Math.sin(t * 2.4) * 0.12);
      view.glow.setAlpha(0.28 + Math.sin(t * 2.4) * 0.12);

      if (fancy) {
        // Hide solid Arc rings; Graphics owns dual + dashed chrome
        view.ring.setVisible(false);
        view.ring2.setVisible(false);
        view.chrome.setVisible(true);
        paintPickupChrome(view.chrome, {
          radius: view.radius,
          color: view.color,
          timeMs: time - view.born,
          budget,
          sparks,
        });
      } else {
        // Low budget: simple solid rings only
        view.chrome.clear();
        view.chrome.setVisible(false);
        view.ring.setVisible(true);
        view.ring2.setVisible(true);
        view.ring.setRotation(t * 1.6);
        view.ring2.setRotation(-t * 1.1);
        const ringPulse = 1 + Math.sin(t * 4) * 0.09;
        view.ring.setScale(ringPulse);
        view.ring2.setScale(1.18 - (ringPulse - 1));
      }
    }
  }

  clear(): void {
    for (const view of this.views.values()) view.root.destroy(true);
    this.views.clear();
  }

  private createView(p: PickupState): PickupView {
    const color = GLOW[p.ability] ?? THEME.gold;
    const meta = PICKUP_META[p.ability];
    const root = this.scene.add.container(p.x, p.y).setRotation(this.presentationRotation);

    // Soft outer neon halo (larger, lower alpha) under glow
    const halo = this.scene.add.circle(0, 0, p.radius * 2.55, color, 0.16);
    const glow = this.scene.add.circle(0, 0, p.radius * 1.7, color, 0.38);
    const disc = this.scene.add.circle(0, 0, p.radius, THEME.stone, 0.78);
    disc.setStrokeStyle(2.5, color, 0.95);

    // Solid fallback rings (used when budget < 0.25)
    const ring = this.scene.add.circle(0, 0, p.radius + 7, color, 0);
    ring.setStrokeStyle(2.75, color, 0.9);
    const ring2 = this.scene.add.circle(0, 0, p.radius + 16, color, 0);
    ring2.setStrokeStyle(1.5, THEME.gold, 0.4);

    const chrome = this.scene.add.graphics();

    const emoji = this.scene.add
      .text(0, 0, meta?.emoji || '✦', {
        fontFamily: FONT_BLACK,
        fontSize: `${Math.round(p.radius * 1.35)}px`,
      })
      .setOrigin(0.5);

    root.add([halo, glow, disc, ring, ring2, chrome, emoji]);

    // Brief spawn pop: scale 0.6→1, alpha fade-in ~220ms
    root.setScale(0.6);
    root.setAlpha(0);
    this.scene.tweens.add({
      targets: root,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });

    return {
      root,
      halo,
      glow,
      ring,
      ring2,
      chrome,
      emoji,
      ability: p.ability,
      color,
      radius: p.radius,
      born: this.scene.time.now,
    };
  }
}

interface PaintPickupChromeOpts {
  radius: number;
  color: number;
  timeMs: number;
  budget: number;
  sparks: boolean;
}

/**
 * Dual rings + rotating dashed ability arc + cream/gold reflect arc + optional sparks.
 * Same cheap stroke-arc spirit as BallShieldChrome / ArenaEnergyRings.
 */
function paintPickupChrome(g: Phaser.GameObjects.Graphics, opts: PaintPickupChromeOpts): void {
  const t = opts.timeMs / 1000;
  const r = opts.radius;
  const color = opts.color;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  const aMul = 0.75 + pulse * 0.25;
  const rInner = (r + 7) * (1 + (pulse - 0.5) * 0.04);
  const rOuter = (r + 16) * (1 - (pulse - 0.5) * 0.03);
  const spin = t * 1.55;
  const spin2 = -t * 1.05;

  g.clear();

  // Soft ability glow ring under dual strokes
  g.lineStyle(5, color, 0.16 * aMul);
  g.strokeCircle(0, 0, rInner + 3);

  // Dual solid rings: ability color + cream/gold reflect
  g.lineStyle(2.6, color, 0.88 * aMul);
  g.strokeCircle(0, 0, rInner);
  g.lineStyle(1.5, CREAM_GOLD, 0.45 * aMul);
  g.strokeCircle(0, 0, rOuter);

  // Rotating dashed ability arc (skip only if somehow called with tiny budget)
  if (opts.budget >= 0.25) {
    const segs = opts.budget >= 0.5 ? 7 : 5;
    const arcFrac = 0.09;
    for (let s = 0; s < segs; s++) {
      const start = spin + (s / segs) * Math.PI * 2;
      const end = start + arcFrac * Math.PI * 2;
      strokeCircleArc(g, 0, 0, rInner + 1.5, start, end, color, 0.8 * aMul, 2.1);
    }
    // Secondary cream/gold reflect dashed arc, counter-spin
    const segs2 = 4;
    const arcFrac2 = 0.07;
    for (let s = 0; s < segs2; s++) {
      const start = spin2 + (s / segs2) * Math.PI * 2;
      const end = start + arcFrac2 * Math.PI * 2;
      strokeCircleArc(g, 0, 0, rOuter + 1, start, end, THEME.gold, 0.55 * aMul, 1.5);
    }
  }

  // Tiny orbiting spark dots — only when budget healthy
  if (opts.sparks) {
    const dots = 3;
    const sparkR = rOuter + 5;
    for (let i = 0; i < dots; i++) {
      const a = spin * 1.35 + (i / dots) * Math.PI * 2;
      const x = Math.cos(a) * sparkR;
      const y = Math.sin(a) * sparkR;
      const twinkle = 0.45 + 0.55 * Math.sin(t * 5.5 + i * 1.7);
      g.fillStyle(color, 0.55 * twinkle * aMul);
      g.fillCircle(x, y, 1.5 + twinkle * 0.55);
    }
  }
}

/** Approximate circular arc with short line segments (cheap, no Path API). */
function strokeCircleArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  color: number,
  alpha: number,
  lw: number
): void {
  const steps = Math.max(3, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 36));
  g.lineStyle(lw, color, alpha);
  let prevX = cx + Math.cos(a0) * radius;
  let prevY = cy + Math.sin(a0) * radius;
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    g.lineBetween(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}
