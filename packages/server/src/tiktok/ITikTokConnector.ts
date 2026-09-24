import type { ArenaLiveEvent } from '@arena/shared';

/** High-level TikTok / DEMO connection lifecycle for /health + admin UI */
export type TikTokConnectionPhase =
  | 'idle'
  | 'waiting_live' // AGUARDANDO LIVE — keep retrying
  | 'connecting'
  | 'connected' // LIVE DETECTADA / TIKTOK CONECTADO
  | 'reconnecting' // mid-round drop — game continues
  | 'disconnected'
  | 'error';

export interface ConnectorStatus {
  phase: TikTokConnectionPhase;
  /** Human label (PT) for overlay/admin */
  label: string;
  mode: 'demo' | 'production';
  name: string;
  username: string | null;
  roomId?: string | null;
  connected: boolean;
  live: boolean;
  reconnectAttempt: number;
  lastError?: string | null;
  lastEventAt?: number | null;
  lastConnectedAt?: number | null;
  note?: string;
}

export type ConnectorEventMap = {
  event: (payload: ArenaLiveEvent) => void;
  connected: (info: { username: string; roomId?: string }) => void;
  disconnected: (reason?: string) => void;
  error: (err: Error) => void;
  reconnecting: (attempt: number, delayMs: number) => void;
  status: (status: ConnectorStatus) => void;
};

/**
 * Abstract TikTok Live connector.
 * Implementations: DemoEventSimulator | TikTokLiveConnectorAdapter (production).
 * NEVER claim simulated DEMO events are real TikTok.
 */
export interface ITikTokConnector {
  readonly name: string;
  connect(username: string): Promise<void>;
  disconnect(): Promise<void>;
  on<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void;
  off<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void;
  isConnected(): boolean;
  getStatus(): ConnectorStatus;
}
