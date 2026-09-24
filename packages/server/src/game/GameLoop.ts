import {
  DEFAULT_ROUND_DURATION_SEC,
  type RoundState,
  type TikTokMode,
  type ArenaLiveEvent,
} from '@arena/shared';
import { randomUUID } from 'crypto';

export type RoundListener = (state: RoundState) => void;
export type LiveListener = (event: ArenaLiveEvent) => void;

/**
 * Authoritative game loop stub (Etapa 1).
 * Tracks round timer + forwards live events. Physics comes in Etapa 2+.
 */
export class GameLoop {
  private state: RoundState;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private roundListeners = new Set<RoundListener>();
  private liveListeners = new Set<LiveListener>();
  private recentEvents: ArenaLiveEvent[] = [];
  private readonly maxRecent = 50;

  constructor(mode: TikTokMode, durationSec = DEFAULT_ROUND_DURATION_SEC) {
    this.state = {
      phase: 'waiting',
      roundId: randomUUID(),
      durationSec,
      remainingSec: durationSec,
      startedAt: null,
      mode,
    };
  }

  getState(): RoundState {
    return { ...this.state };
  }

  getRecentEvents(): ArenaLiveEvent[] {
    return [...this.recentEvents];
  }

  onRound(listener: RoundListener): () => void {
    this.roundListeners.add(listener);
    return () => this.roundListeners.delete(listener);
  }

  onLive(listener: LiveListener): () => void {
    this.liveListeners.add(listener);
    return () => this.liveListeners.delete(listener);
  }

  startRound(): RoundState {
    this.stopTick();
    this.state = {
      ...this.state,
      phase: 'running',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: Date.now(),
    };
    this.emitRound();
    this.tickTimer = setInterval(() => this.tick(), 1000);
    console.log(`[Game] Round ${this.state.roundId} started (${this.state.durationSec}s)`);
    return this.getState();
  }

  endRound(): RoundState {
    this.stopTick();
    this.state = { ...this.state, phase: 'ended', remainingSec: 0 };
    this.emitRound();
    return this.getState();
  }

  resetToWaiting(): RoundState {
    this.stopTick();
    this.state = {
      ...this.state,
      phase: 'waiting',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: null,
    };
    this.emitRound();
    return this.getState();
  }

  handleLiveEvent(event: ArenaLiveEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecent) this.recentEvents.shift();
    for (const l of this.liveListeners) l(event);
    // Physics / ability mapping: Etapa 2+
  }

  private tick(): void {
    if (this.state.phase !== 'running') return;
    const next = Math.max(0, this.state.remainingSec - 1);
    this.state = { ...this.state, remainingSec: next };
    this.emitRound();
    if (next <= 0) this.endRound();
  }

  private stopTick(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private emitRound(): void {
    const snap = this.getState();
    for (const l of this.roundListeners) l(snap);
  }
}
