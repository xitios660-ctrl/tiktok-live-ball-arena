import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MAX_PICKUPS,
  PICKUP_RADIUS,
  PICKUP_SPAWN_INTERVAL_MIN_MS,
  PICKUP_SPAWN_INTERVAL_MAX_MS,
  PICKUP_LIFETIME_MS,
  PICKUP_EDGE_MARGIN,
  PICKUP_MIN_SEPARATION,
  PICKUP_ADMIN_SPAWN_JITTER,
  PICKUP_ABILITY_KEYS,
  PICKUP_SPAWN_WEIGHTS,
  PICKUP_META,
  type PickupAbilityKey,
  type PickupState,
  type BallState,
  type AnnounceEvent,
  type AbilityFxEvent,
} from '@arena/shared';
import { randomUUID } from 'crypto';
import type { PhysicsWorld } from './PhysicsWorld';
import { applyPickupAbility } from './GiftAbilities';

interface InternalPickup extends PickupState {
  expiresAt: number;
}

export interface PickupCollectResult {
  announces: AnnounceEvent[];
  fx: AbilityFxEvent[];
  collected: { pickupId: string; userId: string; ability: PickupAbilityKey }[];
}

/**
 * Arena floor power-ups. Spawn during running rounds; collected by living balls.
 */
export class PickupSystem {
  private pickups: InternalPickup[] = [];
  private nextSpawnAt = 0;

  clear(): void {
    this.pickups = [];
    this.nextSpawnAt = 0;
  }

  /** Call when a round enters running. */
  onRoundStart(now = Date.now()): void {
    this.clear();
    this.nextSpawnAt = now + this.randomInterval();
  }

  toPublicStates(): PickupState[] {
    return this.pickups.map(({ id, ability, x, y, radius }) => ({
      id,
      ability,
      x,
      y,
      radius,
    }));
  }

  get count(): number {
    return this.pickups.length;
  }

  /**
   * Force-spawn a pickup (admin / debug). Near center with small jitter by default.
   */
  forceSpawn(
    ability: PickupAbilityKey,
    opts?: { x?: number; y?: number; nearCenter?: boolean }
  ): PickupState | null {
    const nearCenter = opts?.nearCenter !== false;
    let x = opts?.x;
    let y = opts?.y;
    if (x == null || y == null) {
      if (nearCenter) {
        x = CANVAS_WIDTH / 2 + (Math.random() * 2 - 1) * PICKUP_ADMIN_SPAWN_JITTER;
        y = CANVAS_HEIGHT / 2 + (Math.random() * 2 - 1) * PICKUP_ADMIN_SPAWN_JITTER;
      } else {
        const pos = this.pickSafePosition();
        if (!pos) return null;
        x = pos.x;
        y = pos.y;
      }
    }
    // Cap: replace oldest if at max
    if (this.pickups.length >= MAX_PICKUPS) {
      this.pickups.shift();
    }
    const p = this.makePickup(ability, x, y);
    this.pickups.push(p);
    return { id: p.id, ability: p.ability, x: p.x, y: p.y, radius: p.radius };
  }

  /**
   * Tick: expire, maybe spawn, then try collect against living balls.
   * Only call while phase === 'running'.
   */
  tick(physics: PhysicsWorld, now = Date.now()): PickupCollectResult {
    const result: PickupCollectResult = { announces: [], fx: [], collected: [] };

    // Expire
    this.pickups = this.pickups.filter((p) => p.expiresAt > now);

    // Spawn cadence
    if (now >= this.nextSpawnAt) {
      if (this.pickups.length < MAX_PICKUPS) {
        this.trySpawnRandom();
      }
      this.nextSpawnAt = now + this.randomInterval();
    }

    // Collect
    const balls = physics.toPublicStates();
    const remaining: InternalPickup[] = [];
    for (const p of this.pickups) {
      const collector = this.findCollector(p, balls);
      if (!collector) {
        remaining.push(p);
        continue;
      }
      const applied = applyPickupAbility(physics, collector.userId, p.ability, collector.username);
      if (applied) {
        result.announces.push(...applied.announces);
        result.fx.push(...applied.fx);
        result.collected.push({
          pickupId: p.id,
          userId: collector.userId,
          ability: p.ability,
        });
      } else {
        // Ball vanished mid-apply — keep pickup
        remaining.push(p);
      }
    }
    this.pickups = remaining;
    return result;
  }

