import {
  ROSA_HEAL,
  DINO_DURATION_MS,
  DONUT_HEAL,
  DONUT_SHIELD_PER,
  DONUT_SHIELD_MAX,
  DONUT_DURATION_MS,
  SUGAR_BURST_DURATION_MS,
  TITAN_DURATION_MS,
  TITAN_HP_GAIN,
  TITAN_RESTACK_HP,
  resolveAbilityKey,
  type AbilityKey,
  type ArenaGiftEvent,
  type AnnounceEvent,
} from '@arena/shared';
import type { PhysicsWorld, DamageApplication, FxEvent } from './PhysicsWorld';

export interface GiftApplyResult {
  ability: AbilityKey;
  times: number;
  announces: AnnounceEvent[];
  damages: DamageApplication[];
  fx: FxEvent[];
}

/**
 * Apply gift ability to SENDER ball. Caller ensures ball exists.
 * repeatCount applies the ability N times (Rosa = N heals; timed buffs extend).
 */
export function applyGiftAbility(
  physics: PhysicsWorld,
  event: ArenaGiftEvent,
  abilityOverride?: AbilityKey | null
): GiftApplyResult | null {
  const ability = abilityOverride ?? resolveAbilityKey(event.giftId);
  if (!ability) return null;

  const userId = event.user.userId;
  const ball = physics.getBall(userId);
  if (!ball) return null;

  const times = Math.max(1, Math.floor(event.repeatCount || 1));
  const name = event.user.nickname || event.user.username;
  const announces: AnnounceEvent[] = [];
  const damages: DamageApplication[] = [];
  const fx: FxEvent[] = [];
  const now = Date.now();

  for (let i = 0; i < times; i++) {
    switch (ability) {
      case 'heal_pulse': {
        const healed = physics.heal(userId, ROSA_HEAL);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🌹 HEAL PULSE! @${name} +${ROSA_HEAL * times} HP`,
            userId,
            username: name,
            value: healed,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'dino_rage': {
        const until = Math.max(ball.dinoRageUntil, now) + DINO_DURATION_MS;
        // Cap attributes: setTimedBuff only extends; multipliers are binary while active
        physics.setTimedBuff(userId, 'dino', until);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🦖 DINO RAGE! @${name} (+25% força / +15% speed)`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'donut_overdrive': {
        physics.heal(userId, DONUT_HEAL);
        physics.addShield(userId, DONUT_SHIELD_PER, DONUT_SHIELD_MAX);
        const until = Math.max(ball.donutUntil, now) + DONUT_DURATION_MS;
        physics.setTimedBuff(userId, 'donut', until);
        if (i === times - 1) {
          const b = physics.getBall(userId)!;
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🍩 DONUT OVERDRIVE! @${name} escudo ${b.shieldHp}`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'capybara_titan': {
        const b = physics.getBall(userId)!;
        const already = Date.now() < b.titanUntil && b.titanApplied;
        if (already) {
          physics.heal(userId, TITAN_RESTACK_HP);
          physics.setTimedBuff(userId, 'titan', Math.max(b.titanUntil, Date.now()) + TITAN_DURATION_MS);
        } else {
          physics.heal(userId, TITAN_HP_GAIN);
          b.maxHp = Math.max(b.maxHp, Math.min(150, b.hp));
          physics.setTimedBuff(userId, 'titan', Date.now() + TITAN_DURATION_MS);
        }
        if (i === times - 1) {
          const still = physics.getBall(userId);
          const wasRestack = already || times > 1;
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: wasRestack && already
              ? `🦫 CAPIVARA restack! @${name} +20s +${TITAN_RESTACK_HP} HP`
              : `🦫 CAPYBARA TITAN! @${name} (Ultra Calma)`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
          void still;
        }
        break;
      }
      case 'galaxy_god': {
        physics.enableGalaxy(userId);
        if (i === 0) {
          announces.push({
            type: 'announce',
            kind: 'galaxy',
            message: `🌌 GALAXY GOD MODE! @${name} — imortal até o fim da rodada!`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'lightning_zap': {
        if (i === 0) {
          const zap = physics.applyLightningZap(userId);
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: zap.targetId
              ? `⚡ RAIO! @${name} eletrocutou o mais próximo`
              : `⚡ RAIO! @${name} — sem alvo perto`,
            userId,
            username: name,
            targetId: zap.targetId || undefined,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'magnet_pulse': {
        if (i === 0) {
          const n = physics.applyMagnetPulse(userId);
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🧲 ÍMÃ! @${name} puxou ${n} bola(s)`,
            userId,
            username: name,
            value: n,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'freeze_aura': {
        physics.applyFreezeAura(userId);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `❄️ AURA GELADA! @${name} — inimigos perto ficam lentos`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'dash_burst': {
        if (i === 0) {
          physics.applyDashBurst(userId);
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🚀 DASH! @${name} acelerou`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'reflect_shield': {
        physics.applyReflectShield(userId);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🪞 REFLECT! @${name} devolve dano por alguns segundos`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  }

  return { ability, times, announces, damages, fx };
}

export function sugarBurstAnnounce(userId: string, username: string): AnnounceEvent {
  return {
    type: 'announce',
    kind: 'sugar_burst',
    message: `💥 SUGAR BURST! @${username}`,
    userId,
    username,
    timestamp: Date.now(),
  };
}

export { SUGAR_BURST_DURATION_MS };
