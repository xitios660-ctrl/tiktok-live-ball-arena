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
 * - Legacy connector runs in parallel as a CHAT/GIFT/LIKE safety net because
 *   its signed fallback often sees interaction events that TikTok temporarily
 *   omits from the direct WSS.
 * - Both transports are kept on the SAME current room and cross-source
 *   duplicates are suppressed before GameLoop sees them.
 */
export class HybridTikTokConnector implements ITikTokConnector {
  readonly name = 'hybrid-tiktok-live';

  private readonly emitter = new EventEmitter();
  private readonly primary = new PirateTokConnectorAdapter();
  private readonly backup = new TikTokLiveConnectorAdapter();
  private readonly chatDedupe = new EventDedupe(2_000, 2_000);
  private readonly giftDedupe = new EventDedupe(3_000, 2_000);
  private readonly likeDedupe = new EventDedupe(1_200, 5_000);
  private username: string | null = null;
  private roomSyncTimer: ReturnType<typeof setInterval> | null = null;
  private lastPrimarySignalAt = 0;
  private lastBackupSignalAt = 0;
  private primaryRefreshInFlight = false;
  private backupRefreshInFlight = false;

  constructor() {
    this.primary.on('event', (event) => this.handlePrimaryEvent(event));
    this.backup.on('event', (event) => this.handleBackupEvent(event));

    this.primary.on('connected', (info) => {
      this.lastPrimarySignalAt = Date.now();
      this.emitter.emit('connected', info);
      this.emitStatus();

      // The backup can remain attached to the previous TikTok room when the
      // host restarts/restarts LIVE. Force it to resolve the broadcaster again
      // whenever the realtime primary discovers a different current room.
      const backupStatus = this.backup.getStatus();
      if (
        this.username &&
        info.roomId &&
        backupStatus.roomId !== info.roomId
      ) {
        console.warn(
          `[TIKTOK][HYBRID] room drift primary=${info.roomId} backup=${backupStatus.roomId || '-'}; resync backup`
        );
        void this.backup.connect(this.username).catch((err) => {
          console.warn(
            '[TIKTOK][HYBRID] backup room resync failed:',
            err instanceof Error ? err.message : String(err)
          );
        });
      }
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
      this.lastBackupSignalAt = Date.now();
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
    this.username = username;
    const now = Date.now();
    this.lastPrimarySignalAt = now;
    this.lastBackupSignalAt = now;
    this.startRoomSync();

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
    this.stopRoomSync();
    this.username = null;

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
          'Realtime principal ativo. Comentários, likes e presentes também possuem canal de backup independente e sincronizado à sala atual. ' +
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
    this.lastPrimarySignalAt = Date.now();
    if (event.type === 'comment') {
      if (!this.chatDedupe.check(this.commentFingerprint(event))) return;
    } else if (event.type === 'gift') {
      if (!this.giftDedupe.check(this.giftFingerprint(event))) return;
    } else if (event.type === 'like') {
      if (!this.likeDedupe.check(this.likeFingerprint(event))) return;
    }

    this.emitter.emit('event', event);
  }

  private handleBackupEvent(event: ArenaLiveEvent): void {
    this.lastBackupSignalAt = Date.now();
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
      return;
    }

    if (event.type === 'like') {
      if (!this.likeDedupe.check(this.likeFingerprint(event))) return;
      console.log(
        `[TIKTOK][LIKE-BACKUP] @${event.user.username} +${event.likeCount} total=${event.totalLikeCount ?? '?'}`
      );
      this.emitter.emit('event', event);
    }
  }

  private commentFingerprint(
    event: Extract<ArenaLiveEvent, { type: 'comment' }>
  ): string {
    if (event.messageId) return 'comment:id:' + event.messageId;
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

  private likeFingerprint(
    event: Extract<ArenaLiveEvent, { type: 'like' }>
  ): string {
    // totalLikeCount is room-global but monotonic and excellent for
    // cross-source duplicate suppression. When TikTok omits it, use a short
    // time bucket so two connectors reporting the same batch do not double it.
    if (event.totalLikeCount != null) {
      return [
        'like',
        event.user.userId,
        'total',
        event.totalLikeCount,
        event.likeCount,
      ].join(':');
    }

    return [
      'like',
      event.user.userId,
      event.likeCount,
      Math.floor(Date.now() / 300),
    ].join(':');
  }

  private startRoomSync(): void {
    this.stopRoomSync();

    // TikTok can leave a socket looking "connected" while interaction events
    // silently stop. Keep two transports alive and refresh them at different
    // cadences so there is always another channel listening while one recovers.
    this.roomSyncTimer = setInterval(() => {
      if (!this.username) return;

      const now = Date.now();
      const primary = this.primary.getStatus();
      const backup = this.backup.getStatus();

      const primaryBusy =
        primary.phase === 'connecting' || primary.phase === 'reconnecting';
      const backupBusy =
        backup.phase === 'connecting' || backup.phase === 'reconnecting';

      const backupSilentMs = now - (this.lastBackupSignalAt || now);
      const primarySilentMs = now - (this.lastPrimarySignalAt || now);

      const backupNeedsRefresh =
        !backup.connected ||
        (!!primary.roomId && backup.roomId !== primary.roomId) ||
        (primary.live && backupSilentMs > 24_000);

      // Refresh backup first. It is the catch-up channel for CHAT/GIFT/LIKE.
      if (
        backupNeedsRefresh &&
        !backupBusy &&
        !this.backupRefreshInFlight
      ) {
        this.backupRefreshInFlight = true;
        this.lastBackupSignalAt = now;
        console.warn(
          `[TIKTOK][HYBRID] refresh backup room=${backup.roomId || '-'} primary=${primary.roomId || '-'} silent=${Math.round(backupSilentMs / 1000)}s`
        );

        void this.backup
          .connect(this.username)
          .catch((err) => {
            console.warn(
              '[TIKTOK][HYBRID] backup refresh failed:',
              err instanceof Error ? err.message : String(err)
            );
          })
          .finally(() => {
            this.backupRefreshInFlight = false;
          });
        return;
      }

      // Only recycle the primary when the backup was not refreshed in this
      // tick. This prevents both receivers from being offline simultaneously.
      const primaryNeedsRefresh =
        !primary.connected ||
        (backup.live && primarySilentMs > 48_000);

      if (
        primaryNeedsRefresh &&
        !primaryBusy &&
        !this.primaryRefreshInFlight
      ) {
        this.primaryRefreshInFlight = true;
        this.lastPrimarySignalAt = now;
        console.warn(
          `[TIKTOK][HYBRID] refresh primary room=${primary.roomId || '-'} silent=${Math.round(primarySilentMs / 1000)}s`
        );

        void this.primary
          .connect(this.username)
          .catch((err) => {
            console.warn(
              '[TIKTOK][HYBRID] primary refresh failed:',
              err instanceof Error ? err.message : String(err)
            );
          })
          .finally(() => {
            this.primaryRefreshInFlight = false;
          });
      }
    }, 8_000);
  }

  private stopRoomSync(): void {
    if (this.roomSyncTimer) clearInterval(this.roomSyncTimer);
    this.roomSyncTimer = null;
    this.primaryRefreshInFlight = false;
    this.backupRefreshInFlight = false;
  }

  private emitStatus(): void {
    this.emitter.emit('status', this.getStatus());
  }
}
