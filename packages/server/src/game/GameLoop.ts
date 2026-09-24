import {
  DEFAULT_ROUND_DURATION_SEC,
  PHYSICS_TICK_HZ,
  type RoundState,
  type TikTokMode,
  type ArenaLiveEvent,
  type GameSnapshot,
} from '@arena/shared';
import { randomUUID } from 'crypto';
import { PhysicsWorld } from './PhysicsWorld';

export type RoundListener = (state: RoundState) => void;
export type LiveListener = (event: ArenaLiveEvent) => void;
export type SnapshotListener = (snap: GameSnapshot) => void;

/**
 * Authoritative game loop: round timer + physics world + snapshot broadcast.
 * Physics tick: PHYSICS_TICK_HZ (30 Hz).
 */
export class GameLoop {
  private state: RoundState;
  private roundTimer: ReturnType<typeof setInterval> | null = null;
  private physicsTimer: ReturnType<typeof setInterval> | null = null;
  private roundListeners = new Set<RoundListener>();
  private liveListeners = new Set<LiveListener>();
  private snapshotListeners = new Set<SnapshotListener>();
  private recentEvents: ArenaLiveEvent[] = [];
  private readonly maxRecent = 50;
  private readonly physics = new PhysicsWorld();
  private tick = 0;
  private readonly dt = 1 / PHYSICS_TICK_HZ;
  /** DEMO: auto-start round when first ball spawns while waiting */
  private autoStartOnSpawn = true;

  constructor(mode: TikTokMode, durationSec = DEFAULT_ROUND_DURATION_SEC) {
    this.state = {
      phase: 'waiting',
      roundId: randomUUID(),
      durationSec,
      remainingSec: durationSec,
      startedAt: null,
      mode,
      playerCount: 0,
    };
  }

  getState(): RoundState {
    return { ...this.state, playerCount: this.physics.count };
  }

  getSnapshot(): GameSnapshot {
    return {
      tick: this.tick,
      tickHz: PHYSICS_TICK_HZ,
      phase: this.state.phase,
      remainingSec: this.state.remainingSec,
      playerCount: this.physics.count,
      balls: this.physics.toPublicStates(),
    };
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

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  startRound(): RoundState {
    this.stopRoundTimer();
    this.physics.clear();
    this.tick = 0;
    this.state = {
      ...this.state,
      phase: 'running',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: Date.now(),
      playerCount: 0,
    };
    this.emitRound();
    this.roundTimer = setInterval(() => this.secondTick(), 1000);
    this.ensurePhysicsRunning();
    console.log(`[Game] Round ${this.state.roundId} started (${this.state.durationSec}s) @ ${PHYSICS_TICK_HZ}Hz`);
    return this.getState();
  }

  endRound(): RoundState {
    this.stopRoundTimer();
    this.state = { ...this.state, phase: 'ended', remainingSec: 0, playerCount: this.physics.count };
    this.emitRound();
    this.emitSnapshot();
    return this.getState();
  }

  resetToWaiting(): RoundState {
    this.stopRoundTimer();
    this.stopPhysics();
    this.physics.clear();
    this.tick = 0;
    this.state = {
      ...this.state,
      phase: 'waiting',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: null,
      playerCount: 0,
    };
    this.emitRound();
    this.emitSnapshot();
    return this.getState();
  }

  handleLiveEvent(event: ArenaLiveEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecent) this.recentEvents.shift();
    for (const l of this.liveListeners) l(event);

    // Spawn balls from comment or join (bots). Skip system user.
    if (
      (event.type === 'comment' || event.type === 'join') &&
      event.user.userId !== 'system'
    ) {
      this.spawnBallForUser(event);
    }
  }

  private spawnBallForUser(event: ArenaLiveEvent): void {
    if (event.type !== 'comment' && event.type !== 'join') return;

    // Auto-start round in DEMO when first player enters while waiting
    if (this.autoStartOnSpawn && this.state.phase === 'waiting') {
      console.log('[Game] Auto-starting round on first spawn (DEMO)');
      this.startRoundWithoutClear();
    }

    // If ended, don't spawn
    if (this.state.phase === 'ended') return;

    this.physics.spawnOrNudge(event.user);
    this.state = { ...this.state, playerCount: this.physics.count };
    this.ensurePhysicsRunning();
    this.emitRound();
  }

  /** Start round but keep existing balls (used by auto-start after first spawn already pending) */
  private startRoundWithoutClear(): void {
    this.stopRoundTimer();
    this.tick = 0;
    this.state = {
      ...this.state,
      phase: 'running',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: Date.now(),
    };
    this.emitRound();
    this.roundTimer = setInterval(() => this.secondTick(), 1000);
    this.ensurePhysicsRunning();
  }

  private ensurePhysicsRunning(): void {
    if (this.physicsTimer) return;
    this.physicsTimer = setInterval(() => this.physicsTick(), 1000 / PHYSICS_TICK_HZ);
  }

  private physicsTick(): void {
    if (this.state.phase !== 'running') return;
    this.physics.step(this.dt);
    this.tick += 1;
    this.emitSnapshot();
  }

  private secondTick(): void {
    if (this.state.phase !== 'running') return;
    const next = Math.max(0, this.state.remainingSec - 1);
    this.state = { ...this.state, remainingSec: next, playerCount: this.physics.count };
    this.emitRound();
    if (next <= 0) this.endRound();
  }

  private stopRoundTimer(): void {
    if (this.roundTimer) clearInterval(this.roundTimer);
    this.roundTimer = null;
  }

  private stopPhysics(): void {
    if (this.physicsTimer) clearInterval(this.physicsTimer);
    this.physicsTimer = null;
  }

  private emitRound(): void {
    const snap = this.getState();
    for (const l of this.roundListeners) l(snap);
  }

  private emitSnapshot(): void {
    const snap = this.getSnapshot();
    for (const l of this.snapshotListeners) l(snap);
  }
}
