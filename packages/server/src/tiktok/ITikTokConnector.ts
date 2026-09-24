import type { ArenaLiveEvent } from '@arena/shared';

export type ConnectorEventMap = {
  event: (payload: ArenaLiveEvent) => void;
  connected: (info: { username: string; roomId?: string }) => void;
  disconnected: (reason?: string) => void;
  error: (err: Error) => void;
  reconnecting: (attempt: number, delayMs: number) => void;
};

/**
 * Abstract TikTok Live connector.
 * Implementations: DemoEventSimulator | TikTokLiveConnectorAdapter (production stub).
 * NEVER claim simulated events are real TikTok.
 */
export interface ITikTokConnector {
  readonly name: string;
  connect(username: string): Promise<void>;
  disconnect(): Promise<void>;
  on<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void;
  off<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void;
  isConnected(): boolean;
}
