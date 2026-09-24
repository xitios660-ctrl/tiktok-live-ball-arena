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
  /** Flash client on recent hit */
  hitFlash?: boolean;
}

/** Per-player round stats (alive or dead). Respawn = Etapa 8. */
export interface PlayerStats {
  userId: string;
  username: string;
  nickname?: string;
  kills: number;
  deaths: number;
  alive: boolean;
  hp: number;
  maxHp: number;
}

export interface GameSnapshot {
  tick: number;
  tickHz: number;
  phase: RoundPhase;
  remainingSec: number;
  playerCount: number;
  balls: BallState[];
  /** Leaderboard-ish kill list (top / all) */
  stats: PlayerStats[];
}

/** Collision hit for VFX / feed */
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
  /** "@attacker eliminou @victim" */
  message: string;
  x: number;
  y: number;
  timestamp: number;
}

export type CombatEvent = HitEvent | KillEvent;

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const DEFAULT_ROUND_DURATION_SEC = 300;

export const PHYSICS_TICK_HZ = 30;
export const SPEED_BOOST_ON_COLLISION = 1.015;

export const DEFAULT_BALL_RADIUS = 36;
export const DEFAULT_BALL_HP = 100;
/** Soft cap for future heals (Etapa gifts) */
export const MAX_BALL_HP = 150;
export const MAX_BALL_SPEED = 900;
export const MIN_SPAWN_SPEED = 80;
export const MAX_SPAWN_SPEED = 160;

/**
 * Damage formula (player-player, approaching collisions only):
 *   impact = closing speed along normal (−velAlongNormal)
 *   shareA = massB / (massA + massB)   // heavier opponent → more dmg to you
 *   raw = impact * DAMAGE_SPEED_FACTOR * share * strength(1)
 *   damage = clamp(round(raw), DAMAGE_MIN, DAMAGE_MAX)
 * Both balls take damage (mutual), weighted by the other's mass share.
 * Last hitter who dealt damage to you gets the kill credit.
 */
export const DAMAGE_SPEED_FACTOR = 0.085;
export const DAMAGE_MIN = 2;
export const DAMAGE_MAX = 28;
/** Ignore glancing blows below this closing speed (px/s) */
export const DAMAGE_IMPACT_THRESHOLD = 40;

export const SOCKET_EVENTS = {
  ROUND_STATE: 'round:state',
  LIVE_EVENT: 'live:event',
  GAME_SNAPSHOT: 'game:snapshot',
  COMBAT_EVENT: 'combat:event',
  CLIENT_READY: 'client:ready',
  HEALTH_PING: 'health:ping',
} as const;
