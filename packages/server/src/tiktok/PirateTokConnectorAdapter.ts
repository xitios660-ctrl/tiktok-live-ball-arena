import { EventEmitter } from 'node:events';
import type { ArenaLiveEvent, ArenaUser } from '@arena/shared';
import type {
  ConnectorEventMap,
  ConnectorStatus,
  ITikTokConnector,
  TikTokConnectionPhase,
} from './ITikTokConnector';
import { mapTikTokGiftToArenaId } from './mapTikTokGift';

type Obj = Record<string, unknown>;

type PirateModule = {
  TikTokLiveClient: new (username: string) => PirateClient;
  EventType: Record<string, string>;
};

type PirateClient = EventEmitter & {
  language: (value: string) => PirateClient;
  region: (value: string) => PirateClient;
  timeout: (value: number) => PirateClient;
  maxRetries: (value: number) => PirateClient;
  staleTimeout: (value: number) => PirateClient;
  connect: () => Promise<string>;
  disconnect: () => void;
};

const dynamicImport = new Function(
  'm',
  'return import(m)'
) as (moduleName: string) => Promise<unknown>;

const RETRY_OFFLINE_MS = 4_000;
const MAX_RECENT_IDS = 8_000;

function asObj(value: unknown): Obj | undefined {
  return value && typeof value === 'object' ? (value as Obj) : undefined;
}

function normalizeUsername(input: string): string {
  const raw = String(input || '').trim();
  const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i)?.[1];
  return decodeURIComponent(fromUrl || raw)
    .replace(/^@/, '')
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .trim();
}

function scalarId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  const obj = asObj(value);
  if (!obj) return '';

  if (typeof obj.toString === 'function') {
    const text = String(obj.toString());
    if (text && text !== '[object Object]') return text;
  }

  if (typeof obj.low === 'number' && typeof obj.high === 'number') {
    const low = BigInt(obj.low >>> 0);
    const high = BigInt(obj.high >>> 0);
    return ((high << 32n) | low).toString();
  }
  return '';
}

function avatarFromUser(user: Obj): string | undefined {
  for (const key of ['avatarLarge', 'avatarMedium', 'avatarThumb']) {
    const img = asObj(user[key]);
    const list = Array.isArray(img?.urlList) ? img!.urlList : [];
    const first = list.find((x) => typeof x === 'string' && x.length > 0);
    if (typeof first === 'string') return first;
  }
  return undefined;
}

export function mapPirateUser(raw: unknown): ArenaUser {
  const user = asObj(raw) || {};
  const id =
    scalarId(user.id) ||
    scalarId(user.userId) ||
    String(user.uniqueId || user.nickname || 'viewer');
  const username = String(user.uniqueId || user.username || user.nickname || id);
  const nickname = String(user.nickname || username);
  return {
    userId: id,
    username,
    nickname,
    avatarUrl: avatarFromUser(user),
  };
}

function commonMessageId(data: Obj): string {
  const common = asObj(data.common);
  return (
    scalarId(common?.msgId) ||
    scalarId(common?.messageId) ||
    scalarId(data.msgId) ||
    scalarId(data.messageId)
  );
}

export function mapPirateChatEvent(raw: unknown): ArenaLiveEvent | null {
  const data = asObj(raw);
  if (!data) return null;
  const user = mapPirateUser(data.user);
  const comment = String(data.content || data.comment || '').trim();
  if (!comment) return null;
  return {
    type: 'comment',
    user,
    comment,
    timestamp: Date.now(),
  };
}

export function mapPirateLikeEvent(raw: unknown): ArenaLiveEvent | null {
  const data = asObj(raw);
  if (!data) return null;
  const user = mapPirateUser(data.user);
  const count = Math.max(1, Number(data.count ?? data.likeCount ?? 1) || 1);
  const total = Number(data.total ?? data.totalLikeCount ?? 0) || undefined;
  return {
    type: 'like',
    user,
    likeCount: count,
    totalLikeCount: total,
    timestamp: Date.now(),
  };
}

