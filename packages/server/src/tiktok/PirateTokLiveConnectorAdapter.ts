import { EventEmitter } from 'events';
import type { ArenaLiveEvent, ArenaUser } from '@arena/shared';
import type {
  ConnectorEventMap,
  ConnectorStatus,
  ITikTokConnector,
  TikTokConnectionPhase,
} from './ITikTokConnector';
import { EventDedupe } from './eventDedupe';
import { mapTikTokGiftToArenaId } from './mapTikTokGift';

type PirateLib = {
  TikTokLiveClient: new (username: string) => {
    maxRetries: (count: number) => unknown;
    staleTimeout: (ms: number) => unknown;
    timeout: (ms: number) => unknown;
    on: (event: string, listener: (...args: any[]) => void) => unknown;
    connect: () => Promise<string>;
    disconnect: () => void;
  };
  EventType: Record<string, string>;
  GiftStreakTracker: new () => {
    process: (data: Record<string, unknown>) => {
      isFinal: boolean;
      eventGiftCount: number;
      totalGiftCount: number;
      eventDiamondCount: number;
      totalDiamondCount: number;
    };
    reset: () => void;
  };
};

const dynamicImport = new Function(
  'specifier',
  'return import(specifier)'
) as (specifier: string) => Promise<unknown>;

const RETRY_BASE_MS = 2_500;
const RETRY_MAX_MS = 15_000;

function normalizeUsername(input: string): string {
  const raw = String(input || '').trim();
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i)?.[1];
  return decodeURIComponent(fromUrl || raw)
    .replace(/^@/, '')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function pickAvatar(user: Record<string, unknown> | undefined): string | undefined {
  if (!user) return undefined;
  const direct =
    (user.profilePictureUrl as string | undefined) ||
    (user.avatarUrl as string | undefined);
  if (direct) return direct;

  for (const key of ['avatarLarge', 'avatarMedium', 'avatarThumb']) {
    const image = asRecord(user[key]);
    const list = image?.urlList;
    if (Array.isArray(list) && typeof list[0] === 'string') return list[0];
  }
  return undefined;
}

function toUser(value: unknown): ArenaUser {
  const user = asRecord(value) || {};
  const userId = String(
    user.id ??
      user.userId ??
      user.user_id ??
      user.secUid ??
      user.uniqueId ??
      'unknown'
  );
  const username = String(
    user.uniqueId ??
      user.unique_id ??
      user.username ??
      user.nickname ??
      userId
  );

  return {
    userId,
    username,
    nickname: user.nickname ? String(user.nickname) : undefined,
    avatarUrl: pickAvatar(user),
  };
}

function msgId(data: Record<string, unknown>): string | null {
  const common = asRecord(data.common);
  const value =
    common?.msgId ??
    common?.messageId ??
    data.msgId ??
    data.messageId ??
    data.logId ??
    null;
  return value == null ? null : String(value);
}

