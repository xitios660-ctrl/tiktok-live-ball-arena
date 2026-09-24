import { EventEmitter } from 'events';
import type { ITikTokConnector, ConnectorEventMap } from './ITikTokConnector';

/**
 * PRODUCTION adapter stub for `tiktok-live-connector` (unofficial Webcast WS).
 * Wiring happens in a later etapa — this class only defines the contract + reconnect policy.
 * See docs/TIKTOK_INTEGRATION.md
 */
export class TikTokLiveConnectorAdapter implements ITikTokConnector {
  readonly name = 'tiktok-live-connector-adapter';
  private emitter = new EventEmitter();
  private connected = false;
  private username: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  async connect(username: string): Promise<void> {
    this.username = username.replace(/^@/, '');
    this.intentionalDisconnect = false;
    // Stub: real library not wired yet. Reject so callers know PRODUCTION is incomplete.
    throw new Error(
      `[${this.name}] PRODUCTION connector not wired yet. ` +
        `Install and wrap tiktok-live-connector (see docs/TIKTOK_INTEGRATION.md). ` +
        `Use TIKTOK_MODE=demo for development.`
    );
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connected = false;
    this.emitter.emit('disconnected', 'manual');
  }

  on<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Exponential backoff: 1s, 2s, 4s … capped at 60s */
  protected scheduleReconnect(): void {
    if (this.intentionalDisconnect || !this.username) return;
    this.reconnectAttempt += 1;
    const delayMs = Math.min(60_000, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 6));
    this.emitter.emit('reconnecting', this.reconnectAttempt, delayMs);
    this.reconnectTimer = setTimeout(() => {
      if (this.username) {
        this.connect(this.username).catch((err) => {
          this.emitter.emit('error', err instanceof Error ? err : new Error(String(err)));
          this.scheduleReconnect();
        });
      }
    }, delayMs);
  }
}