export function mapPirateGiftEvent(raw: unknown): ArenaLiveEvent | null {
  const data = asObj(raw);
  if (!data) return null;

  const gift = asObj(data.gift) || {};
  const giftType = Number(gift.type ?? data.giftType ?? 0) || 0;
  const repeatEnd = Number(data.repeatEnd ?? data.repeat_end ?? 0) || 0;

  // Combo gifts send intermediate running totals. Apply once at final packet.
  if (giftType === 1 && repeatEnd !== 1) return null;

  const giftName = String(gift.name ?? data.giftName ?? '').trim();
  const rawGiftId =
    scalarId(data.giftId) ||
    scalarId(gift.id) ||
    scalarId(gift.giftId) ||
    giftName;

  const diamondCount =
    Number(gift.diamondCount ?? data.diamondCount ?? 0) || 0;
  const mapped = mapTikTokGiftToArenaId(rawGiftId, giftName, diamondCount);

  return {
    type: 'gift',
    user: mapPirateUser(data.user),
    giftId: mapped.arenaGiftId,
    giftName: giftName || mapped.giftName || String(rawGiftId),
    repeatCount: Math.max(1, Number(data.repeatCount ?? 1) || 1),
    repeatEnd: true,
    coinValue: diamondCount,
    timestamp: Date.now(),
  };
}

class IdDedupe {
  private ids = new Map<string, number>();

  seen(key: string): boolean {
    if (!key) return false;
    const now = Date.now();
    if (this.ids.has(key)) return true;
    this.ids.set(key, now);
    if (this.ids.size > MAX_RECENT_IDS) {
      const cutoff = now - 120_000;
      for (const [id, at] of this.ids) {
        if (at < cutoff || this.ids.size > MAX_RECENT_IDS) this.ids.delete(id);
        else break;
      }
    }
    return false;
  }

  clear(): void {
    this.ids.clear();
  }
}

export class PirateTokConnectorAdapter implements ITikTokConnector {
  readonly name = 'piratetok-live-js';

