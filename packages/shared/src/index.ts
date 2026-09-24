/** Shared types & constants for TikTok Live Ball Arena */

export type TikTokMode = 'demo' | 'production';

export type AbilityKey =
  | 'heal_pulse'
  | 'dino_rage'
  | 'donut_overdrive'
  | 'capybara_titan'
  | 'galaxy_god'
  | 'lightning_zap'
  | 'magnet_pulse'
  | 'freeze_aura'
  | 'dash_burst'
  | 'reflect_shield';

/** Active buff keys mirrored to client for VFX */
export type BuffKey =
  | 'dino_rage'
  | 'donut_overdrive'
  | 'sugar_burst'
  | 'capybara_titan'
  | 'galaxy_god'
  | 'freeze_aura'
  | 'reflect_shield'
  | 'slowed'
  | 'magnet_pulse'
  | 'dash_burst';

export interface GiftConfigEntry {
  id: string;
  tiktokGiftNames: string[];
  name: string;
  coinValue: number;
  tier: number;
  abilityKey: AbilityKey;
  description: string;
}

export interface GiftConfigFile {
  version: number;
  description: string;
  gifts: GiftConfigEntry[];
}

export interface ArenaUser {
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

/** Identifies synthetic users that must not receive paid gift abilities. */
export function isBotUser(user: { userId?: string; username?: string }): boolean {
  const userId = user.userId || '';
  const username = user.username || '';
  return (
    userId.startsWith('bot-') ||
    userId.startsWith('autobot-') ||
    userId.startsWith('boss-') ||
    /^bot[_-]/i.test(username) ||
    username.startsWith('bot_auto_')
  );
}

export interface ArenaCommentEvent {
  type: 'comment';
  user: ArenaUser;
  comment: string;
  timestamp: number;
}

export interface ArenaGiftEvent {
  type: 'gift';
  user: ArenaUser;
  giftId: string | number;
  giftName: string;
  repeatCount: number;
  repeatEnd: boolean;
  coinValue: number;
  timestamp: number;
}

export interface ArenaLikeEvent {
  type: 'like';
  user: ArenaUser;
  likeCount: number;
  totalLikeCount?: number;
  timestamp: number;
}

export interface ArenaShareEvent {
  type: 'share';
  user: ArenaUser;
  timestamp: number;
}

export interface ArenaJoinEvent {
  type: 'join';
  user: ArenaUser;
  timestamp: number;
}

export interface ArenaFollowEvent {
  type: 'follow';
  user: ArenaUser;
  timestamp: number;
}

export type ArenaLiveEvent =
  | ArenaCommentEvent
  | ArenaGiftEvent
  | ArenaLikeEvent
  | ArenaShareEvent
  | ArenaJoinEvent
  | ArenaFollowEvent;

/** waiting = idle; running = match; results = winner panel (~10s) then auto next */
export type RoundPhase = 'waiting' | 'countdown' | 'running' | 'results' | 'ended';

export interface RoundState {
  phase: RoundPhase;
  roundId: string;
  durationSec: number;
  remainingSec: number;
  startedAt: number | null;
  mode: TikTokMode;
  playerCount: number;
  /** During results: seconds left before next round */
  resultsRemainingSec?: number;
  kingUserId?: string | null;
}

export interface BallState {
  id: string;
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  hp: number;
  maxHp: number;
  label: string;
  hitFlash?: boolean;
  spawnProtected?: boolean;
  revengeMarked?: boolean;
  /** 👑 Rei da Arena */
  isKing?: boolean;
  /** Active buff keys for client VFX */
  buffs?: BuffKey[];
  shieldHp?: number;
  isGalaxy?: boolean;
  sizeScale?: number;
  healFlash?: boolean;
  sugarBurstFlash?: boolean;
  stompFlash?: boolean;
  galaxyImpactFlash?: boolean;
  /** Round kills (for strength / size cue) */
  kills?: number;
  /** Round-permanent damaging hits landed (strength on hit) */
  hitPower?: number;
  /** Combined kill+hit → strength mult (capped) — collision damage power */
  strengthMult?: number;
  /** Kill → size mult (capped) */
  killSizeMult?: number;
  /** Active gift stacks while buff timers run (0 when expired) */
  titanStacks?: number;
  dinoStacks?: number;
  donutStacks?: number;
  /** Special server-controlled boss NPC. */
  isBoss?: boolean;
  /** Kill-points awarded to the player who defeats this boss. */
  bossRewardKills?: number;
}

export interface PlayerStats {
  userId: string;
  username: string;
  nickname?: string;
  kills: number;
  deaths: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  damageDealt: number;
  damageTaken: number;
  collisions: number;
  highestSpeed: number;
  lastKillerId?: string | null;
  lastKillerName?: string | null;
  revengeTargetId?: string | null;
  revengeTargetName?: string | null;
  rank?: number;
}

/** Lifetime totals across rounds (in-memory; DB later) */
export interface HistoricalStats {
  userId: string;
  username: string;
  totalKills: number;
  totalDeaths: number;
  totalDamage: number;
  wins: number;
  roundsPlayed: number;
}

export interface WinnerInfo {
  userId: string;
  username: string;
  nickname?: string;
  kills: number;
  deaths: number;
  damageDealt: number;
  highestSpeed: number;
}

export interface GlobalEventState {
  likesAccumulated: number;
  likesThreshold: number;
  likesReward: 'heal_rain' | 'speed_storm';
  randomEventsEnabled: boolean;
  /** Active arena-wide effect key, if any */
  activeEffect?: 'heal_rain' | 'speed_storm' | 'double_damage' | null;
  activeEffectUntil?: number | null;
}

/** Abilities that spawn as arena floor pickups (not TikTok gifts) */
export type PickupAbilityKey =
  | 'lightning_zap'
  | 'magnet_pulse'
  | 'freeze_aura'
  | 'dash_burst'
  | 'reflect_shield'
  | 'heal_orb';

export const PICKUP_ABILITY_KEYS: readonly PickupAbilityKey[] = [
  'lightning_zap',
  'magnet_pulse',
  'freeze_aura',
  'dash_burst',
  'reflect_shield',
  'heal_orb',
] as const;

export function isPickupAbility(key: string): key is PickupAbilityKey {
  return (PICKUP_ABILITY_KEYS as readonly string[]).includes(key);
}

export interface PickupState {
  id: string;
  ability: PickupAbilityKey;
  x: number;
  y: number;
  radius: number;
}

export interface GameSnapshot {
  tick: number;
  tickHz: number;
  phase: RoundPhase;
  remainingSec: number;
  resultsRemainingSec?: number;
  playerCount: number;
  balls: BallState[];
  /** Arena floor power-ups (non-gift abilities) */
  pickups: PickupState[];
  /** Full sorted ranking */
  stats: PlayerStats[];
  /** TOP 5 for overlay */
  top5: PlayerStats[];
  kingUserId: string | null;
  winner: WinnerInfo | null;
  global?: GlobalEventState;
}

export interface HitEvent {
  type: 'hit';
  attackerId: string;
  attackerName: string;
  victimId: string;
  victimName: string;
  damage: number;
  victimHp: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface KillEvent {
  type: 'kill';
  attackerId: string | null;
  attackerName: string | null;
  victimId: string;
  victimName: string;
  message: string;
  x: number;
  y: number;
  timestamp: number;
  isRevenge?: boolean;
  rivalryCount?: number;
}

export interface AnnounceEvent {
  type: 'announce';
  kind:
    | 'eliminated'
    | 'respawn'
    | 'revenge_respawn'
    | 'rivalry'
    | 'new_king'
    | 'last_minute'
    | 'countdown'
    | 'winner'
    | 'next_round'
    | 'gift'
    | 'galaxy'
    | 'cosmic_duel'
    | 'shield_expire'
    | 'sugar_burst'
    | 'stomp'
    | 'heal_rain'
    | 'speed_storm'
    | 'double_damage'
    | 'share_boost'
    | 'likes_threshold'
    | 'strength_up'
    | 'pickup'
    | 'boss_spawn'
    | 'boss_defeated';
  message: string;
  userId?: string;
  username?: string;
  targetId?: string;
  targetName?: string;
  value?: number;
  timestamp: number;
}

/** One-shot ability / combat feedback FX for the overlay (lightweight payloads) */
export type AbilityFxKind =
  | AbilityKey
  | 'reflect_hit'
  | 'heal_orb';

export interface AbilityFxEvent {
  type: 'ability_fx';
  ability: AbilityFxKind;
  userId: string;
  x: number;
  y: number;
  /** Optional target (e.g. lightning zap victim) */
  targetId?: string;
  targetX?: number;
  targetY?: number;
  value?: number;
  timestamp: number;
}

export type CombatEvent = HitEvent | KillEvent | AnnounceEvent | AbilityFxEvent;

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const DEFAULT_ROUND_DURATION_SEC = 300;
/** Winner screen / interval before next round */
export const RESULTS_DURATION_SEC = 10;

export const PHYSICS_TICK_HZ = 30;
export const SPEED_BOOST_ON_COLLISION = 1.015;

export const DEFAULT_BALL_RADIUS = 36;
export const DEFAULT_BALL_HP = 100;
export const MAX_BALL_HP = 150;
export const MAX_BALL_SPEED = 900;
export const MIN_SPAWN_SPEED = 80;
export const MAX_SPAWN_SPEED = 160;

export const DAMAGE_SPEED_FACTOR = 0.085;
export const DAMAGE_MIN = 2;
export const DAMAGE_MAX = 36;
export const DAMAGE_IMPACT_THRESHOLD = 40;

export const SPAWN_PROTECTION_MS = 2000;
export const REVENGE_MARK_MS = 10000;
/** Min gap between "NOVO REI DA ARENA" announces */
export const KING_ANNOUNCE_COOLDOWN_MS = 8000;

/** —— Gift ability formulas / caps (server + docs) —— */
export const GIFT_SOFT_MAX_HP = 150;
export const ROSA_HEAL = 2;

export const DINO_DURATION_MS = 10_000;
export const DINO_STRENGTH_MULT = 1.25;
export const DINO_SPEED_MULT = 1.15;
export const DINO_COLLISION_DMG_MULT = 1.2;
/** Mini Dino true stacks — slight strength/speed scale; duration refresh */
export const DINO_STACK_MAX = 3;

export const DONUT_HEAL = 20;
export const DONUT_SHIELD_PER = 100;
export const DONUT_SHIELD_MAX = 300;
export const DONUT_DURATION_MS = 12_000;
/** Shield HP also expires by time (not only when broken by damage) */
export const DONUT_SHIELD_DURATION_MS = 15_000;
export const DONUT_SPEED_MULT = 1.2;
export const DONUT_RESIST = 0.25;
/** Rosquinha stacks — more shield (still max 300) + slight size while overdrive */
export const DONUT_STACK_MAX = 3;
export const DONUT_SIZE_PER_STACK = 0.08;
export const SUGAR_BURST_SPEED_MULT = 1.25;
export const SUGAR_BURST_DURATION_MS = 3_000;
export const SUGAR_BURST_PUSH = 420;
export const SUGAR_BURST_DAMAGE = 8;
export const SUGAR_BURST_RADIUS = 220;

export const TITAN_DURATION_MS = 20_000;
/** Per-stack size factor (stack1=1.6, stack2=2.2, stack3=2.8 via titanSizeMult) */
export const TITAN_SIZE_MULT = 1.6;
export const TITAN_MASS_MULT = 2.0;
export const TITAN_STRENGTH_MULT = 1.75;
export const TITAN_RESIST = 0.4;
export const TITAN_COLLISION_DMG_MULT = 1.35;
export const TITAN_SPEED_MULT = 1.2;
export const TITAN_HP_GAIN = 50;
export const TITAN_RESTACK_HP = 25;
/** Capivara true stacks — each gift +1 while buff active; timer expiry resets to 0 */
export const TITAN_STACK_MAX = 3;
/** Soft cap on stacked titan strength mult (linear would hit 3.25 at x3) */
export const TITAN_STRENGTH_STACK_CAP = 3.0;
/** Soft cap on stacked titan resist contribution */
export const TITAN_RESIST_STACK_CAP = 0.7;
export const TITAN_REGEN_PER_SEC = 2;
export const TITAN_ULTRA_CALMA_KB = 0.5;
export const TITAN_STOMP_SPEED = 280;
export const TITAN_STOMP_PUSH = 380;
export const TITAN_STOMP_RADIUS = 260;
export const TITAN_HIT_KB_BONUS = 1.35;
export const TITAN_HIT_SPEED = 320;

export const GALAXY_STRENGTH_MULT = 4.0; // +300%
export const GALAXY_SPEED_MULT = 2.0; // +100%
export const GALAXY_SIZE_MULT = 1.5;
export const GALAXY_MASS_MULT = 4.0;
export const GALAXY_IMPACT_SPEED = 350;
export const GALAXY_IMPACT_PUSH = 520;
export const GALAXY_IMPACT_EXTRA_DMG = 1.5;
/** Cosmic Duel (Galaxy vs Galaxy): gods fight each other with this pool */
export const COSMIC_DUEL_HP = 250;
/** Scale collision damage when both attacker & victim are galaxy */
export const COSMIC_DUEL_DAMAGE_MULT = 0.4;

export const GIFT_ABILITY_BY_ID: Record<string, AbilityKey> = {
  rosa: 'heal_pulse',
  mini_dino: 'dino_rage',
  rosquinha: 'donut_overdrive',
  capivara: 'capybara_titan',
  galaxia: 'galaxy_god',
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

export function resolveAbilityKey(giftId: string | number): AbilityKey | null {
  const id = String(giftId).toLowerCase();
  return GIFT_ABILITY_BY_ID[id] ?? null;
}


/** —— Mild mutual attraction (keeps fights clustered; not a glue magnet) ——
 * Each tick, balls within MILD_ATTRACTION_RADIUS get accel toward each other:
 *   a = MILD_ATTRACTION_ACCEL * (1 - dist/R)   (soft falloff)
 * Acceleration vector is capped at MILD_ATTRACTION_MAX_ACCEL.
 * Spawn-protected balls neither pull nor are pulled.
 */
export const MILD_ATTRACTION_ACCEL = 55; // px/s² scale
export const MILD_ATTRACTION_RADIUS = 420; // px
export const MILD_ATTRACTION_MAX_ACCEL = 90; // px/s² hard cap per ball per tick

/** —— Extra gift powers (mid-tier; F2P still viable via kills) —— */
export const LIGHTNING_SLOW_MS = 2_200;
export const LIGHTNING_SLOW_FACTOR = 0.35; // velocity mult on hit
export const LIGHTNING_RANGE = 520;
export const LIGHTNING_DAMAGE = 8;

export const MAGNET_PULSE_RADIUS = 480;
export const MAGNET_PULSE_PULL = 320; // impulse toward caster
export const MAGNET_PULSE_VISUAL_MS = 1_200;

export const FREEZE_AURA_MS = 8_000;
export const FREEZE_AURA_RADIUS = 260;
export const FREEZE_AURA_SLOW = 0.55; // speed mult while in aura
export const FREEZE_AURA_TICK_SLOW_MS = 400; // refresh slow on nearby

export const DASH_BURST_BOOST = 380; // add speed along facing
export const DASH_BURST_SPEED_MS = 2_500;
export const DASH_BURST_SPEED_MULT = 1.35;

export const REFLECT_SHIELD_MS = 5_000;
export const REFLECT_RATIO = 0.55; // portion of incoming raw dmg bounced

/** —— Arena floor pickups (non-gift powers) —— */
export const MAX_PICKUPS = 5;
export const MIN_PICKUPS_TARGET = 3;
export const PICKUP_RADIUS = 32;
export const PICKUP_SPAWN_INTERVAL_MIN_MS = 6_000;
export const PICKUP_SPAWN_INTERVAL_MAX_MS = 10_000;
/** Despawn then respawn elsewhere */
export const PICKUP_LIFETIME_MS = 32_000;
/** Keep pickups inward from walls */
export const PICKUP_EDGE_MARGIN = 120;
/** Min distance between pickups (center-to-center) */
export const PICKUP_MIN_SEPARATION = 100;
/** Admin force-spawn near canvas center */
export const PICKUP_ADMIN_SPAWN_JITTER = 80;

export const PICKUP_META: Record<
  PickupAbilityKey,
  { emoji: string; label: string; giftId: string }
> = {
  lightning_zap: { emoji: '⚡', label: 'Raio', giftId: 'raio' },
  magnet_pulse: { emoji: '🧲', label: 'Ímã', giftId: 'ima' },
  freeze_aura: { emoji: '❄️', label: 'Gelo', giftId: 'gelo' },
  dash_burst: { emoji: '🚀', label: 'Foguete', giftId: 'foguete' },
  reflect_shield: { emoji: '🪞', label: 'Espelho', giftId: 'espelho' },
  heal_orb: { emoji: '💚', label: 'Cura', giftId: 'cura' },
};

/** HP restored when collecting heal_orb floor pickup */
export const PICKUP_HEAL_HP = 25;

/** Slight bias toward dash/reflect for fun movement plays; heal appears often enough */
export const PICKUP_SPAWN_WEIGHTS: Record<PickupAbilityKey, number> = {
  lightning_zap: 1,
  magnet_pulse: 1,
  freeze_aura: 1,
  dash_burst: 1.35,
  reflect_shield: 1.35,
  heal_orb: 1.2,
};

/** —— Likes / Shares / Random arena events —— */
export const LIKE_THRESHOLD_DEFAULT = 100;
export const LIKE_REWARD_DEFAULT: 'heal_rain' | 'speed_storm' = 'heal_rain';
/** Personal survival loop: every 10 likes from a player restores 2 HP to their own ball. */
export const LIKE_PERSONAL_STEP = 10;
export const LIKE_PERSONAL_HEAL = 2;
/** Community milestone: every 100 accumulated likes restores 10 HP to every living player. */
export const HEAL_RAIN_HP = 10;
export const SPEED_STORM_DURATION_MS = 8_000;
export const DOUBLE_DAMAGE_DURATION_MS = 10_000;
export const DOUBLE_DAMAGE_MULT = 2.0;

export const SHARE_HEAL = 20;
export const SHARE_SPEED_DURATION_MS = 5_000;
export const SHARE_COOLDOWN_MS = 30_000;

/** Random event cadence during a running round */
export const RANDOM_EVENT_INTERVAL_SEC = 45;
export const RANDOM_EVENT_CHANCE = 0.35; // per tick check


/** —— Kill + hit → strength + size (round-permanent on ball; resets next round) ——
 * Additive combat strength: 1 + kills*KILL_STRENGTH_PER + hitPower*HIT_STRENGTH_PER,
 * capped at COMBAT_STRENGTH_CAP (~2.5). Size still kill-only.
 * Free-to-play can grow big without gifts; gift stacks multiply on top (then MAX_BALL_RADIUS clamp).
 */
export const KILL_STRENGTH_PER = 0.08;
/** Absolute strength mult cap from kills alone (was bonus cap +1.0 → same 2.0×) */
export const KILL_STRENGTH_CAP = 2.0;
/** @deprecated alias — prefer KILL_STRENGTH_CAP */
export const KILL_STRENGTH_BONUS_CAP = KILL_STRENGTH_CAP - 1;
/** +1% damage mult per successful damaging hit landed */
export const HIT_STRENGTH_PER = 0.01;
/** Max bonus mult from hits alone (+50%) */
export const HIT_STRENGTH_BONUS_CAP = 0.5;
/** Soft overall combat mult cap (kills + hits): 2.0 + 0.5 */
export const COMBAT_STRENGTH_CAP = KILL_STRENGTH_CAP + HIT_STRENGTH_BONUS_CAP;
/** Throttle hitPower grants per attacker→victim pair (ms) */
export const HIT_POWER_COOLDOWN_MS = 200;
export const KILL_SIZE_PER = 0.05;
/** Absolute size mult cap from kills alone (~+75% at 15 kills) */
export const KILL_SIZE_CAP = 1.75;
/** Announce FORÇA+ every N kills (not every kill) */
export const KILL_STRENGTH_ANNOUNCE_EVERY = 3;

/** Hard radius clamp — diameter ~70% width max; prevents arena blowout */
export const MAX_BALL_RADIUS_FRAC = 0.35;
export const MAX_BALL_RADIUS = Math.floor(CANVAS_WIDTH * MAX_BALL_RADIUS_FRAC);

/** Kill-only mult (legacy / size-adjacent callers). Prefer combatStrengthMult. */
export function killStrengthMult(kills: number): number {
  const k = Math.max(0, Math.floor(kills || 0));
  return Math.min(1 + k * KILL_STRENGTH_PER, KILL_STRENGTH_CAP);
}

/**
 * Additive combat strength from kills + hitPower.
 * 1 + kills*0.08 + hitPower*0.01, soft-capped at COMBAT_STRENGTH_CAP (2.5).
 */
export function combatStrengthMult(kills: number, hitPower = 0): number {
  const k = Math.max(0, Math.floor(kills || 0));
  const h = Math.max(0, Math.floor(hitPower || 0));
  const hitBonus = Math.min(h * HIT_STRENGTH_PER, HIT_STRENGTH_BONUS_CAP);
  return Math.min(1 + k * KILL_STRENGTH_PER + hitBonus, COMBAT_STRENGTH_CAP);
}

/**
 * Livestream HUD integer — rises with kills (+8) and hits (+1).
 * Matches uncapped (mult-1)*100 while under the soft cap.
 */
export function displayStrengthScore(kills: number, hitPower = 0): number {
  const k = Math.max(0, Math.floor(kills || 0));
  const h = Math.max(0, Math.floor(hitPower || 0));
  return k * Math.round(KILL_STRENGTH_PER * 100) + h;
}

export function killSizeMult(kills: number): number {
  const k = Math.max(0, Math.floor(kills || 0));
  return Math.min(1 + k * KILL_SIZE_PER, KILL_SIZE_CAP);
}

/** Linear stack scale: 1 + (baseMult - 1) * stacks (stacks≤0 ⇒ 1) */
export function stackLinearMult(baseMult: number, stacks: number): number {
  const s = Math.max(0, Math.floor(stacks || 0));
  if (s <= 0) return 1;
  return 1 + (baseMult - 1) * s;
}

export function titanSizeMult(stacks: number): number {
  return stackLinearMult(TITAN_SIZE_MULT, stacks);
}
export function titanMassMult(stacks: number): number {
  return stackLinearMult(TITAN_MASS_MULT, stacks);
}
export function titanStrengthMult(stacks: number): number {
  return Math.min(stackLinearMult(TITAN_STRENGTH_MULT, stacks), TITAN_STRENGTH_STACK_CAP);
}
export function titanResistAmount(stacks: number): number {
  const s = Math.max(0, Math.floor(stacks || 0));
  if (s <= 0) return 0;
  return Math.min(TITAN_RESIST * s, TITAN_RESIST_STACK_CAP);
}
export function titanCollisionDmgMult(stacks: number): number {
  return stackLinearMult(TITAN_COLLISION_DMG_MULT, stacks);
}

export function dinoStrengthMult(stacks: number): number {
  return stackLinearMult(DINO_STRENGTH_MULT, stacks);
}
export function dinoSpeedMult(stacks: number): number {
  return stackLinearMult(DINO_SPEED_MULT, stacks);
}
export function dinoCollisionDmgMult(stacks: number): number {
  return stackLinearMult(DINO_COLLISION_DMG_MULT, stacks);
}

export function donutSizeMult(stacks: number): number {
  const s = Math.max(0, Math.floor(stacks || 0));
  if (s <= 0) return 1;
  return 1 + DONUT_SIZE_PER_STACK * s;
}

export const SOCKET_EVENTS = {
  ROUND_STATE: 'round:state',
  LIVE_EVENT: 'live:event',
  GAME_SNAPSHOT: 'game:snapshot',
  COMBAT_EVENT: 'combat:event',
  CLIENT_READY: 'client:ready',
  HEALTH_PING: 'health:ping',
} as const;

/** Sort: kills → damage → fewer deaths → highestSpeed */
export function compareRanking(a: PlayerStats, b: PlayerStats): number {
  if (b.kills !== a.kills) return b.kills - a.kills;
  if (b.damageDealt !== a.damageDealt) return b.damageDealt - a.damageDealt;
  if (a.deaths !== b.deaths) return a.deaths - b.deaths;
  return b.highestSpeed - a.highestSpeed;
}
