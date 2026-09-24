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

/** Normalized TikTok-like user (demo or production) */
export interface ArenaUser {
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

export type ArenaEventType =
  | 'comment'
  | 'gift'
  | 'like'
  | 'share'
  | 'join'
  | 'follow'
  | 'streamEnd'
  | 'connected'
  | 'disconnected'
  | 'error';

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

/** Public ball state (client-renderable). Server is authoritative. */
export interface BallState {
  id: string;
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  x: number;
  y: number;
  radius: number;
  /** 0xRRGGBB */
  color: number;
  hp: number;
  maxHp: number;
  /** Display label (username or nickname) */
  label: string;
}

/** Full snapshot broadcast ~PHYSICS_TICK_HZ times per second */
export interface GameSnapshot {
  tick: number;
  tickHz: number;
  phase: RoundPhase;
  remainingSec: number;
  playerCount: number;
  balls: BallState[];
}

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const DEFAULT_ROUND_DURATION_SEC = 300;

/** Server physics + snapshot broadcast rate (Hz) */
export const PHYSICS_TICK_HZ = 30;

/** Progressive speed multiplier on wall or ball collision */
export const SPEED_BOOST_ON_COLLISION = 1.015;

export const DEFAULT_BALL_RADIUS = 36;
export const DEFAULT_BALL_HP = 100;
export const MAX_BALL_SPEED = 900;
export const MIN_SPAWN_SPEED = 80;
export const MAX_SPAWN_SPEED = 160;

export const SOCKET_EVENTS = {
  ROUND_STATE: 'round:state',
  LIVE_EVENT: 'live:event',
  GAME_SNAPSHOT: 'game:snapshot',
  CLIENT_READY: 'client:ready',
  HEALTH_PING: 'health:ping',
} as const;
