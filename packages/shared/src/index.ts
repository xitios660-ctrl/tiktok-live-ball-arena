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
  /** Round kills (for strength cue) */
  kills?: number;
  /** 1 + kill bonus (capped) — collision damage power */
  strengthMult?: number;
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

export interface GameSnapshot {
  tick: number;
  tickHz: number;
  phase: RoundPhase;
  remainingSec: number;
  resultsRemainingSec?: number;
  playerCount: number;
  balls: BallState[];
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
    | 'sugar_burst'
    | 'stomp'
    | 'heal_rain'
    | 'speed_storm'
    | 'double_damage'
    | 'share_boost'
    | 'likes_threshold'
    | 'strength_up';
  message: string;
  userId?: string;
  username?: string;
  targetId?: string;
  targetName?: string;
  value?: number;
  timestamp: number;
}

export type CombatEvent = HitEvent | KillEvent | AnnounceEvent;

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

export const DONUT_HEAL = 20;
export const DONUT_SHIELD_PER = 100;
export const DONUT_SHIELD_MAX = 300;
export const DONUT_DURATION_MS = 12_000;
export const DONUT_SPEED_MULT = 1.2;
export const DONUT_RESIST = 0.25;
export const SUGAR_BURST_SPEED_MULT = 1.25;
export const SUGAR_BURST_DURATION_MS = 3_000;
export const SUGAR_BURST_PUSH = 420;
export const SUGAR_BURST_DAMAGE = 8;
export const SUGAR_BURST_RADIUS = 220;

export const TITAN_DURATION_MS = 20_000;
export const TITAN_SIZE_MULT = 1.6;
export const TITAN_MASS_MULT = 2.0;
export const TITAN_STRENGTH_MULT = 1.75;
export const TITAN_RESIST = 0.4;
export const TITAN_COLLISION_DMG_MULT = 1.35;
export const TITAN_SPEED_MULT = 1.2;
export const TITAN_HP_GAIN = 50;
export const TITAN_RESTACK_HP = 25;
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

/** —— Likes / Shares / Random arena events —— */
export const LIKE_THRESHOLD_DEFAULT = 100;
export const LIKE_REWARD_DEFAULT: 'heal_rain' | 'speed_storm' = 'heal_rain';
export const HEAL_RAIN_HP = 15;
export const SPEED_STORM_DURATION_MS = 8_000;
export const DOUBLE_DAMAGE_DURATION_MS = 10_000;
export const DOUBLE_DAMAGE_MULT = 2.0;

export const SHARE_HEAL = 20;
export const SHARE_SPEED_DURATION_MS = 5_000;
export const SHARE_COOLDOWN_MS = 30_000;

/** Random event cadence during a running round */
export const RANDOM_EVENT_INTERVAL_SEC = 45;
export const RANDOM_EVENT_CHANCE = 0.35; // per tick check


/** —— Kill → strength (round-permanent while alive/dead; resets next round) ——
 * Mult = 1 + min(kills * KILL_STRENGTH_PER, KILL_STRENGTH_BONUS_CAP)
 * e.g. 0.08/kill, cap +1.0 ⇒ 2.0× at 12+ kills. Free-to-play scale; gifts still stack on top.
 */
export const KILL_STRENGTH_PER = 0.08;
export const KILL_STRENGTH_BONUS_CAP = 1.0;
/** Announce FORÇA+ every N kills (not every kill) */
export const KILL_STRENGTH_ANNOUNCE_EVERY = 3;

export function killStrengthMult(kills: number): number {
  const k = Math.max(0, Math.floor(kills || 0));
  return 1 + Math.min(k * KILL_STRENGTH_PER, KILL_STRENGTH_BONUS_CAP);
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
