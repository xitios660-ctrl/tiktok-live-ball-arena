/**
 * Arena floor pickups — orbiting neon rings, emoji bob, color-coded glow.
 * Perf-safe: one container per pickup, shared tween via update().
 */
import Phaser from 'phaser';
import {
  PICKUP_META,
  type PickupState,
  type PickupAbilityKey,
} from '@arena/shared';
import { THEME, FONT_BLACK } from '../theme';

const GLOW: Record<PickupAbilityKey, number> = {
  lightning_zap: THEME.gold,
  magnet_pulse: THEME.electricCyan,
  freeze_aura: 0x7fe9ff,
  dash_burst: THEME.arenaRed,
  reflect_shield: 0xd0d6e0,
};

interface PickupView {
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  ring2: Phaser.GameObjects.Arc;
  emoji: Phaser.GameObjects.Text;
  ability: PickupAbilityKey;
  born: number;
}

export class PickupsLayer {
  private layer: Phaser.GameObjects.Container;
  private views = new Map<string, PickupView>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, depth = 8) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setDepth(depth);
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
        view.root.destroy(true);
        this.views.delete(id);
      }
    }
  }

  /** Call from scene.update for bob / orbit animation */
  tick(time: number): void {
    for (const view of this.views.values()) {
      const t = (time - view.born) / 1000;
      const bob = Math.sin(t * 3.2) * 4;
      view.emoji.setY(bob);
      view.glow.setScale(1 + Math.sin(t * 2.4) * 0.12);
      view.glow.setAlpha(0.32 + Math.sin(t * 2.4) * 0.14);
      view.ring.setRotation(t * 1.6);
      view.ring2.setRotation(-t * 1.1);
      const pulse = 1 + Math.sin(t * 4) * 0.09;
      view.ring.setScale(pulse);
      view.ring2.setScale(1.18 - (pulse - 1));
    }
  }

  clear(): void {
    for (const view of this.views.values()) view.root.destroy(true);
    this.views.clear();
  }

  private createView(p: PickupState): PickupView {
    const color = GLOW[p.ability] ?? THEME.gold;
    const meta = PICKUP_META[p.ability];
    const root = this.scene.add.container(p.x, p.y);

    const glow = this.scene.add.circle(0, 0, p.radius * 1.7, color, 0.38);
    const disc = this.scene.add.circle(0, 0, p.radius, THEME.stone, 0.78);
    disc.setStrokeStyle(2.5, color, 0.95);

    const ring = this.scene.add.circle(0, 0, p.radius + 7, color, 0);
    ring.setStrokeStyle(2.75, color, 0.9);
    const ring2 = this.scene.add.circle(0, 0, p.radius + 16, color, 0);
    ring2.setStrokeStyle(1.5, THEME.gold, 0.4);

    const emoji = this.scene.add
      .text(0, 0, meta?.emoji || '✦', {
        fontFamily: FONT_BLACK,
        fontSize: `${Math.round(p.radius * 1.35)}px`,
      })
      .setOrigin(0.5);

    root.add([glow, disc, ring, ring2, emoji]);
    return {
      root,
      glow,
      ring,
      ring2,
      emoji,
      ability: p.ability,
      born: this.scene.time.now,
    };
  }
}
