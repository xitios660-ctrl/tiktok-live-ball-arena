import { EventEmitter } from 'events';
import type { ArenaLiveEvent, ArenaUser } from '@arena/shared';
import type {
  ITikTokConnector,
  ConnectorEventMap,
  ConnectorStatus,
  TikTokConnectionPhase,
} from './ITikTokConnector';
import { EventDedupe } from './eventDedupe';
import { mapTikTokGiftToArenaId } from './mapTikTokGift';

type TikTokLib = typeof import('tiktok-live-connector');

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 60_000;
const STALE_MS = 90_000;

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.info === 'string') return o.info;
    if (typeof o.message === 'string') return o.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
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

function pickAvatar(u: Record<string, unknown> | undefined): string | undefined {
  if (!u) return undefined;
  const thumb = u.avatarThumb as { urlList?: string[] } | undefined;
  const medium = u.avatarMedium as { urlList?: string[] } | undefined;
  return (
    (u.profilePictureUrl as string | undefined) ||
    medium?.urlList?.[0] ||
    thumb?.urlList?.[0] ||
    undefined
  );
}

function toUser(u: Record<string, unknown> | undefined): ArenaUser {
  const userId = String(u?.userId || u?.id || u?.uniqueId || 'unknown');
  const username = String(u?.uniqueId || u?.nickname || userId);
  return {
    userId,
    username,
    nickname: u?.nickname ? String(u.nickname) : undefined,
    avatarUrl: pickAvatar(u),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function candidateScore(
  candidate: Record<string, unknown>,
  hostUsername?: string | null
): number {
  let score = 0;
  const userId = String(candidate.userId || candidate.id || '');
  const uniqueId = String(
    candidate.uniqueId ||
      candidate.unique_id ||
      candidate.username ||
      ''
  );
  const nickname = String(candidate.nickname || '');

  if (userId) score += 6;
  if (uniqueId) score += 5;
  if (nickname) score += 2;
  if (pickAvatar(candidate)) score += 2;

  const host = (hostUsername || '').replace(/^@/, '').trim().toLowerCase();
  if (host && uniqueId.toLowerCase() === host) score -= 30;

  return score;
}

function extractCommentText(data: Record<string, unknown>): string {
  const nested = [
    data,
    asRecord(data.data),
    asRecord(data.chat),
    asRecord(data.message),
  ].filter(Boolean) as Record<string, unknown>[];

  for (const container of nested) {
    for (const key of ['comment', 'commentText', 'text', 'content', 'message']) {
      const value = container[key];
      if (typeof value === 'string' && value.trim()) return value;

      const obj = asRecord(value);
      if (obj) {
        for (const subKey of ['text', 'content', 'comment']) {
          const nestedValue = obj[subKey];
          if (typeof nestedValue === 'string' && nestedValue.trim()) {
            return nestedValue;
          }
        }
      }
    }
  }
  return '';
}

export function parseTikTokChatPayload(
  raw: unknown,
  hostUsername?: string | null
): { user: ArenaUser; comment: string } {
  const data = asRecord(raw) || {};
  const nestedData = asRecord(data.data);

  const candidates = [
    data,
    asRecord(data.user),
    asRecord(data.userInfo),
    asRecord(data.author),
    asRecord(data.sender),
    nestedData,
    asRecord(nestedData?.user),
    asRecord(nestedData?.userInfo),
    asRecord(nestedData?.author),
    asRecord(nestedData?.sender),
    asRecord(asRecord(data.common)?.user),
  ].filter(Boolean) as Record<string, unknown>[];

  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: candidateScore(candidate, hostUsername),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = ranked[0]?.candidate;
  return {
    user: toUser(best),
    comment: extractCommentText(data),
  };
}

/**
 * PRODUCTION adapter for `tiktok-live-connector` (unofficial Webcast WebSocket).
 * Maps chat/gift/like/share/member/follow → ArenaLiveEvent (same GameLoop path as DEMO).
 *
 * Offline host → phase `waiting_live` + exponential backoff (never silent death).
 * Mid-round drop → `reconnecting`; GameLoop keeps running.
 */
export class TikTokLiveConnectorAdapter implements ITikTokConnector {
  readonly name = 'tiktok-live-connector';

  private readonly emitter = new EventEmitter();
  private readonly dedupe = new EventDedupe(90_000);

  private lib: TikTokLib | null = null;
  private connection: InstanceType<TikTokLib['TikTokLiveConnection']> | null = null;
  private username: string | null = null;
  private roomId: string | null = null;
  private phase: TikTokConnectionPhase = 'idle';
  private connectedFlag = false;
  private liveFlag = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalStop = false;
  private lastError: string | null = null;
  private lastEventAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private lastWsAt: number | null = null;
  private generation = 0;
  /** Helps recover rapid tap bursts when TikTok emits per-user LIKE as +1. */
  private lastTotalLikeCount: number | null = null;
  private lastLikeUserId: string | null = null;
  private lastLikeAt = 0;

  async connect(username: string): Promise<void> {
    this.username = username.replace(/^@/, '').trim();
    this.intentionalStop = false;
    if (!this.username) {
      const err = new Error('[TIKTOK] TIKTOK_USERNAME empty — set host uniqueId');
      this.setPhase('error', err.message);
      throw err;
    }
    await this.loadLib();
    await this.tryConnect();
  }

  async disconnect(): Promise<void> {
    this.intentionalStop = true;
    this.generation += 1;
    this.clearReconnect();
    this.stopHeartbeat();
    await this.teardown();
    this.connectedFlag = false;
    this.liveFlag = false;
    this.setPhase('disconnected');
    this.emitter.emit('disconnected', 'manual');
  }

  on<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof ConnectorEventMap>(event: K, listener: ConnectorEventMap[K]): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  isConnected(): boolean {
    return this.connectedFlag && this.liveFlag;
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
      note: 'Unofficial Webcast WS (tiktok-live-connector). Needs host LIVE. Not an official TikTok API.',
    };
  }

  private async loadLib(): Promise<TikTokLib> {
    if (this.lib) return this.lib;
    try {
      this.lib = (await import('tiktok-live-connector')) as TikTokLib;
      console.log('[TIKTOK] tiktok-live-connector loaded');
      return this.lib;
    } catch (err) {
      const msg = `[TIKTOK] Failed to import tiktok-live-connector: ${
        err instanceof Error ? err.message : String(err)
      }. npm i tiktok-live-connector@2.5.0`;
      this.setPhase('error', msg);
      throw new Error(msg);
    }
  }

  private async tryConnect(): Promise<void> {
    if (this.intentionalStop || !this.username) return;
    const gen = ++this.generation;
    this.setPhase(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
    await this.teardown();

    const lib = await this.loadLib();
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    const signApiKey =
      process.env.TIKTOK_SIGN_API_KEY ||
      process.env.EULER_STREAM_API_KEY ||
      undefined;
    const conn = new TikTokLiveConnection(this.username, {
      processInitialData: false,
      // Extended gift gallery hits Euler Business routes; gifts still work via Webcast events.
      enableExtendedGiftInfo: false,
      fetchRoomInfoOnConnect: true,
      ...(signApiKey ? { signApiKey } : {}),
    });
    this.connection = conn;

    conn.on(ControlEvent.CONNECTED, (state: { roomId?: string | number }) => {
      if (gen !== this.generation) return;
      this.onLiveConnected(state?.roomId != null ? String(state.roomId) : null);
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (gen !== this.generation) return;
      console.warn(`[TIKTOK] socket disconnected @${this.username}`);
      this.connectedFlag = false;
      this.liveFlag = false;
      this.stopHeartbeat();
      this.emitter.emit('disconnected', 'websocket');
      if (!this.intentionalStop) {
        this.setPhase('reconnecting');
        this.scheduleReconnect('disconnected');
      } else {
        this.setPhase('disconnected');
      }
    });

    conn.on(ControlEvent.ERROR, (err: unknown) => {
      if (gen !== this.generation) return;
      const msg = errMsg(err);
      this.lastError = msg;
      const soft = /room id|offline|not.*live|isn['’]?t online|is not online|not online/i.test(msg);
      if (soft) console.warn('[TIKTOK]', msg);
      else {
        console.error('[TIKTOK][ERROR]', msg);
        this.emitter.emit('error', err instanceof Error ? err : new Error(msg));
      }
    });

    conn.on(WebcastEvent.CHAT, (data: unknown) => this.handleChat(data));
    conn.on(WebcastEvent.GIFT, (data: unknown) => this.handleGift(data));
    conn.on(WebcastEvent.LIKE, (data: unknown) => this.handleLike(data));
    conn.on(WebcastEvent.SHARE, (data: unknown) => this.handleShare(data));
    conn.on(WebcastEvent.FOLLOW, (data: unknown) => this.handleFollow(data));
    conn.on(WebcastEvent.MEMBER, (data: unknown) => this.handleMember(data));
    conn.on(WebcastEvent.STREAM_END, () => {
      if (gen !== this.generation) return;
      console.log(`[TIKTOK] STREAM_END @${this.username} — waiting next live`);
      this.connectedFlag = false;
      this.liveFlag = false;
      this.stopHeartbeat();
      this.setPhase('waiting_live', 'stream ended');
      this.scheduleReconnect('stream_end');
    });
    conn.on(WebcastEvent.ROOM_USER, () => {
      this.lastWsAt = Date.now();
    });

    try {
      const state = await conn.connect();
      if (gen !== this.generation) return;
      if (state?.roomId != null) this.roomId = String(state.roomId);
      if (!this.connectedFlag) {
        this.onLiveConnected(this.roomId);
      }
    } catch (err) {
      if (gen !== this.generation) return;
      this.connectedFlag = false;
      this.liveFlag = false;
      const msg = errMsg(err);
      this.lastError = msg;
      const offline =
        (err instanceof Error && err.name === 'UserOfflineError') ||
        /offline|not.*live|user_offline|currently.*not.*live|isn['’]?t online|is not online|not online|failed to retrieve room id|room id/i.test(msg);

      if (offline) {
        console.log(`[TIKTOK] AGUARDANDO LIVE — @${this.username} (${msg})`);
        this.setPhase('waiting_live', msg);
      } else {
        console.error('[TIKTOK] connect failed:', msg);
        this.setPhase(this.reconnectAttempt > 0 ? 'reconnecting' : 'error', msg);
        this.emitter.emit('error', err instanceof Error ? err : new Error(msg));
      }
      if (!this.intentionalStop) {
        this.scheduleReconnect(offline ? 'waiting_live' : 'connect_error');
      }
    }
  }

  private onLiveConnected(roomId: string | null): void {
    this.connectedFlag = true;
    this.liveFlag = true;
    this.reconnectAttempt = 0;
    this.lastConnectedAt = Date.now();
    this.lastWsAt = Date.now();
    this.lastError = null;
    this.lastTotalLikeCount = null;
    this.lastLikeUserId = null;
    this.lastLikeAt = 0;
    if (roomId) this.roomId = roomId;
    this.setPhase('connected');
    console.log(
      `[TIKTOK] LIVE DETECTADA / TIKTOK CONECTADO @${this.username} room=${this.roomId || '?'}`
    );
    this.emitter.emit('connected', {
      username: this.username!,
      roomId: this.roomId || undefined,
    });
    this.startHeartbeat();
  }

  private scheduleReconnect(reason: string): void {
    if (this.intentionalStop || !this.username) return;
    this.clearReconnect();
    this.reconnectAttempt += 1;
    const delayMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(this.reconnectAttempt - 1, 6));
    console.log(`[TIKTOK] reconnect #${this.reconnectAttempt} in ${delayMs}ms (${reason})`);
    if (this.phase !== 'waiting_live') this.setPhase('reconnecting');
    this.emitter.emit('reconnecting', this.reconnectAttempt, delayMs);
    this.reconnectTimer = setTimeout(() => {
      void this.tryConnect();
    }, delayMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.intentionalStop || !this.connectedFlag) return;
      const last = this.lastWsAt || this.lastConnectedAt || 0;
      const silent = Date.now() - last;
      if (silent > STALE_MS) {
        console.warn(`[TIKTOK] heartbeat stale ${Math.round(silent / 1000)}s — reconnect`);
        this.connectedFlag = false;
        this.liveFlag = false;
        this.setPhase('reconnecting', 'heartbeat timeout');
        void this.teardown().then(() => this.scheduleReconnect('heartbeat'));
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async teardown(): Promise<void> {
    const conn = this.connection;
    this.connection = null;
    if (!conn) return;
    try {
      (conn as unknown as EventEmitter).removeAllListeners?.();
      await conn.disconnect();
    } catch {
      /* ignore */
    }
  }

  private setPhase(phase: TikTokConnectionPhase, err?: string): void {
    this.phase = phase;
    if (err) this.lastError = err;
    this.emitter.emit('status', this.getStatus());
  }

  private push(ev: ArenaLiveEvent, tag: string, detail: string): void {
    this.lastEventAt = Date.now();
    this.lastWsAt = Date.now();
    console.log(`${tag} ${detail}`);
    this.emitter.emit('event', ev);
  }

  private handleChat(raw: unknown): void {
    const { user, comment } = parseTikTokChatPayload(raw, this.username);
    this.push(
      { type: 'comment', user, comment, timestamp: Date.now() },
      '[COMMENT]',
      `@${user.username} id=${user.userId}: ${comment.slice(0, 80)}`
    );
  }

  private handleGift(raw: unknown): void {
    const data = raw as Record<string, unknown>;
    const giftObj = data.gift as { gift_type?: number; name?: string; diamond_count?: number } | undefined;
    const giftType = Number(data.giftType ?? giftObj?.gift_type ?? 0);
    const repeatEnd = Boolean(data.repeatEnd ?? data.repeat_end);
    if (giftType === 1 && !repeatEnd) return;

    const user = toUser(data.user as Record<string, unknown> | undefined);
    const extended = data.extendedGiftInfo as { name?: string; diamond_count?: number } | undefined;
    const details = data.giftDetails as { giftName?: string } | undefined;
    const rawName = String(data.giftName || extended?.name || details?.giftName || giftObj?.name || '');
    const diamond =
      Number(data.diamondCount ?? extended?.diamond_count ?? giftObj?.diamond_count ?? 0) || 0;
    const mapped = mapTikTokGiftToArenaId(
      data.giftId as string | number | undefined,
      rawName,
      diamond
    );
    const repeatCount = Math.max(1, Number(data.repeatCount ?? data.repeat_count ?? 1));
    const common = data.common as { msgId?: string } | undefined;
    const fp = String(
      data.msgId ||
        common?.msgId ||
        `gift:${user.userId}:${mapped.arenaGiftId}:${repeatCount}:${Math.floor(Date.now() / 2000)}`
    );
    if (!this.dedupe.check(fp)) {
      console.log(`[GIFT] dedupe skip ${fp}`);
      return;
    }

    this.push(
      {
        type: 'gift',
        user,
        giftId: mapped.arenaGiftId,
        giftName: mapped.giftName,
        repeatCount,
        repeatEnd: true,
        coinValue: mapped.coinValue || diamond,
        timestamp: Date.now(),
      },
      '[GIFT]',
      `@${user.username} → ${mapped.giftName} x${repeatCount} (${mapped.coinValue}💎)`
    );
  }

  private handleLike(raw: unknown): void {
    const data = asRecord(raw) || {};
    const nestedData = asRecord(data.data);
    const nestedUser =
      asRecord(data.user) ||
      asRecord(nestedData?.user) ||
      asRecord(data.userInfo) ||
      asRecord(nestedData?.userInfo);

    // Connector versions have used nested data.user, nested data.data.user and
    // top-level user fields. Accept all of them so COMMENT and LIKE resolve to
    // the exact same player id in production.
    const user = toUser(nestedUser || nestedData || data);

    const rawLikeCount = Math.max(
      1,
      Number(
        data.likeCount ??
          data.like_count ??
          data.count ??
          nestedData?.likeCount ??
          nestedData?.like_count ??
          nestedData?.count ??
          1
      ) || 1
    );

    const totalRaw =
      data.totalLikeCount ??
      data.total_like_count ??
      data.totalLikes ??
      nestedData?.totalLikeCount ??
      nestedData?.total_like_count ??
      nestedData?.totalLikes;
    const totalLikeCount =
      totalRaw != null && Number.isFinite(Number(totalRaw))
        ? Math.max(0, Number(totalRaw))
        : undefined;

    const now = Date.now();
    let totalDelta = 0;
    if (
      totalLikeCount != null &&
      this.lastTotalLikeCount != null &&
      totalLikeCount >= this.lastTotalLikeCount
    ) {
      totalDelta = Math.floor(totalLikeCount - this.lastTotalLikeCount);
    }

    // TikTok can throttle a rapid heart burst into sparse +1 per-user events
    // while the room total still moves by the real number of taps. Only use
    // that delta when consecutive events belong to the SAME user within a
    // short burst window, reducing accidental cross-user attribution.
    const sameUserBurst =
      this.lastLikeUserId === user.userId &&
      now - this.lastLikeAt <= 4_000;

    const creditedLikeCount = sameUserBurst
      ? Math.max(rawLikeCount, Math.min(totalDelta, 100))
      : rawLikeCount;

    if (totalLikeCount != null) this.lastTotalLikeCount = totalLikeCount;
    this.lastLikeUserId = user.userId;
    this.lastLikeAt = now;

    this.push(
      {
        type: 'like',
        user,
        likeCount: creditedLikeCount,
        totalLikeCount,
        timestamp: now,
      },
      '[LIKE]',
      `@${user.username} +${creditedLikeCount} (raw=${rawLikeCount}, totalDelta=${totalDelta}, total=${totalLikeCount ?? '?'}, id=${user.userId})`
    );
  }

  private handleShare(raw: unknown): void {
    const data = raw as {
      user?: Record<string, unknown>;
      msgId?: string;
      common?: { msgId?: string };
    };
    const user = toUser(data.user);
    const fp = String(
      data.msgId || data.common?.msgId || `share:${user.userId}:${Math.floor(Date.now() / 3000)}`
    );
    if (!this.dedupe.check(fp)) return;
    this.push({ type: 'share', user, timestamp: Date.now() }, '[SHARE]', `@${user.username}`);
  }

  private handleFollow(raw: unknown): void {
    const data = raw as { user?: Record<string, unknown> };
    const user = toUser(data.user);
    this.push({ type: 'follow', user, timestamp: Date.now() }, '[FOLLOW]', `@${user.username}`);
  }

  private handleMember(raw: unknown): void {
    const data = raw as { user?: Record<string, unknown> };
    const user = toUser(data.user);
    this.push({ type: 'join', user, timestamp: Date.now() }, '[JOIN]', `@${user.username}`);
  }
}
