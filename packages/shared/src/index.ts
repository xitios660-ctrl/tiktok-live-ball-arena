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

export type RoundPhase = 'waiting' | 'countdown' | 'running' | 'ended';

export interface RoundState {
  phase: RoundPhase;
  roundId: string;
  durationSec: number;
  remainingSec: number;
  startedAt: number | null;
  mode: TikTokMode;
  playerCount: number;
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
  /** Semi-transparent — no damage/push */
  spawnProtected?: boolean;
  /** 🎯 revenge mark (visual only) */
  revengeMarked?: boolean;
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
  /** Who eliminated them last (while dead / for UI) */
  lastKillerId?: string | null;
  lastKillerName?: string | null;
  /** Active revenge target after respawn */
  revengeTargetId?: string | null;
  revengeTargetName?: string | null;
}

export interface GameSnapshot {
  tick: number;
  tickHz: number;
  phase: RoundPhase;
  remainingSec: number;
  playerCount: number;
  balls: BallState[];
  stats: PlayerStats[];
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

/** Respawn / toast announcements */
export interface AnnounceEvent {
  type: 'announce';
  kind: 'eliminated' | 'respawn' | 'revenge_respawn' | 'rivalry';
  message: string;
  userId?: string;
  username?: string;
  targetId?: string;
  targetName?: string;
  timestamp: number;
}

export type CombatEvent = HitEvent | KillEvent | AnnounceEvent;

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const DEFAULT_ROUND_DURATION_SEC = 300;

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

/** Respawn spawn protection (ms) — no damage dealt/received, no ball-ball push */
export const SPAWN_PROTECTION_MS = 2000;
/** How long 🎯 stays on revenge target (ms) — visual only */
export const REVENGE_MARK_MS = 10000;

export const SOCKET_EVENTS = {
  ROUND_STATE: 'round:state',
  LIVE_EVENT: 'live:event',
  GAME_SNAPSHOT: 'game:snapshot',
  COMBAT_EVENT: 'combat:event',
  CLIENT_READY: 'client:ready',
  HEALTH_PING: 'health:ping',
} as const;
