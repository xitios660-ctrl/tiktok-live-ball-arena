/** Shared types & constants for TikTok Live Ball Arena */

export type TikTokMode = 'demo' | 'production';

export type AbilityKey =
  | 'spawn_small_ball'
  | 'spawn_medium_ball'
  | 'boost_speed'
  | 'spawn_heavy_ball'
  | 'ultimate_chaos';

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
    | 'next_round';
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
export const DAMAGE_MAX = 28;
export const DAMAGE_IMPACT_THRESHOLD = 40;

export const SPAWN_PROTECTION_MS = 2000;
export const REVENGE_MARK_MS = 10000;
/** Min gap between "NOVO REI DA ARENA" announces */
export const KING_ANNOUNCE_COOLDOWN_MS = 8000;

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
