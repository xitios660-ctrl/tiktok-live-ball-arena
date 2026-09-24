import { EventEmitter } from 'events';
import type { ArenaLiveEvent, ArenaUser } from '@arena/shared';
import type { ITikTokConnector, ConnectorEventMap, ConnectorStatus } from '../tiktok/ITikTokConnector';

const DEMO_USERS: ArenaUser[] = [
  { userId: 'demo-1', username: 'fan_alpha', nickname: 'Fan Alpha' },
  { userId: 'demo-2', username: 'bola_lover', nickname: 'Bola Lover' },
  { userId: 'demo-3', username: 'capivara_king', nickname: 'Capivara King' },
  { userId: 'demo-4', username: 'rosa_queen', nickname: 'Rosa Queen' },
];

/** TikTok gifts that apply directly to the sender ball */
export const DEMO_GIFT_PRESETS = [
  { giftId: 'rosa', giftName: 'Rosa', coinValue: 1 },
  { giftId: 'mini_dino', giftName: 'Mini Dino', coinValue: 10 },
  { giftId: 'rosquinha', giftName: 'Rosquinha', coinValue: 30 },
  { giftId: 'capivara', giftName: 'Capivara', coinValue: 100 },
  { giftId: 'galaxia', giftName: 'Galaxia', coinValue: 1000 },
] as const;

/** Floor pickups (admin spawn only — not auto gift-injected) */
export const DEMO_PICKUP_PRESETS = [
  { giftId: 'raio', giftName: 'Raio', ability: 'lightning_zap', emoji: '⚡' },
  { giftId: 'ima', giftName: 'Ímã', ability: 'magnet_pulse', emoji: '🧲' },
  { giftId: 'gelo', giftName: 'Gelo', ability: 'freeze_aura', emoji: '❄️' },
  { giftId: 'foguete', giftName: 'Foguete', ability: 'dash_burst', emoji: '🚀' },
  { giftId: 'espelho', giftName: 'Espelho', ability: 'reflect_shield', emoji: '🪞' },
] as const;