  private findCollector(
    p: InternalPickup,
    balls: BallState[]
  ): { userId: string; username: string } | null {
    const r = p.radius;
    for (const b of balls) {
      // Dead balls are not in physics; all public states are living.
      // Galaxy gods are living balls — allowed.
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const reach = b.radius + r;
      if (dx * dx + dy * dy <= reach * reach) {
        return { userId: b.userId, username: b.nickname || b.username };
      }
    }
    return null;
  }

  private trySpawnRandom(): boolean {
    const ability = this.weightedAbility();
    const pos = this.pickSafePosition();
    if (!pos) return false;
    this.pickups.push(this.makePickup(ability, pos.x, pos.y));
    return true;
  }

  private makePickup(ability: PickupAbilityKey, x: number, y: number): InternalPickup {
    return {
      id: randomUUID(),
      ability,
      x,
      y,
      radius: PICKUP_RADIUS,
      expiresAt: Date.now() + PICKUP_LIFETIME_MS,
    };
  }

  private pickSafePosition(): { x: number; y: number } | null {
    const minX = PICKUP_EDGE_MARGIN + PICKUP_RADIUS;
    const maxX = CANVAS_WIDTH - PICKUP_EDGE_MARGIN - PICKUP_RADIUS;
    const minY = PICKUP_EDGE_MARGIN + PICKUP_RADIUS;
    const maxY = CANVAS_HEIGHT - PICKUP_EDGE_MARGIN - PICKUP_RADIUS;
    if (maxX <= minX || maxY <= minY) return null;

    for (let attempt = 0; attempt < 24; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (this.isSeparated(x, y)) return { x, y };
    }
    // Soft fallback: allow slight overlap if field is crowded
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  private isSeparated(x: number, y: number): boolean {
    const minD2 = PICKUP_MIN_SEPARATION * PICKUP_MIN_SEPARATION;
    for (const p of this.pickups) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minD2) return false;
    }
    return true;
  }

  private weightedAbility(): PickupAbilityKey {
    let total = 0;
    for (const k of PICKUP_ABILITY_KEYS) total += PICKUP_SPAWN_WEIGHTS[k];
    let roll = Math.random() * total;
    for (const k of PICKUP_ABILITY_KEYS) {
      roll -= PICKUP_SPAWN_WEIGHTS[k];
      if (roll <= 0) return k;
    }
    return PICKUP_ABILITY_KEYS[PICKUP_ABILITY_KEYS.length - 1];
  }

  private randomInterval(): number {
    const span = PICKUP_SPAWN_INTERVAL_MAX_MS - PICKUP_SPAWN_INTERVAL_MIN_MS;
    return PICKUP_SPAWN_INTERVAL_MIN_MS + Math.floor(Math.random() * (span + 1));
  }
}

export function pickupAbilityFromGiftId(giftId: string | number): PickupAbilityKey | null {
  const id = String(giftId).toLowerCase();
  for (const [ability, meta] of Object.entries(PICKUP_META) as [
    PickupAbilityKey,
    (typeof PICKUP_META)[PickupAbilityKey],
  ][]) {
    if (meta.giftId === id || ability === id) return ability;
  }
  // aliases
  const aliases: Record<string, PickupAbilityKey> = {
    raio: 'lightning_zap',
    lightning: 'lightning_zap',
    ima: 'magnet_pulse',
    magnet: 'magnet_pulse',
    gelo: 'freeze_aura',
    freeze: 'freeze_aura',
    foguete: 'dash_burst',
    rocket: 'dash_burst',
    espelho: 'reflect_shield',
    mirror: 'reflect_shield',
  };
  return aliases[id] ?? null;
}