  private emitter = new EventEmitter();
  private client: PirateClient | null = null;
  private username: string | null = null;
  private roomId: string | null = null;
  private phase: TikTokConnectionPhase = 'idle';
  private connected = false;
  private live = false;
  private reconnectAttempt = 0;
  private lastError: string | null = null;
  private lastEventAt: number | null = null;
  private lastConnectedAt: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private intentionalStop = false;
  private dedupe = new IdDedupe();

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

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): ConnectorStatus {
    return {
      phase: this.phase,
      label:
        this.phase === 'connected'
          ? 'LIVE DETECTADA / TIKTOK CONECTADO'
          : this.phase === 'waiting_live'
            ? 'AGUARDANDO LIVE'
            : this.phase === 'reconnecting'
              ? `RECONECTANDO #${this.reconnectAttempt}`
              : this.phase === 'connecting'
                ? 'CONECTANDO TIKTOK'
                : this.phase === 'error'
                  ? 'ERRO TIKTOK'
                  : 'DESCONECTADO',
      mode: 'production',
      name: this.name,
      username: this.username,
      roomId: this.roomId,
      connected: this.connected,
      live: this.live,
      reconnectAttempt: this.reconnectAttempt,
      lastError: this.lastError,
      lastEventAt: this.lastEventAt,
      lastConnectedAt: this.lastConnectedAt,
      note:
        'Realtime direto do TikTok via PirateTok, sem servidor externo de assinatura. ' +
        'Comentários, likes e presentes usam o mesmo WebSocket com auto-reconexão.',
    };
  }

  async connect(username: string): Promise<void> {
    const clean = normalizeUsername(username);
    if (!clean) throw new Error('TikTok username is required');

    this.intentionalStop = false;
    this.generation += 1;
    this.clearRetry();

    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
        // ignored
      }
      this.client.removeAllListeners();
      this.client = null;
    }

    const changed = this.username !== clean;
    this.username = clean;
    if (changed) {
      this.roomId = null;
      this.reconnectAttempt = 0;
      this.dedupe.clear();
    }

    this.connected = false;
    this.live = false;
    this.setPhase('connecting');
    void this.startAttempt(this.generation);
  }

  async disconnect(): Promise<void> {
    this.intentionalStop = true;
    this.generation += 1;
    this.clearRetry();
    const client = this.client;
    this.client = null;
    if (client) {
      try {
        client.disconnect();
      } catch {
        // ignored
      }
      client.removeAllListeners();
    }
    this.connected = false;
    this.live = false;
    this.roomId = null;
    this.setPhase('disconnected');
  }

  private async load(): Promise<PirateModule> {
    return (await dynamicImport('piratetok-live-js')) as PirateModule;
  }

  private async startAttempt(gen: number): Promise<void> {
    if (this.intentionalStop || gen !== this.generation || !this.username) return;

    try {
      const lib = await this.load();
      if (this.intentionalStop || gen !== this.generation) return;

      const client = new lib.TikTokLiveClient(this.username)
        .language('pt')
        .region('BR')
        .timeout(12_000)
        .maxRetries(20)
        .staleTimeout(45_000);

      this.client = client;
      const E = lib.EventType;

      client.on(E.connected, (raw: unknown) => {
        if (gen !== this.generation || this.client !== client) return;
        const info = asObj(raw) || {};
        this.roomId = scalarId(info.roomId) || this.roomId;
        this.connected = true;
        this.live = true;
        this.reconnectAttempt = 0;
        this.lastError = null;
        this.lastConnectedAt = Date.now();
        this.setPhase('connected');
        console.log(
          `[TIKTOK][PIRATE] CONNECTED @${this.username} room=${this.roomId || '-'}`
        );
        this.emitter.emit('connected', {
          username: this.username!,
          roomId: this.roomId || undefined,
        });
      });

      client.on(E.chat, (data: unknown) => {
        const obj = asObj(data) || {};
        const key = commonMessageId(obj);
        if (key && this.dedupe.seen('chat:' + key)) return;
        const event = mapPirateChatEvent(data);
        if (!event || event.type !== 'comment') return;
        this.push(
          event,
          '[COMMENT]',
          `@${event.user.username} id=${event.user.userId}: ${event.comment.slice(0, 100)}`
        );
      });

      client.on(E.like, (data: unknown) => {
        const obj = asObj(data) || {};
        const key = commonMessageId(obj);
        if (key && this.dedupe.seen('like:' + key)) return;
        const event = mapPirateLikeEvent(data);
        if (!event || event.type !== 'like') return;
        this.push(
          event,
          '[LIKE]',
          `@${event.user.username} +${event.likeCount} total=${event.totalLikeCount ?? '?'}`
        );
      });

      client.on(E.gift, (data: unknown) => {
        const obj = asObj(data) || {};
        const mapped = mapPirateGiftEvent(data);
        if (!mapped || mapped.type !== 'gift') return;

        const key =
          commonMessageId(obj) ||
          [
            mapped.user.userId,
            mapped.giftId,
            mapped.repeatCount,
            scalarId(obj.groupId),
            scalarId(obj.logId),
          ].join(':');
        if (key && this.dedupe.seen('gift:' + key)) return;

        this.push(
          mapped,
          '[GIFT]',
          `@${mapped.user.username} ${mapped.giftName} x${mapped.repeatCount} -> ${mapped.giftId}`
        );
      });

      client.on(E.join, (data: unknown) => {
        const obj = asObj(data) || {};
        const user = mapPirateUser(obj.user ?? data);
        this.push(
          { type: 'join', user, timestamp: Date.now() },
          '[JOIN]',
          `@${user.username}`
        );
      });

      client.on(E.follow, (data: unknown) => {
        const obj = asObj(data) || {};
        const user = mapPirateUser(obj.user ?? data);
        this.push(
          { type: 'follow', user, timestamp: Date.now() },
          '[FOLLOW]',
          `@${user.username}`
        );
      });

      client.on(E.share, (data: unknown) => {
        const obj = asObj(data) || {};
        const user = mapPirateUser(obj.user ?? data);
        this.push(
          { type: 'share', user, timestamp: Date.now() },
          '[SHARE]',
          `@${user.username}`
        );
      });

      client.on(E.reconnecting, (raw: unknown) => {
        if (gen !== this.generation || this.client !== client) return;
        const info = asObj(raw) || {};
        this.reconnectAttempt = Number(info.attempt ?? this.reconnectAttempt + 1) || 1;
        const delayMs = Number(info.delayMs ?? 2_000) || 2_000;
        this.connected = false;
        this.live = true;
        this.setPhase('reconnecting');
        console.warn(
          `[TIKTOK][PIRATE] reconnect #${this.reconnectAttempt} in ${delayMs}ms`
        );
        this.emitter.emit('reconnecting', this.reconnectAttempt, delayMs);
      });

      client.on(E.liveEnded, () => {
        if (gen !== this.generation || this.client !== client) return;
        console.log(`[TIKTOK][PIRATE] LIVE ended @${this.username}`);
        this.connected = false;
        this.live = false;
        this.roomId = null;
        this.setPhase('waiting_live', 'TikTok informou que a LIVE terminou');
      });

      client.on(E.disconnected, () => {
        if (
          this.intentionalStop ||
          gen !== this.generation ||
          this.client !== client
        ) return;
        this.connected = false;
        this.live = false;
        this.client = null;
        this.setPhase('waiting_live', 'Conexão encerrada; aguardando LIVE');
        this.scheduleRetry(gen, 2_000);
      });

      client.on('error', (err: unknown) => {
        if (gen !== this.generation || this.client !== client) return;
        const msg = err instanceof Error ? err.message : String(err);
        this.lastError = msg;
        console.warn(`[TIKTOK][PIRATE] ${msg}`);
        this.emitStatus();
      });

      // This promise runs for the whole lifetime of the WSS. Do not await it:
      // events start flowing as soon as the client emits "connected".
      void client.connect().catch((err: unknown) => {
        if (
          this.intentionalStop ||
          gen !== this.generation ||
          this.client !== client
        ) return;

        const msg = err instanceof Error ? err.message : String(err);
        this.lastError = msg;
        this.connected = false;
        this.live = false;
        this.roomId = null;

        const offline =
          /not currently live|HostNotOnline|offline|not.*live/i.test(msg);
        if (offline) {
          this.setPhase('waiting_live', msg);
          console.log(
            `[TIKTOK][PIRATE] @${this.username} não está LIVE agora; retry ${RETRY_OFFLINE_MS}ms`
          );
        } else {
          this.setPhase('error', msg);
          console.warn(`[TIKTOK][PIRATE] connect error: ${msg}`);
        }

        if (this.client === client) {
          client.removeAllListeners();
          this.client = null;
        }
        this.scheduleRetry(gen, offline ? RETRY_OFFLINE_MS : 3_000);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.connected = false;
      this.live = false;
      this.setPhase('error', msg);
      console.error(`[TIKTOK][PIRATE] load/connect failure: ${msg}`);
      this.scheduleRetry(gen, 5_000);
    }
  }

  private push(event: ArenaLiveEvent, tag: string, message: string): void {
    this.lastEventAt = Date.now();
    this.connected = true;
    this.live = true;
    this.lastError = null;
    if (this.phase !== 'connected') this.setPhase('connected');
    console.log(`${tag} ${message}`);
    this.emitter.emit('event', event);
    this.emitStatus();
  }

  private scheduleRetry(gen: number, delayMs: number): void {
    if (this.intentionalStop || gen !== this.generation) return;
    this.clearRetry();
    this.reconnectAttempt += 1;
    if (this.phase !== 'waiting_live') this.setPhase('reconnecting');
    this.emitter.emit('reconnecting', this.reconnectAttempt, delayMs);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.startAttempt(gen);
    }, delayMs);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setPhase(phase: TikTokConnectionPhase, error?: string): void {
    this.phase = phase;
    if (error !== undefined) this.lastError = error;
    this.emitStatus();
  }

  private emitStatus(): void {
    this.emitter.emit('status', this.getStatus());
  }
}
