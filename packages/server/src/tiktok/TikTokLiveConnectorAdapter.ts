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
const MAX_BACKOFF_MS = 10_000;
const STALE_MS = 90_000;
const POLL_FALLBACK_MS = 2_000;

function normalizeUsername(input: string): string {
  const raw = String(input || '').trim();
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i)?.[1];
  return decodeURIComponent(fromUrl || raw)
    .replace(/^@/, '')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .trim();
}

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

function rawMessageId(data: Record<string, unknown>): string | null {
  const nested = asRecord(data.data);
  const common =
    asRecord(data.common) ||
    asRecord(nested?.common) ||
    asRecord(data.message)?.common as Record<string, unknown> | undefined;

  const value =
    data.msgId ??
    data.messageId ??
    nested?.msgId ??
    nested?.messageId ??
    common?.msgId ??
    common?.messageId;

  return value != null && String(value).trim() ? String(value) : null;
}

function rawCreatedAt(data: Record<string, unknown>): string {
  const nested = asRecord(data.data);
  const value =
    data.createTime ??
    data.create_time ??
    data.timestamp ??
    nested?.createTime ??
    nested?.create_time ??
    nested?.timestamp ??
    '';
  return String(value || '');
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
  private pollFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private pollFallbackActive = false;
  private pollFallbackBusy = false;
  private pollCursor = '';
  private pollFailures = 0;
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
    const nextUsername = normalizeUsername(username);
    const changed = this.username != null && this.username !== nextUsername;
    this.username = nextUsername;
    this.intentionalStop = false;
    if (changed) {
      console.log(`[TIKTOK] switching broadcaster → @${this.username}`);
      this.reconnectAttempt = 0;
      this.lastError = null;
      this.roomId = null;
      this.lastTotalLikeCount = null;
      this.lastLikeUserId = null;
      this.lastLikeAt = 0;
    }
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
    this.stopPollingFallback();
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
      note: this.pollFallbackActive
        ? 'TikTok LIVE conectado por fallback HTTP incremental (WebSocket rejeitado pelo TikTok). Comentários, likes e presentes continuam sendo processados.'
        : 'Unofficial Webcast WS (tiktok-live-connector). Needs host LIVE. Not an official TikTok API.',
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
    this.stopPollingFallback();
    await this.teardown();

    const lib = await this.loadLib();
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    const signApiKey =
      process.env.TIKTOK_SIGN_API_KEY ||
      process.env.EULER_STREAM_API_KEY ||
      undefined;
    const conn = new TikTokLiveConnection(this.username, {
      // Process the initial event batch too: if someone comments while the
      // WebSocket is finishing its handshake, that comment is not lost.
      processInitialData: true,
      // Gift name/id/count already arrive in WebcastGiftMessage. Avoid an
      // extra paid/fragile gift-gallery request on every reconnect.
      enableExtendedGiftInfo: false,
      // Do not let a flaky room-info "offline" check veto a valid WebSocket.
      // connect() still has to resolve a real room id, so this does not create
      // fake live events.
      fetchRoomInfoOnConnect: false,
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
      this.stopPollingFallback();
      this.setPhase('waiting_live', 'stream ended');
      this.scheduleReconnect('stream_end');
    });
    conn.on(WebcastEvent.ROOM_USER, () => {
      this.lastWsAt = Date.now();
    });

    let roomIdHint: string | undefined;
    try {
      // Resolve the room explicitly first. Passing roomId into connect() skips
      // an additional username-resolution pass and has proven more reliable
      // when TikTok's HTML/live-status route temporarily says "offline".
      try {
        const fetchRoomId = (
          conn as unknown as {
            fetchRoomId?: (uniqueId?: string) => Promise<string | number>;
          }
        ).fetchRoomId;
        if (typeof fetchRoomId === 'function') {
          const candidate = await fetchRoomId.call(conn, this.username);
          if (candidate != null && String(candidate).trim()) {
            roomIdHint = String(candidate);
            this.roomId = roomIdHint;
            console.log(
              `[TIKTOK] room resolved @${this.username} → ${roomIdHint}`
            );
          }
        }
      } catch (roomErr) {
        console.warn(
          `[TIKTOK] room resolve @${this.username}: ${errMsg(roomErr)}`
        );
      }

      const state = await conn.connect(roomIdHint);
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

      const websocketSignatureRejected =
        /illegal secret key|websocket.*handshake|error connecting to websocket/i.test(msg);

      if (
        !offline &&
        websocketSignatureRejected &&
        (roomIdHint || this.roomId) &&
        this.connection === conn
      ) {
        console.warn(
          `[TIKTOK] WebSocket rejected (${msg}). Enabling incremental HTTP fallback for @${this.username}.`
        );
        this.startPollingFallback(conn, roomIdHint || this.roomId!);
        return;
      }

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

  /**
   * Fallback for TikTok deployments that return a valid room + initial webcast
   * batch but reject the WebSocket handshake ("illegal secret key"). We keep
   * consuming the signed fetch endpoint incrementally with its cursor. This
   * uses the exact same decoder/event handlers, so CHAT / LIKE / GIFT still
   * enter the GameLoop even while the push socket is unavailable.
   */
  private startPollingFallback(
    conn: InstanceType<TikTokLib['TikTokLiveConnection']>,
    roomId: string
  ): void {
    this.stopPollingFallback();
    this.pollFallbackActive = true;
    this.pollFallbackBusy = false;
    this.pollCursor = '';
    this.pollFailures = 0;
    this.roomId = roomId;
    this.connectedFlag = true;
    this.liveFlag = true;
    this.reconnectAttempt = 0;
    this.lastConnectedAt = Date.now();
    this.lastError = 'WebSocket indisponível; fallback HTTP incremental ativo';
    this.setPhase('connected');
    console.log(
      `[TIKTOK] LIVE DETECTADA / FALLBACK HTTP ATIVO @${this.username} room=${roomId}`
    );
    this.emitter.emit('connected', {
      username: this.username!,
      roomId,
    });

    const poll = async () => {
      if (
        this.intentionalStop ||
        !this.pollFallbackActive ||
        this.connection !== conn
      ) return;

      if (this.pollFallbackBusy) {
        this.pollFallbackTimer = setTimeout(poll, POLL_FALLBACK_MS);
        return;
      }

      this.pollFallbackBusy = true;
      let nextDelay = POLL_FALLBACK_MS;

      try {
        const lib = await this.loadLib();
        const routeConfig = (
          lib as unknown as {
            RouteConfig?: {
              fetchSignedWebSocketFromProvider?: (args: {
                webClient: unknown;
                apiClient: unknown;
                roomId: string;
                cursor?: string;
                authenticateWs: false;
                useMobile: false;
              }) => Promise<{
                fetchResult: {
                  cursor?: string;
                  internalExt?: string;
                };
                fetchResultCookieHeader?: string;
                fetchResultRoomId?: string;
              }>;
            };
          }
        ).RouteConfig;

        const fetchIncremental = routeConfig?.fetchSignedWebSocketFromProvider;
        if (typeof fetchIncremental !== 'function') {
          throw new Error('RouteConfig.fetchSignedWebSocketFromProvider unavailable');
        }

        const result = await fetchIncremental({
          webClient: conn.webClient,
          apiClient: conn.apiClient,
          roomId: this.roomId || roomId,
          cursor: this.pollCursor || undefined,
          authenticateWs: false,
          useMobile: false,
        });

        if (result.fetchResultCookieHeader) {
          await conn.webClient.cookieJar.processSetCookieHeader(
            result.fetchResultCookieHeader
          );
        }

        if (result.fetchResultRoomId) {
          this.roomId = String(result.fetchResultRoomId);
          conn.webClient.roomId = this.roomId;
        }

        const processor = (
          conn as unknown as {
            processProtoMessageFetchResult?: (value: unknown) => Promise<void>;
          }
        ).processProtoMessageFetchResult;

        if (typeof processor !== 'function') {
          throw new Error('processProtoMessageFetchResult unavailable');
        }

        await processor.call(conn, result.fetchResult);

        if (result.fetchResult.cursor) {
          this.pollCursor = result.fetchResult.cursor;
        }

        this.pollFailures = 0;
        this.lastWsAt = Date.now();
        this.lastError = null;
        if (!this.connectedFlag || !this.liveFlag || this.phase !== 'connected') {
          this.connectedFlag = true;
          this.liveFlag = true;
          this.setPhase('connected');
        }
      } catch (err) {
        const msg = errMsg(err);
        this.pollFailures += 1;
        this.lastError = msg;

        if (/429|too many|rate.?limit/i.test(msg)) {
          nextDelay = 8_000;
        } else if (/offline|not.*live|stream.*ended|room.*ended/i.test(msg)) {
          console.log(
            `[TIKTOK] fallback reports LIVE ended @${this.username}: ${msg}`
          );
          this.stopPollingFallback();
          this.connectedFlag = false;
          this.liveFlag = false;
          this.setPhase('waiting_live', msg);
          this.scheduleReconnect('fallback_live_ended');
          return;
        } else {
          nextDelay = Math.min(10_000, POLL_FALLBACK_MS * Math.max(1, this.pollFailures));
          console.warn(
            `[TIKTOK] fallback poll #${this.pollFailures}: ${msg}; retry ${nextDelay}ms`
          );
        }
      } finally {
        this.pollFallbackBusy = false;
      }

      if (this.pollFallbackActive && !this.intentionalStop) {
        this.pollFallbackTimer = setTimeout(poll, nextDelay);
      }
    };

    this.pollFallbackTimer = setTimeout(poll, 250);
  }

  private stopPollingFallback(): void {
    if (this.pollFallbackTimer) clearTimeout(this.pollFallbackTimer);
    this.pollFallbackTimer = null;
    this.pollFallbackActive = false;
    this.pollFallbackBusy = false;
    this.pollCursor = '';
    this.pollFailures = 0;
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
    const data = asRecord(raw) || {};
    const { user, comment } = parseTikTokChatPayload(raw, this.username);
    const msgId = rawMessageId(data);
    const created = rawCreatedAt(data);
    const fp =
      msgId ||
      `chat:${user.userId}:${created || Math.floor(Date.now() / 5000)}:${comment}`;

    if (!this.dedupe.check('chat:' + fp)) return;

    this.push(
      { type: 'comment', user, comment, timestamp: Date.now() },
      '[COMMENT]',
      `@${user.username} id=${user.userId}: ${comment.slice(0, 80)}`
    );
  }

  private handleGift(raw: unknown): void {
    const data = asRecord(raw) || {};
    const nestedData = asRecord(data.data);
    const giftObj = (asRecord(data.gift) || asRecord(nestedData?.gift)) as
      | Record<string, unknown>
      | undefined;
    const details = (asRecord(data.giftDetails) ||
      asRecord(nestedData?.giftDetails)) as Record<string, unknown> | undefined;
    const extended = (asRecord(data.extendedGiftInfo) ||
      asRecord(nestedData?.extendedGiftInfo)) as Record<string, unknown> | undefined;

    const giftType = Number(
      data.giftType ??
        nestedData?.giftType ??
        details?.giftType ??
        giftObj?.gift_type ??
        giftObj?.giftType ??
        0
    );
    const repeatEnd = Boolean(
      data.repeatEnd ??
        data.repeat_end ??
        nestedData?.repeatEnd ??
        nestedData?.repeat_end ??
        giftObj?.repeat_end ??
        giftObj?.repeatEnd
    );
    if (giftType === 1 && !repeatEnd) return;

    const nestedUser =
      asRecord(data.user) ||
      asRecord(nestedData?.user) ||
      asRecord(data.userInfo) ||
      asRecord(nestedData?.userInfo);
    const user = toUser(nestedUser || nestedData || data);
    const rawName = String(
      data.giftName ||
        nestedData?.giftName ||
        extended?.name ||
        details?.giftName ||
        giftObj?.name ||
        ''
    );
    const diamond =
      Number(
        data.diamondCount ??
          nestedData?.diamondCount ??
          extended?.diamond_count ??
          extended?.diamondCount ??
          details?.diamondCount ??
          giftObj?.diamond_count ??
          giftObj?.diamondCount ??
          0
      ) || 0;
    const mapped = mapTikTokGiftToArenaId(
      (data.giftId ??
        nestedData?.giftId ??
        giftObj?.gift_id ??
        giftObj?.giftId) as string | number | undefined,
      rawName,
      diamond
    );
    const repeatCount = Math.max(
      1,
      Number(
        data.repeatCount ??
          data.repeat_count ??
          nestedData?.repeatCount ??
          nestedData?.repeat_count ??
          giftObj?.repeat_count ??
          giftObj?.repeatCount ??
          1
      )
    );
    const common = (asRecord(data.common) ||
      asRecord(nestedData?.common)) as { msgId?: string } | undefined;
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

    const likeMsgId = rawMessageId(data);
    const likeFp =
      likeMsgId ||
      (totalLikeCount != null
        ? `like:${user.userId}:total:${totalLikeCount}`
        : `like:${user.userId}:${rawCreatedAt(data) || Math.floor(now / 2000)}:${creditedLikeCount}`);
    if (!this.dedupe.check('like:' + likeFp)) return;

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
    const data = asRecord(raw) || {};
    const nestedData = asRecord(data.data);
    const user = toUser(
      asRecord(data.user) || asRecord(nestedData?.user) || nestedData || data
    );
    const fp = String(
      data.msgId ||
        asRecord(data.common)?.msgId ||
        nestedData?.msgId ||
        asRecord(nestedData?.common)?.msgId ||
        `share:${user.userId}:${Math.floor(Date.now() / 3000)}`
    );
    if (!this.dedupe.check(fp)) return;
    this.push({ type: 'share', user, timestamp: Date.now() }, '[SHARE]', `@${user.username}`);
  }

  private handleFollow(raw: unknown): void {
    const data = asRecord(raw) || {};
    const nestedData = asRecord(data.data);
    const user = toUser(
      asRecord(data.user) || asRecord(nestedData?.user) || nestedData || data
    );
    this.push({ type: 'follow', user, timestamp: Date.now() }, '[FOLLOW]', `@${user.username}`);
  }

  private handleMember(raw: unknown): void {
    const data = asRecord(raw) || {};
    const nestedData = asRecord(data.data);
    const user = toUser(
      asRecord(data.user) || asRecord(nestedData?.user) || nestedData || data
    );
    this.push({ type: 'join', user, timestamp: Date.now() }, '[JOIN]', `@${user.username}`);
  }
}
