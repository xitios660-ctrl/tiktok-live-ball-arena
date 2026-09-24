import {
  DEFAULT_ROUND_DURATION_SEC,
  PHYSICS_TICK_HZ,
  DEFAULT_BALL_HP,
  type RoundState,
  type TikTokMode,
  type ArenaLiveEvent,
  type GameSnapshot,
  type PlayerStats,
  type CombatEvent,
  type HitEvent,
  type KillEvent,
} from '@arena/shared';
import { randomUUID } from 'crypto';
import { PhysicsWorld, type DamageApplication } from './PhysicsWorld';

export type RoundListener = (state: RoundState) => void;
export type LiveListener = (event: ArenaLiveEvent) => void;
export type SnapshotListener = (snap: GameSnapshot) => void;
export type CombatListener = (event: CombatEvent) => void;

interface PlayerRecord {
  userId: string;
  username: string;
  nickname?: string;
  kills: number;
  deaths: number;
  alive: boolean;
  /** Hook for Etapa 8: set when dead; comment can clear + respawn later */
  deadAt: number | null;
}

/**
 * Authoritative game loop: physics + HP/damage + death (Etapa 5/7 lite).
 * Respawn-by-comment = Etapa 8 (hooks only).
 */
export class GameLoop {
  private state: RoundState;
  private roundTimer: ReturnType<typeof setInterval> | null = null;
  private physicsTimer: ReturnType<typeof setInterval> | null = null;
  private roundListeners = new Set<RoundListener>();
  private liveListeners = new Set<LiveListener>();
  private snapshotListeners = new Set<SnapshotListener>();
  private combatListeners = new Set<CombatListener>();
  private recentEvents: ArenaLiveEvent[] = [];
  private recentCombat: CombatEvent[] = [];
  private readonly maxRecent = 50;
  private readonly physics = new PhysicsWorld();
  private players = new Map<string, PlayerRecord>();
  private tick = 0;
  private readonly dt = 1 / PHYSICS_TICK_HZ;
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
      stats: this.getStats(),
    };
  }

  getStats(): PlayerStats[] {
    const list: PlayerStats[] = [];
    for (const p of this.players.values()) {
      const ball = this.physics.getBall(p.userId);
      list.push({
        userId: p.userId,
        username: p.username,
        nickname: p.nickname,
        kills: p.kills,
        deaths: p.deaths,
        alive: p.alive,
        hp: ball?.hp ?? (p.alive ? DEFAULT_BALL_HP : 0),
        maxHp: ball?.maxHp ?? DEFAULT_BALL_HP,
      });
    }
    return list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  getRecentEvents(): ArenaLiveEvent[] {
    return [...this.recentEvents];
  }

  getRecentCombat(): CombatEvent[] {
    return [...this.recentCombat];
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

  onCombat(listener: CombatListener): () => void {
    this.combatListeners.add(listener);
    return () => this.combatListeners.delete(listener);
  }

  startRound(): RoundState {
    this.stopRoundTimer();
    this.physics.clear();
    this.players.clear();
    this.recentCombat = [];
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
    this.players.clear();
    this.recentCombat = [];
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

    if (
      (event.type === 'comment' || event.type === 'join') &&
      event.user.userId !== 'system'
    ) {
      this.spawnBallForUser(event);
    }
  }

  /** Admin: damage a living ball. Optional attackerId for kill credit. */
  adminDamage(victimId: string, damage: number, attackerId?: string): CombatEvent[] {
    const app = this.physics.applyDirectDamage(victimId, damage, attackerId);
    if (!app) return [];
    return this.processDamages([app]);
  }

  /** Admin: instantly kill a ball. */
  adminKill(victimId: string, attackerId?: string): CombatEvent[] {
    const ball = this.physics.getBall(victimId);
    if (!ball) return [];
    return this.adminDamage(victimId, ball.hp + 1, attackerId);
  }

  private spawnBallForUser(event: ArenaLiveEvent): void {
    if (event.type !== 'comment' && event.type !== 'join') return;
    const user = event.user;

    // Etapa 8 hook: dead players stay in stats; comment will respawn later — skip for now
    const existing = this.players.get(user.userId);
    if (existing && !existing.alive) {
      console.log(`[Game] ${user.username} is dead — respawn deferred to Etapa 8`);
      return;
    }

    if (this.autoStartOnSpawn && this.state.phase === 'waiting') {
      console.log('[Game] Auto-starting round on first spawn (DEMO)');
      this.startRoundWithoutClear();
    }

    if (this.state.phase === 'ended') return;

    this.physics.spawnOrNudge(user);
    this.ensurePlayerRecord(user.userId, user.username, user.nickname, true);
    this.state = { ...this.state, playerCount: this.physics.count };
    this.ensurePhysicsRunning();
    this.emitRound();
  }

  private ensurePlayerRecord(
    userId: string,
    username: string,
    nickname: string | undefined,
    alive: boolean
  ): PlayerRecord {
    let rec = this.players.get(userId);
    if (!rec) {
      rec = {
        userId,
        username,
        nickname,
        kills: 0,
        deaths: 0,
        alive,
        deadAt: alive ? null : Date.now(),
      };
      this.players.set(userId, rec);
    } else {
      rec.username = username;
      if (nickname) rec.nickname = nickname;
      if (alive) {
        rec.alive = true;
        rec.deadAt = null;
      }
    }
    return rec;
  }

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
    const { damages } = this.physics.step(this.dt);
    if (damages.length) this.processDamages(damages);
    this.tick += 1;
    this.emitSnapshot();
  }

  private processDamages(damages: DamageApplication[]): CombatEvent[] {
    const emitted: CombatEvent[] = [];
    const killedIds = new Set<string>();

    for (const d of damages) {
      if (d.damage <= 0) continue;

      const hit: HitEvent = {
        type: 'hit',
        attackerId: d.attackerId,
        attackerName: d.attackerName,
        victimId: d.victimId,
        victimName: d.victimName,
        damage: d.damage,
        victimHp: d.victimHpAfter,
        x: d.x,
        y: d.y,
        timestamp: Date.now(),
      };
      emitted.push(hit);
      this.pushCombat(hit);

      if (d.killed && !killedIds.has(d.victimId)) {
        killedIds.add(d.victimId);
        const killEv = this.handleDeath(d);
        if (killEv) {
          emitted.push(killEv);
          this.pushCombat(killEv);
        }
      }
    }

    if (killedIds.size) {
      this.state = { ...this.state, playerCount: this.physics.count };
      this.emitRound();
    }
    return emitted;
  }

  private handleDeath(d: DamageApplication): KillEvent | null {
    const body = this.physics.getBall(d.victimId);
    const x = body?.x ?? d.x;
    const y = body?.y ?? d.y;
    const lastHitterId = body?.lastHitterId ?? d.attackerId;
    const lastHitterName = body?.lastHitterName ?? d.attackerName;

    this.physics.removeBall(d.victimId);

    const victim = this.ensurePlayerRecord(d.victimId, d.victimName, undefined, false);
    victim.alive = false;
    victim.deaths += 1;
    victim.deadAt = Date.now();

    let attackerId: string | null = lastHitterId;
    let attackerName: string | null = lastHitterName;
    if (attackerId && attackerId !== d.victimId && attackerId !== 'admin') {
      const atk = this.players.get(attackerId);
      if (atk) {
        atk.kills += 1;
        attackerName = atk.nickname || atk.username;
      } else {
        this.ensurePlayerRecord(attackerId, attackerName || '???', undefined, true).kills += 1;
      }
    } else if (attackerId === 'admin') {
      attackerName = 'admin';
    } else {
      attackerId = null;
      attackerName = null;
    }

    const message = attackerName
      ? `@${attackerName} eliminou @${d.victimName}`
      : `@${d.victimName} foi eliminado`;

    console.log(`[Kill] ${message}`);

    return {
      type: 'kill',
      attackerId,
      attackerName,
      victimId: d.victimId,
      victimName: d.victimName,
      message,
      x,
      y,
      timestamp: Date.now(),
    };
  }

  private pushCombat(ev: CombatEvent): void {
    this.recentCombat.push(ev);
    if (this.recentCombat.length > this.maxRecent) this.recentCombat.shift();
    for (const l of this.combatListeners) l(ev);
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
