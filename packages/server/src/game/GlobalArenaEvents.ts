import {
  LIKE_THRESHOLD_DEFAULT,
  LIKE_REWARD_DEFAULT,
  HEAL_RAIN_HP,
  SPEED_STORM_DURATION_MS,
  DOUBLE_DAMAGE_DURATION_MS,
  DOUBLE_DAMAGE_MULT,
  SHARE_HEAL,
  SHARE_SPEED_DURATION_MS,
  SHARE_COOLDOWN_MS,
  RANDOM_EVENT_INTERVAL_SEC,
  RANDOM_EVENT_CHANCE,
  type AnnounceEvent,
  type ArenaUser,
  type GlobalEventState,
} from '@arena/shared';
import type { PhysicsWorld } from './PhysicsWorld';

export type LikeReward = 'heal_rain' | 'speed_storm';

function envInt(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function envReward(): LikeReward {
  const r = (process.env.LIKE_REWARD || LIKE_REWARD_DEFAULT).toLowerCase();
  return r === 'speed_storm' ? 'speed_storm' : 'heal_rain';
}

/**
 * Accumulates likes, share boosts, and light random arena events.
 * Pure helpers + state — GameLoop owns lifecycle.
 */
export class GlobalArenaEvents {
  likesAccumulated = 0;
  readonly likesThreshold: number;
  readonly likesReward: LikeReward;
  randomEventsEnabled = true;
  private lastRandomCheckAt = 0;
  private shareCooldown = new Map<string, number>();
  private activeEffect: GlobalEventState['activeEffect'] = null;
  private activeEffectUntil: number | null = null;

  constructor() {
    this.likesThreshold = envInt('LIKE_THRESHOLD', LIKE_THRESHOLD_DEFAULT);
    this.likesReward = envReward();
  }

  resetRound(): void {
    this.likesAccumulated = 0;
    this.shareCooldown.clear();
    this.activeEffect = null;
    this.activeEffectUntil = null;
    this.lastRandomCheckAt = Date.now();
  }

  getState(): GlobalEventState {
    const now = Date.now();
    if (this.activeEffectUntil && now >= this.activeEffectUntil) {
      this.activeEffect = null;
      this.activeEffectUntil = null;
    }
    return {
      likesAccumulated: this.likesAccumulated,
      likesThreshold: this.likesThreshold,
      likesReward: this.likesReward,
      randomEventsEnabled: this.randomEventsEnabled,
      activeEffect: this.activeEffect,
      activeEffectUntil: this.activeEffectUntil,
    };
  }

  setRandomEventsEnabled(enabled: boolean): void {
    this.randomEventsEnabled = enabled;
  }

  /** @returns announces from threshold triggers (0..n) */
  addLikes(count: number, physics: PhysicsWorld): AnnounceEvent[] {
    const n = Math.max(0, Math.floor(count));
    if (n <= 0) return [];
    this.likesAccumulated += n;
    const out: AnnounceEvent[] = [];
    while (this.likesAccumulated >= this.likesThreshold) {
      this.likesAccumulated -= this.likesThreshold;
      out.push(...this.triggerReward(this.likesReward, physics, 'likes'));
    }
    return out;
  }

  /**
   * Share boost for sharer. Returns announce or null if on cooldown / no ball.
   */
  applyShare(user: ArenaUser, physics: PhysicsWorld): AnnounceEvent | null {
    const now = Date.now();
    const last = this.shareCooldown.get(user.userId) || 0;
    if (now - last < SHARE_COOLDOWN_MS) {
      console.log(`[SHARE] cooldown @${user.username}`);
      return null;
    }
    if (!physics.hasUser(user.userId)) {
      // spawn happens in GameLoop before this
      return null;
    }
    this.shareCooldown.set(user.userId, now);
    physics.heal(user.userId, SHARE_HEAL);
    physics.setTimedBuff(user.userId, 'sugar', now + SHARE_SPEED_DURATION_MS);
    return {
      type: 'announce',
      kind: 'share_boost',
      message: `📢 SHARE BOOST! @${user.nickname || user.username} +${SHARE_HEAL} HP + speed`,
      userId: user.userId,
      username: user.nickname || user.username,
      timestamp: now,
    };
  }

  /** Periodic random event tick (call ~1Hz from GameLoop) */
  maybeRandomEvent(physics: PhysicsWorld, roundRunning: boolean): AnnounceEvent[] {
    if (!this.randomEventsEnabled || !roundRunning) return [];
    const now = Date.now();
    if (now - this.lastRandomCheckAt < RANDOM_EVENT_INTERVAL_SEC * 1000) return [];
    this.lastRandomCheckAt = now;
    if (Math.random() > RANDOM_EVENT_CHANCE) return [];
    const pick = (['heal_rain', 'speed_storm', 'double_damage'] as const)[
      Math.floor(Math.random() * 3)
    ];
    return this.triggerReward(pick, physics, 'random');
  }

  /** Admin force */
  forceEvent(
    kind: 'heal_rain' | 'speed_storm' | 'double_damage',
    physics: PhysicsWorld
  ): AnnounceEvent[] {
    return this.triggerReward(kind, physics, 'admin');
  }

  private triggerReward(
    kind: 'heal_rain' | 'speed_storm' | 'double_damage',
    physics: PhysicsWorld,
    source: string
  ): AnnounceEvent[] {
    const now = Date.now();
    const announces: AnnounceEvent[] = [];

    if (kind === 'heal_rain') {
      let healed = 0;
      for (const b of physics.getAll()) {
        healed += physics.heal(b.userId, HEAL_RAIN_HP);
      }
      this.activeEffect = 'heal_rain';
      this.activeEffectUntil = now + 2500;
      announces.push({
        type: 'announce',
        kind: 'heal_rain',
        message: `💚 HEAL RAIN! Todos +${HEAL_RAIN_HP} HP (${source})`,
        value: HEAL_RAIN_HP,
        timestamp: now,
      });
      if (source === 'likes') {
        announces.push({
          type: 'announce',
          kind: 'likes_threshold',
          message: `❤️ ${this.likesThreshold} likes! HEAL RAIN ativada!`,
          value: this.likesThreshold,
          timestamp: now,
        });
      }
      console.log(`[EVENT] heal_rain source=${source} healedTotal≈${healed}`);
    } else if (kind === 'speed_storm') {
      for (const b of physics.getAll()) {
        physics.setTimedBuff(b.userId, 'sugar', now + SPEED_STORM_DURATION_MS);
      }
      this.activeEffect = 'speed_storm';
      this.activeEffectUntil = now + SPEED_STORM_DURATION_MS;
      announces.push({
        type: 'announce',
        kind: 'speed_storm',
        message: `⚡ SPEED STORM! +speed ${SPEED_STORM_DURATION_MS / 1000}s (${source})`,
        value: SPEED_STORM_DURATION_MS / 1000,
        timestamp: now,
      });
      if (source === 'likes') {
        announces.push({
          type: 'announce',
          kind: 'likes_threshold',
          message: `❤️ ${this.likesThreshold} likes! SPEED STORM!`,
          value: this.likesThreshold,
          timestamp: now,
        });
      }
      console.log(`[EVENT] speed_storm source=${source}`);
    } else {
      physics.setGlobalDamage(DOUBLE_DAMAGE_MULT, now + DOUBLE_DAMAGE_DURATION_MS);
      this.activeEffect = 'double_damage';
      this.activeEffectUntil = now + DOUBLE_DAMAGE_DURATION_MS;
      announces.push({
        type: 'announce',
        kind: 'double_damage',
        message: `💥 DOUBLE DAMAGE! ${DOUBLE_DAMAGE_DURATION_MS / 1000}s (${source})`,
        value: DOUBLE_DAMAGE_DURATION_MS / 1000,
        timestamp: now,
      });
      console.log(`[EVENT] double_damage source=${source}`);
    }
    return announces;
  }
}