export type DemoGiftId = (typeof DEMO_GIFT_PRESETS)[number]['giftId'];
export type DemoPickupGiftId = (typeof DEMO_PICKUP_PRESETS)[number]['giftId'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * DEMO-only event simulator. Events are FAKE — not from TikTok.
 * Supports auto-loop + admin-triggered inject (gifts, comments, bots, etc.).
 */
export class DemoEventSimulator implements ITikTokConnector {
  readonly name = 'demo-event-simulator';
  private emitter = new EventEmitter();
  private connected = false;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private username = 'demo_host';
  private autoEnabled = true;
  private botSeq = 0;

  async connect(username: string): Promise<void> {
    this.username = username || 'demo_host';
    this.connected = true;
    this.emitter.emit('connected', { username: this.username, roomId: 'demo-room' });
    if (this.autoEnabled) this.startAutoLoop();
    console.log(`[DEMO] Simulator connected as @${this.username} — events are SIMULATED, not TikTok`);
  }

  async disconnect(): Promise<void> {
    this.stopAutoLoop();
    this.connected = false;
    this.emitter.emit('disconnected', 'manual');
    console.log('[DEMO] Simulator disconnected');
  }

  /** Soft reconnect for admin UI testing */
  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect(this.username);
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

  setAutoEnabled(enabled: boolean): void {
    this.autoEnabled = enabled;
    if (enabled && this.connected) this.startAutoLoop();
    else this.stopAutoLoop();
  }

  isAutoEnabled(): boolean {
    return this.autoEnabled;
  }


  getStatus(): ConnectorStatus {
    return {
      phase: this.connected ? 'connected' : 'disconnected',
      label: this.connected ? 'DEMO CONECTADO (simulado)' : 'DEMO DESCONECTADO',
      mode: 'demo',
      name: this.name,
      username: this.username,
      roomId: 'demo-room',
      connected: this.connected,
      live: this.connected,
      reconnectAttempt: 0,
      lastError: null,
      lastEventAt: null,
      lastConnectedAt: this.connected ? Date.now() : null,
      note: 'Events are SIMULATED — not real TikTok',
    };
  }



  /** Inject a normalized live event (admin / API). */
  inject(event: ArenaLiveEvent): void {
    if (!this.connected) {
      throw new Error('[DEMO] Simulator not connected — call connect/reconnect first');
    }
    this.emitter.emit('event', event);
  }

  injectComment(comment?: string, user?: Partial<ArenaUser>): ArenaLiveEvent {
    const u = this.resolveUser(user);
    const payload: ArenaLiveEvent = {
      type: 'comment',
      user: u,
      comment: comment || pick(['bora!', 'vamos!', 'top', '🔥', 'bola!', 'gg', 'capivara!']),
      timestamp: Date.now(),
    };
    this.inject(payload);
    return payload;
  }

  injectGift(giftId: DemoGiftId | string, opts?: { repeatCount?: number; user?: Partial<ArenaUser> }): ArenaLiveEvent {
    const preset =
      DEMO_GIFT_PRESETS.find((g) => g.giftId === giftId) ||
      DEMO_GIFT_PRESETS[0];
    const payload: ArenaLiveEvent = {
      type: 'gift',
      user: this.resolveUser(opts?.user),
      giftId: preset.giftId,
      giftName: preset.giftName,
      repeatCount: opts?.repeatCount ?? 1,
      repeatEnd: true,
      coinValue: preset.coinValue,
      timestamp: Date.now(),
    };
    this.inject(payload);
    return payload;
  }

  injectLike(likeCount = 5, user?: Partial<ArenaUser>): ArenaLiveEvent {
    const payload: ArenaLiveEvent = {
      type: 'like',
      user: this.resolveUser(user),
      likeCount,
      timestamp: Date.now(),
    };
    this.inject(payload);
    return payload;
  }

  injectShare(user?: Partial<ArenaUser>): ArenaLiveEvent {
    const payload: ArenaLiveEvent = { type: 'share', user: this.resolveUser(user), timestamp: Date.now() };
    this.inject(payload);
    return payload;
  }

  injectJoin(user?: Partial<ArenaUser>): ArenaLiveEvent {
    const payload: ArenaLiveEvent = { type: 'join', user: this.resolveUser(user), timestamp: Date.now() };
    this.inject(payload);
    return payload;
  }

  injectFollow(user?: Partial<ArenaUser>): ArenaLiveEvent {
    const payload: ArenaLiveEvent = { type: 'follow', user: this.resolveUser(user), timestamp: Date.now() };
    this.inject(payload);
    return payload;
  }

  /** Spawn N fake bots that each emit a join (+ optional random gift). */
  spawnBots(count: number, withGift = false): ArenaLiveEvent[] {
    const n = Math.max(1, Math.min(150, Math.floor(count)));
    const emitted: ArenaLiveEvent[] = [];
    for (let i = 0; i < n; i++) {
      this.botSeq += 1;
      const user: ArenaUser = {
        userId: `bot-${this.botSeq}`,
        username: `bot_${this.botSeq}`,
        nickname: `Bot ${this.botSeq}`,
      };
      emitted.push(this.injectJoin(user));
      if (withGift) {
        emitted.push(this.injectGift(pick(DEMO_GIFT_PRESETS).giftId, { user }));
      }
    }
    return emitted;
  }

  private resolveUser(partial?: Partial<ArenaUser>): ArenaUser {
    if (partial?.userId || partial?.username) {
      return {
        userId: partial.userId || `demo-custom-${Date.now()}`,
        username: partial.username || 'custom_user',
        nickname: partial.nickname || partial.username || 'Custom',
        avatarUrl: partial.avatarUrl,
      };
    }
    return pick(DEMO_USERS);
  }

  private startAutoLoop(): void {
    this.stopAutoLoop();
    this.autoTimer = setInterval(() => this.emitRandom(), 2500 + Math.random() * 1500);
  }

  private stopAutoLoop(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }

  private emitRandom(): void {
    if (!this.connected) return;
    const roll = Math.random();
    if (roll < 0.35) this.injectComment();
    else if (roll < 0.65) this.injectGift(pick(DEMO_GIFT_PRESETS).giftId);
    else if (roll < 0.8) this.injectLike();
    else if (roll < 0.9) this.injectJoin();
    else if (roll < 0.95) this.injectFollow();
    else this.injectShare();
  }
}