function labelFor(phase: TikTokConnectionPhase): string {
  switch (phase) {
    case 'waiting_live':
      return 'AGUARDANDO LIVE';
    case 'connecting':
      return 'CONECTANDO…';
    case 'connected':
      return 'LIVE DETECTADA / TIKTOK CONECTADO';
    case 'reconnecting':
      return 'TIKTOK RECONECTANDO';
    case 'disconnected':
      return 'DESCONECTADO';
    case 'error':
      return 'ERRO TIKTOK';
    default:
      return 'IDLE';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Primary production connector.
 *
 * Uses PirateTok's direct TikTok WebSocket transport. Unlike the previous
 * tiktok-live-connector path, it does not depend on a third-party signing
 * endpoint, which avoids the "illegal secret key" loop that was causing the
 * game to receive one initial event batch and then freeze.
 */
export class PirateTokLiveConnectorAdapter implements ITikTokConnector {
  readonly name = 'piratetok-live-js';

  private readonly emitter = new EventEmitter();
  private readonly dedupe = new EventDedupe(90_000);

  private lib: PirateLib | null = null;
  private client: InstanceType<PirateLib['TikTokLiveClient']> | null = null;
  private giftTracker: InstanceType<PirateLib['GiftStreakTracker']> | null = null;

  private username: string | null = null;
  private roomId: string | null = null;
  private phase: TikTokConnectionPhase = 'idle';
  private connectedFlag = false;
  private liveFlag = false;
  private reconnectAttempt = 0;
  private lastError: string | null = null;
  private lastEventAt: number | null = null;
  private lastConnectedAt: number | null = null;

  private generation = 0;
  private intentionalStop = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  on<K extends keyof ConnectorEventMap>(
    event: K,
    listener: ConnectorEventMap[K]
  ): void {
    this.emitter.on(event, listener as (...args: any[]) => void);
  }

  off<K extends keyof ConnectorEventMap>(
    event: K,
    listener: ConnectorEventMap[K]
  ): void {
    this.emitter.off(event, listener as (...args: any[]) => void);
  }

  isConnected(): boolean {
    return this.connectedFlag;
  }

  getStatus(): ConnectorStatus {
    return {
      phase: this.phase,
      label: labelFor(this.phase),
      mode: 'production',
      name: this.name,
      username: this.username,
      roomId: this.roomId,
      connected: this.connectedFlag,
      live: this.liveFlag,
      reconnectAttempt: this.reconnectAttempt,
      lastError: this.lastError,
      lastEventAt: this.lastEventAt,
      lastConnectedAt: this.lastConnectedAt,
      note:
        'Conexão direta com o WebSocket do TikTok, sem servidor externo de assinatura. CHAT / LIKE / GIFT em tempo real.',
    };
  }

  async connect(usernameInput: string): Promise<void> {
    const username = normalizeUsername(usernameInput);
    if (!username) throw new Error('TikTok username is required');

    const changed = this.username != null && this.username !== username;
    this.username = username;
    this.intentionalStop = false;
    this.clearRetry();

    if (changed) {
      this.roomId = null;
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.dedupe.clear();
    }

    await this.teardownClient();
    this.setPhase(this.reconnectAttempt ? 'reconnecting' : 'connecting');

    // Start asynchronously. Server boot/admin should never block for the whole
    // duration of the LIVE.
    await this.startClient();
  }

  async disconnect(): Promise<void> {
    this.intentionalStop = true;
    this.generation += 1;
    this.clearRetry();
    await this.teardownClient();
    this.connectedFlag = false;
    this.liveFlag = false;
    this.setPhase('disconnected');
    this.emitter.emit('disconnected', 'manual');
  }

  private async loadLib(): Promise<PirateLib> {
    if (this.lib) return this.lib;
    this.lib = (await dynamicImport('piratetok-live-js')) as PirateLib;
    return this.lib;
  }

  private async startClient(): Promise<void> {
    if (!this.username || this.intentionalStop) return;

    const lib = await this.loadLib();
    const gen = ++this.generation;
    this.giftTracker = new lib.GiftStreakTracker();

    const client = new lib.TikTokLiveClient(this.username);
    client.maxRetries(25);
    client.staleTimeout(70_000);
    client.timeout(12_000);

    this.client = client;

    const E = lib.EventType;

    client.on(E.connected, (info: unknown) => {
      if (gen !== this.generation || this.client !== client) return;
      const data = asRecord(info) || {};
      this.roomId = String(data.roomId || this.roomId || '');
      this.connectedFlag = true;
      this.liveFlag = true;
      this.reconnectAttempt = 0;
      this.lastConnectedAt = Date.now();
      this.lastError = null;
      this.setPhase('connected');
      console.log(
        `[TIKTOK][PIRATE] CONNECTED @${this.username} room=${this.roomId || '-'}`
      );
      this.emitter.emit('connected', {
        username: this.username!,
        roomId: this.roomId || undefined,
      });
    });

    client.on(E.chat, (raw: unknown) => {
      if (gen !== this.generation) return;
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      const comment = String(data.content ?? data.comment ?? '').trim();
      if (!comment || user.userId === 'unknown') return;

      const fingerprint =
        msgId(data) ||
        `chat:${user.userId}:${comment}:${String(asRecord(data.common)?.createTime ?? '')}`;
      if (!this.dedupe.check('chat:' + fingerprint)) return;

      this.push(
        { type: 'comment', user, comment, timestamp: Date.now() },
        '[COMMENT]',
        `@${user.username} id=${user.userId}: ${comment.slice(0, 100)}`
      );
    });

    client.on(E.like, (raw: unknown) => {
      if (gen !== this.generation) return;
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      if (user.userId === 'unknown') return;

      // PirateTok exposes the reliable per-event delta as "count". Never use
      // room total for personal rewards.
      const likeCount = Math.max(1, Number(data.count ?? data.likeCount ?? 1) || 1);
      const totalLikeCount = Number(data.total ?? data.totalLikeCount ?? 0) || undefined;
      const fingerprint =
        msgId(data) ||
        `like:${user.userId}:${String(asRecord(data.common)?.createTime ?? '')}:${totalLikeCount ?? ''}:${likeCount}`;
      if (!this.dedupe.check('like:' + fingerprint)) return;

      this.push(
        {
          type: 'like',
          user,
          likeCount,
          totalLikeCount,
          timestamp: Date.now(),
        },
        '[LIKE]',
        `@${user.username} +${likeCount}${totalLikeCount ? ` totalRoom=${totalLikeCount}` : ''}`
      );
    });

    client.on(E.gift, (raw: unknown) => {
      if (gen !== this.generation) return;
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      if (user.userId === 'unknown') return;

      const gift = asRecord(data.gift) || {};
      const tracker = this.giftTracker;
      const streak = tracker?.process(data);
      const repeatCount = Math.max(
        1,
        streak?.eventGiftCount ??
          Number(data.repeatCount ?? data.comboCount ?? 1) ??
          1
      );

      // Combo progress packets with zero new gifts must not pay twice.
      if (streak && streak.eventGiftCount <= 0) return;

      const giftName = String(gift.name ?? data.giftName ?? '');
      const giftIdRaw =
        data.giftId ??
        gift.id ??
        gift.giftId ??
        gift.gift_id ??
        giftName;
      const diamondPerGift =
        Number(gift.diamondCount ?? gift.diamond_count ?? data.diamondCount ?? 0) || 0;
      const coinValue = Math.max(
        diamondPerGift,
        Number(streak?.eventDiamondCount ?? 0) || 0
      );

      const mapped = mapTikTokGiftToArenaId(
        giftIdRaw as string | number | undefined,
        giftName,
        coinValue
      );

      const fingerprint =
        msgId(data) ||
        `gift:${user.userId}:${String(data.groupId ?? '')}:${String(data.repeatCount ?? '')}:${mapped.arenaGiftId}`;
      if (!this.dedupe.check('gift:' + fingerprint)) return;

      this.push(
        {
          type: 'gift',
          user,
          giftId: mapped.arenaGiftId,
          giftName: giftName || mapped.arenaGiftId,
          repeatCount,
          repeatEnd: streak?.isFinal ?? Boolean(data.repeatEnd),
          coinValue: Math.max(coinValue, diamondPerGift),
          timestamp: Date.now(),
        },
        '[GIFT]',
        `@${user.username} ${giftName || mapped.arenaGiftId} x${repeatCount} → ${mapped.arenaGiftId}`
      );
    });

    client.on(E.follow, (raw: unknown) => {
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      if (user.userId === 'unknown') return;
      this.push(
        { type: 'follow', user, timestamp: Date.now() },
        '[FOLLOW]',
        `@${user.username}`
      );
    });

    client.on(E.share, (raw: unknown) => {
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      if (user.userId === 'unknown') return;
      this.push(
        { type: 'share', user, timestamp: Date.now() },
        '[SHARE]',
        `@${user.username}`
      );
    });

    client.on(E.member, (raw: unknown) => {
      const data = asRecord(raw) || {};
      const user = toUser(data.user);
      if (user.userId === 'unknown') return;
      this.push(
        { type: 'join', user, timestamp: Date.now() },
        '[JOIN]',
        `@${user.username}`
      );
    });

    client.on(E.liveEnded, () => {
      if (gen !== this.generation) return;
      console.log(`[TIKTOK][PIRATE] LIVE ENDED @${this.username}`);
      this.connectedFlag = false;
      this.liveFlag = false;
      this.setPhase('waiting_live', 'LIVE finalizada');
    });

    client.on(E.reconnecting, (raw: unknown) => {
      if (gen !== this.generation) return;
      const data = asRecord(raw) || {};
      const attempt = Math.max(1, Number(data.attempt ?? this.reconnectAttempt + 1));
      const delayMs = Math.max(0, Number(data.delayMs ?? 0));
      this.reconnectAttempt = attempt;
      this.connectedFlag = false;
      this.setPhase('reconnecting', this.lastError);
      console.log(
        `[TIKTOK][PIRATE] reconnecting #${attempt} in ${delayMs}ms`
      );
      this.emitter.emit('reconnecting', attempt, delayMs);
    });

    client.on('error', (err: unknown) => {
      if (gen !== this.generation) return;
      this.lastError = errorMessage(err);
      console.warn(`[TIKTOK][PIRATE] ${this.lastError}`);
      this.emitter.emit('error', err instanceof Error ? err : new Error(this.lastError));
      this.emitStatus();
    });

    client.on(E.disconnected, () => {
      if (gen !== this.generation || this.intentionalStop) return;
      this.connectedFlag = false;
      console.warn(`[TIKTOK][PIRATE] disconnected @${this.username}`);
      this.emitStatus();
    });

    // connect() owns PirateTok's internal reconnect loop. Do not await it here,
    // otherwise the Express server would wait until the LIVE ends.
    void client
      .connect()
      .then(() => {
        if (gen !== this.generation || this.intentionalStop) return;
        this.connectedFlag = false;
        this.liveFlag = false;
        this.scheduleRetry('session ended/disconnected');
      })
      .catch((err: unknown) => {
        if (gen !== this.generation || this.intentionalStop) return;
        const message = errorMessage(err);
        this.lastError = message;

        const offline =
          /not currently live|not online|offline|hostnotonline/i.test(message);
        if (offline) {
          this.liveFlag = false;
          this.connectedFlag = false;
          this.setPhase('waiting_live', message);
        } else {
          this.connectedFlag = false;
          this.setPhase('reconnecting', message);
        }

        console.warn(
          `[TIKTOK][PIRATE] connect @${this.username}: ${message}`
        );
        this.scheduleRetry(offline ? 'waiting_live' : 'connect_error');
      });
  }

  private push(event: ArenaLiveEvent, prefix: string, detail: string): void {
    this.lastEventAt = Date.now();
    this.connectedFlag = true;
    this.liveFlag = true;
    if (this.phase !== 'connected') this.setPhase('connected');
    console.log(`${prefix} ${detail}`);
    this.emitter.emit('event', event);
    this.emitStatus();
  }

  private scheduleRetry(reason: string): void {
    if (this.intentionalStop || !this.username) return;
    this.clearRetry();

    this.reconnectAttempt += 1;
    const delay = Math.min(
      RETRY_MAX_MS,
      RETRY_BASE_MS * Math.max(1, Math.min(6, this.reconnectAttempt))
    );

    if (this.phase !== 'waiting_live') {
      this.setPhase('reconnecting', this.lastError);
    }

    console.log(
      `[TIKTOK][PIRATE] retry #${this.reconnectAttempt} in ${delay}ms (${reason})`
    );
    this.emitter.emit('reconnecting', this.reconnectAttempt, delay);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.intentionalStop || !this.username) return;
      void this.connect(this.username).catch((err) => {
        this.lastError = errorMessage(err);
        this.scheduleRetry('retry_throw');
      });
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private async teardownClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.giftTracker?.reset();
    this.giftTracker = null;
    if (!client) return;
    try {
      client.disconnect();
    } catch {
      // ignored
    }
  }

  private setPhase(phase: TikTokConnectionPhase, error?: string | null): void {
    this.phase = phase;
    if (error !== undefined) this.lastError = error;
    this.emitStatus();
  }

  private emitStatus(): void {
    this.emitter.emit('status', this.getStatus());
  }
}
