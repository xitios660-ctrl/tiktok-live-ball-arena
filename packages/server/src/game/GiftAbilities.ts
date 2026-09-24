import {
  ROSA_HEAL,
  DINO_DURATION_MS,
  DINO_STACK_MAX,
  DONUT_HEAL,
  DONUT_SHIELD_PER,
  DONUT_SHIELD_MAX,
  DONUT_DURATION_MS,
  DONUT_SHIELD_DURATION_MS,
  DONUT_STACK_MAX,
  SUGAR_BURST_DURATION_MS,
  TITAN_DURATION_MS,
  TITAN_HP_GAIN,
  TITAN_RESTACK_HP,
  TITAN_STACK_MAX,
  resolveAbilityKey,
  PICKUP_META,
  type AbilityKey,
  type PickupAbilityKey,
  type ArenaGiftEvent,
  type AnnounceEvent,
  type AbilityFxEvent,
} from '@arena/shared';
import type { PhysicsWorld, DamageApplication } from './PhysicsWorld';

export interface GiftApplyResult {
  ability: AbilityKey;
  times: number;
  announces: AnnounceEvent[];
  damages: DamageApplication[];
  fx: AbilityFxEvent[];
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
  const fx: AbilityFxEvent[] = [];
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
        const stacks = physics.addGiftStack(userId, 'dino', until);
        if (i === times - 1) {
          const sx = stacks > 1 ? ` x${stacks}` : '';
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🦖 DINO RAGE${sx}! @${name} (+força/+speed, máx x${DINO_STACK_MAX})`,
            userId,
            username: name,
            value: stacks,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'donut_overdrive': {
        physics.heal(userId, DONUT_HEAL);
        physics.addShield(userId, DONUT_SHIELD_PER, DONUT_SHIELD_MAX);
        physics.refreshShieldUntil(userId, DONUT_SHIELD_DURATION_MS);
        const until = Math.max(ball.donutUntil, now) + DONUT_DURATION_MS;
        const stacks = physics.addGiftStack(userId, 'donut', until);
        if (i === times - 1) {
          const b = physics.getBall(userId)!;
          const sx = stacks > 1 ? ` x${stacks}` : '';
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🍩 DONUT${sx}! @${name} escudo ${b.shieldHp} (máx x${DONUT_STACK_MAX})`,
            userId,
            username: name,
            value: stacks,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'capybara_titan': {
        const b = physics.getBall(userId)!;
        const already = Date.now() < b.titanUntil && b.titanStacks > 0;
        if (already) {
          physics.heal(userId, TITAN_RESTACK_HP);
        } else {
          physics.heal(userId, TITAN_HP_GAIN);
          b.maxHp = Math.max(b.maxHp, Math.min(150, b.hp));
        }
        const until = Math.max(b.titanUntil, Date.now()) + TITAN_DURATION_MS;
        const stacks = physics.addGiftStack(userId, 'titan', until);
        if (i === times - 1) {
          let message: string;
          if (stacks >= TITAN_STACK_MAX) {
            message = `🦫 CAPIVARA x${stacks}! @${name} GIGANTE`;
          } else if (already || stacks > 1) {
            message = `🦫 CAPIVARA x${stacks}! @${name} +20s +${TITAN_RESTACK_HP} HP`;
          } else {
            message = `🦫 CAPYBARA TITAN! @${name} (Ultra Calma)`;
          }
          announces.push({
            type: 'announce',
            kind: 'gift',
            message,
            userId,
            username: name,
            value: stacks,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'galaxy_god': {
        const gal = physics.enableGalaxy(userId);
        if (i === 0 && gal.ok) {
          if (gal.alreadyGalaxy) {
            // Refresh only — skip spam announce
          } else if (gal.duelStarted && gal.opponents.length) {
            const opp = gal.opponents.map((o) => `@${o.name}`).join(' & ');
            announces.push({
              type: 'announce',
              kind: 'cosmic_duel',
              message: `⚔️ DUELO CÓSMICO! @${name} vs ${opp} — só gods se machucam!`,
              userId,
              username: name,
              targetId: gal.opponents[0]?.userId,
              targetName: gal.opponents[0]?.name,
              timestamp: Date.now(),
            });
          } else if (gal.duelJoined) {
            announces.push({
              type: 'announce',
              kind: 'cosmic_duel',
              message: `🌌 @${name} entrou no DUELO CÓSMICO! Gods vs gods!`,
              userId,
              username: name,
              timestamp: Date.now(),
            });
          } else {
            announces.push({
              type: 'announce',
              kind: 'galaxy',
              message: `🌌 GALAXY GOD MODE! @${name} — imortal até o fim da rodada!`,
              userId,
              username: name,
              timestamp: Date.now(),
            });
          }
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
          fx.push({
            type: 'ability_fx',
            ability: 'lightning_zap',
            userId,
            x: zap.x,
            y: zap.y,
            targetId: zap.targetId || undefined,
            targetX: zap.targetX,
            targetY: zap.targetY,
            value: zap.damage,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'magnet_pulse': {
        if (i === 0) {
          const mag = physics.applyMagnetPulse(userId);
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🧲 ÍMÃ! @${name} puxou ${mag.count} bola(s)`,
            userId,
            username: name,
            value: mag.count,
            timestamp: Date.now(),
          });
          fx.push({
            type: 'ability_fx',
            ability: 'magnet_pulse',
            userId,
            x: mag.x,
            y: mag.y,
            value: mag.count,
            timestamp: Date.now(),
          });
        }
        break;
      }
      case 'freeze_aura': {
        const fr = physics.applyFreezeAura(userId);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `❄️ AURA GELADA! @${name} — inimigos perto ficam lentos`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
          if (fr) {
            fx.push({
              type: 'ability_fx',
              ability: 'freeze_aura',
              userId,
              x: fr.x,
              y: fr.y,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }
      case 'dash_burst': {
        if (i === 0) {
          const dash = physics.applyDashBurst(userId);
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🚀 DASH! @${name} acelerou`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
          if (dash) {
            fx.push({
              type: 'ability_fx',
              ability: 'dash_burst',
              userId,
              x: dash.x,
              y: dash.y,
              targetX: dash.x + dash.vx * 0.05,
              targetY: dash.y + dash.vy * 0.05,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }
      case 'reflect_shield': {
        const ref = physics.applyReflectShield(userId);
        if (i === times - 1) {
          announces.push({
            type: 'announce',
            kind: 'gift',
            message: `🪞 REFLECT! @${name} devolve dano por alguns segundos`,
            userId,
            username: name,
            timestamp: Date.now(),
          });
          if (ref) {
            fx.push({
              type: 'ability_fx',
              ability: 'reflect_shield',
              userId,
              x: ref.x,
              y: ref.y,
              timestamp: Date.now(),
            });
          }
        }
        break;
      }
    }
  }

  return { ability, times, announces, damages, fx };
}

/**
 * Apply a floor-pickup ability to a living ball. Short "pegou" feed + FX.
 */
export function applyPickupAbility(
  physics: PhysicsWorld,
  userId: string,
  ability: PickupAbilityKey,
  displayName: string
): GiftApplyResult | null {
  const ball = physics.getBall(userId);
  if (!ball) return null;

  const name = displayName;
  const announces: AnnounceEvent[] = [];
  const damages: DamageApplication[] = [];
  const fx: AbilityFxEvent[] = [];
  const meta = PICKUP_META[ability];

  switch (ability) {
    case 'lightning_zap': {
      const zap = physics.applyLightningZap(userId);
      announces.push({
        type: 'announce',
        kind: 'pickup',
        message: `${meta.emoji} @${name} pegou ${meta.label}!`,
        userId,
        username: name,
        targetId: zap.targetId || undefined,
        timestamp: Date.now(),
      });
      fx.push({
        type: 'ability_fx',
        ability: 'lightning_zap',
        userId,
        x: zap.x,
        y: zap.y,
        targetId: zap.targetId || undefined,
        targetX: zap.targetX,
        targetY: zap.targetY,
        value: zap.damage,
        timestamp: Date.now(),
      });
      break;
    }
    case 'magnet_pulse': {
      const mag = physics.applyMagnetPulse(userId);
      announces.push({
        type: 'announce',
        kind: 'pickup',
        message: `${meta.emoji} @${name} pegou ${meta.label}!`,
        userId,
        username: name,
        value: mag.count,
        timestamp: Date.now(),
      });
      fx.push({
        type: 'ability_fx',
        ability: 'magnet_pulse',
        userId,
        x: mag.x,
        y: mag.y,
        value: mag.count,
        timestamp: Date.now(),
      });
      break;
    }
    case 'freeze_aura': {
      const fr = physics.applyFreezeAura(userId);
      announces.push({
        type: 'announce',
        kind: 'pickup',
        message: `${meta.emoji} @${name} pegou ${meta.label}!`,
        userId,
        username: name,
        timestamp: Date.now(),
      });
      if (fr) {
        fx.push({
          type: 'ability_fx',
          ability: 'freeze_aura',
          userId,
          x: fr.x,
          y: fr.y,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'dash_burst': {
      const dash = physics.applyDashBurst(userId);
      announces.push({
        type: 'announce',
        kind: 'pickup',
        message: `${meta.emoji} @${name} pegou ${meta.label}!`,
        userId,
        username: name,
        timestamp: Date.now(),
      });
      if (dash) {
        fx.push({
          type: 'ability_fx',
          ability: 'dash_burst',
          userId,
          x: dash.x,
          y: dash.y,
          targetX: dash.x + dash.vx * 0.05,
          targetY: dash.y + dash.vy * 0.05,
          timestamp: Date.now(),
        });
      }
      break;
    }
    case 'reflect_shield': {
      const ref = physics.applyReflectShield(userId);
      announces.push({
        type: 'announce',
        kind: 'pickup',
        message: `${meta.emoji} @${name} pegou ${meta.label}!`,
        userId,
        username: name,
        timestamp: Date.now(),
      });
      if (ref) {
        fx.push({
          type: 'ability_fx',
          ability: 'reflect_shield',
          userId,
          x: ref.x,
          y: ref.y,
          timestamp: Date.now(),
        });
      }
      break;
    }
  }

  return { ability, times: 1, announces, damages, fx };
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
