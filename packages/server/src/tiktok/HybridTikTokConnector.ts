import { EventEmitter } from 'node:events';
import type { ArenaLiveEvent } from '@arena/shared';
import type {
  ConnectorEventMap,
  ConnectorStatus,
  ITikTokConnector,
} from './ITikTokConnector';
import { EventDedupe } from './eventDedupe';
import { PirateTokConnectorAdapter } from './PirateTokConnectorAdapter';
import { TikTokLiveConnectorAdapter } from './TikTokLiveConnectorAdapter';

/**
 * Production hybrid:
 * - PirateTok direct WSS is authoritative for likes + joins + normal realtime.
 * - Legacy connector runs in parallel as a CHAT/GIFT safety net because its
 *   signed initial-batch fallback has proven able to see comments when TikTok
 *   temporarily stops delivering WebcastChatMessage on the direct WSS.
 *
 * We NEVER take likes from the backup, so personal like combos cannot double.
 */
export class HybridTikTokConnector implements ITikTokConnector {
  readonly name = 'hybrid-tiktok-live';

  private readonly emitter = new EventEmitter();
  private readonly primary = new PirateTokConnectorAdapter();
  private readonly backup = new TikTokLiveConnectorAdapter();
  private readonly chatDedupe = new EventDedupe(2_000, 2_000);
  private readonly giftDedupe = new EventDedupe(3_000, 2_000);

  constructor() {
    this.primary.on('event', (event) => this.handlePrimaryEvent(event));
    this.backup.on('event', (event) => this.handleBackupEvent(event));

    this.primary.on('connected', (info) => {
      this.emitter.emit('connected', info);
      this.emitStatus();
    });
    this.primary.on('disconnected', (reason) => {
      this.emitter.emit('disconnected', reason);
      this.emitStatus();
    });
    this.primary.on('reconnecting', (attempt, delayMs) => {
      this.emitter.emit('reconnecting', attempt, delayMs);
      this.emitStatus();
    });
    this.primary.on('status', () => this.emitStatus());
    this.primary.on('error', (err) => {
      // Backup may still be receiving comments/gifts, but surface the primary
      // transport error for diagnostics.
      this.emitter.emit('error', err);
      this.emitStatus();
    });

    this.backup.on('connected', (info) => {
      console.log(
        `[TIKTOK][CHAT-BACKUP] connected @${info.username} room=${info.roomId || '-'}`
      );
      this.emitStatus();
    });
    this.backup.on('reconnecting', (attempt, delayMs) => {
      console.log(
        `[TIKTOK][CHAT-BACKUP] reconnect #${attempt} in ${delayMs}ms`
      );
    });
    this.backup.on('error', (err) => {
      console.warn('[TIKTOK][CHAT-BACKUP] ' + err.message);
    });
  }

  on<K extends keyof ConnectorEventMap>(
    event: K,
    listener: ConnectorEventMap[K]
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof ConnectorEventMap>(
    event: K,
    listener: ConnectorEventMap[K]
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  async connect(username: string): Promise<void> {
    const results = await Promise.allSettled([
      this.primary.connect(username),
      this.backup.connect(username),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(
          '[TIKTOK][HYBRID] connector start failed:',
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        );
      }
    }
    this.emitStatus();
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled([
      this.primary.disconnect(),
      this.backup.disconnect(),
    ]);
    this.emitStatus();
  }

  isConnected(): boolean {
    return this.primary.isConnected() || this.backup.isConnected();
  }

  getStatus(): ConnectorStatus {
    const primary = this.primary.getStatus();
    const backup = this.backup.getStatus();

    if (primary.connected || primary.live) {
      return {
        ...primary,
        name: this.name,
        note:
          'Realtime principal ativo. Comentários/presentes também possuem canal de backup independente. ' +
          `Backup: ${backup.label}.`,
      };
    }

    if (backup.connected || backup.live) {
      return {
        ...backup,
        name: this.name,
        note:
          'Canal principal está reconectando; backup de comentários/presentes continua ativo. ' +
          `Principal: ${primary.label}.`,
      };
    }

    return {
      ...primary,
      name: this.name,
      connected: false,
      live: false,
      note:
        'Dois canais TikTok tentando conectar: realtime principal + backup de comentários/presentes.',
    };
  }

  private handlePrimaryEvent(event: ArenaLiveEvent): void {
    if (event.type === 'comment') {
      if (!this.chatDedupe.check(this.commentFingerprint(event))) return;
    } else if (event.type === 'gift') {
      if (!this.giftDedupe.check(this.giftFingerprint(event))) return;
    }

    this.emitter.emit('event', event);
  }

  private handleBackupEvent(event: ArenaLiveEvent): void {
    // Likes MUST remain single-source (primary) to protect combo accuracy.
    if (event.type === 'comment') {
      if (!this.chatDedupe.check(this.commentFingerprint(event))) return;
      console.log(
        `[TIKTOK][CHAT-BACKUP] COMMENT @${event.user.username}: ${event.comment.slice(0, 100)}`
      );
      this.emitter.emit('event', event);
      return;
    }

    if (event.type === 'gift') {
      if (!this.giftDedupe.check(this.giftFingerprint(event))) return;
      console.log(
        `[TIKTOK][CHAT-BACKUP] GIFT @${event.user.username}: ${event.giftName} x${event.repeatCount}`
      );
      this.emitter.emit('event', event);
    }
  }

  private commentFingerprint(
    event: Extract<ArenaLiveEvent, { type: 'comment' }>
  ): string {
    return [
      'comment',
      event.user.userId,
      event.comment.trim().toLowerCase(),
    ].join(':');
  }

  private giftFingerprint(
    event: Extract<ArenaLiveEvent, { type: 'gift' }>
  ): string {
    return [
      'gift',
      event.user.userId,
      event.giftId,
      event.repeatCount,
    ].join(':');
  }

  private emitStatus(): void {
    this.emitter.emit('status', this.getStatus());
  }
}
