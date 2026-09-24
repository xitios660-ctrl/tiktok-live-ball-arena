import {
  DEFAULT_ROUND_DURATION_SEC,
  PHYSICS_TICK_HZ,
  DEFAULT_BALL_HP,
  REVENGE_MARK_MS,
  type RoundState,
  type TikTokMode,
  type ArenaLiveEvent,
  type ArenaUser,
  type GameSnapshot,
  type PlayerStats,
  type CombatEvent,
  type HitEvent,
  type KillEvent,
  type AnnounceEvent,
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
  deadAt: number | null;
  /** Must comment AFTER this timestamp to respawn */
  lastKillerId: string | null;
  lastKillerName: string | null;
  revengeTargetId: string | null;
  revengeTargetName: string | null;
  damageDealt: number;
  damageTaken: number;
  collisions: number;
  highestSpeed: number;
  /** A killed B count within this round: key = victimId */
  killsAgainst: Map<string, number>;
}

/**
 * Authoritative game loop — physics, HP, death, respawn-by-comment, revenge.
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
    this.syncSpeedStats();
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
        damageDealt: p.damageDealt,
        damageTaken: p.damageTaken,
        collisions: p.collisions,
        highestSpeed: Math.max(p.highestSpeed, ball?.highestSpeed ?? 0),
        lastKillerId: p.lastKillerId,
        lastKillerName: p.lastKillerName,
        revengeTargetId: p.revengeTargetId,
        revengeTargetName: p.revengeTargetName,
      });
    }
    return list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  getDeadPlayers(): PlayerStats[] {
    return this.getStats().filter((s) => !s.alive);
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
    console.log(`[Game] Round ${this.state.roundId} started`);
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

    if (event.user.userId === 'system') return;

    if (event.type === 'comment') {
      this.handleComment(event.user);
    } else if (event.type === 'join') {
      this.handleJoin(event.user);
    }
  }

  adminDamage(victimId: string, damage: number, attackerId?: string): CombatEvent[] {
    const app = this.physics.applyDirectDamage(victimId, damage, attackerId);
    if (!app) return [];
    return this.processDamages([app]);
  }

  adminKill(victimId: string, attackerId?: string): CombatEvent[] {
    const ball = this.physics.getBall(victimId);
    if (!ball) return [];
    return this.adminDamage(victimId, ball.hp + 1, attackerId);
  }

  /** Admin helper: comment-as dead player to force respawn */
  adminRespawnComment(userId: string): CombatEvent[] {
    const rec = this.players.get(userId);
    if (!rec || rec.alive) return [];
    return this.respawnPlayer({
      userId: rec.userId,
      username: rec.username,
      nickname: rec.nickname,
    });
  }

  private handleJoin(user: ArenaUser): void {
    const existing = this.players.get(user.userId);
    // Dead players: join does NOT respawn — only a new comment does
    if (existing && !existing.alive) return;
    this.spawnNewOrNudge(user);
  }

  private handleComment(user: ArenaUser): void {
    const existing = this.players.get(user.userId);
    if (existing && !existing.alive) {
      // ONLY a NEW comment after death respawns
      if (existing.deadAt && Date.now() >= existing.deadAt) {
        this.respawnPlayer(user);
      }
      return;
    }
    this.spawnNewOrNudge(user);
  }

  private spawnNewOrNudge(user: ArenaUser): void {
    if (this.autoStartOnSpawn && this.state.phase === 'waiting') {
      console.log('[Game] Auto-starting round on first spawn (DEMO)');
      this.startRoundWithoutClear();
    }
    if (this.state.phase === 'ended') return;

    this.physics.spawnOrNudge(user);
    this.ensurePlayerRecord(user.userId, user.username, user.nickname);
    const rec = this.players.get(user.userId)!;
    rec.alive = true;
    rec.deadAt = null;
    this.state = { ...this.state, playerCount: this.physics.count };
    this.ensurePhysicsRunning();
    this.emitRound();
  }

  private respawnPlayer(user: ArenaUser): CombatEvent[] {
    if (this.state.phase === 'ended' || this.state.phase === 'waiting') {
      if (this.state.phase === 'waiting') this.startRoundWithoutClear();
      else return [];
    }

    const rec = this.ensurePlayerRecord(user.userId, user.username, user.nickname);
    // Keep kills, deaths, damage, collisions, highestSpeed, killsAgainst
    rec.username = user.username;
    if (user.nickname) rec.nickname = user.nickname;
    rec.alive = true;
    rec.deadAt = null;

    // Set revenge target from last killer (if still in round / was real)
    const killerId = rec.lastKillerId;
    const killerName = rec.lastKillerName;
    const hasRevenge =
      !!killerId && killerId !== 'admin' && killerId !== user.userId;

    if (hasRevenge) {
      rec.revengeTargetId = killerId;
      rec.revengeTargetName = killerName;
    } else {
      rec.revengeTargetId = null;
      rec.revengeTargetName = null;
    }

    // Never two balls — respawn replaces
    this.physics.respawn(user);

    const emitted: CombatEvent[] = [];

    if (hasRevenge && killerId) {
      // Mark killer with 🎯 for ~10s (visual only)
      if (this.physics.hasUser(killerId)) {
        this.physics.markRevengeTarget(killerId, Date.now() + REVENGE_MARK_MS);
      }
      const ann: AnnounceEvent = {
        type: 'announce',
        kind: 'revenge_respawn',
        message: `@${rec.nickname || rec.username} VOLTOU POR VINGANÇA!`,
        userId: rec.userId,
        username: rec.nickname || rec.username,
        targetId: killerId,
        targetName: killerName || undefined,
        timestamp: Date.now(),
      };
      emitted.push(ann);
      this.pushCombat(ann);
    } else {
      const ann: AnnounceEvent = {
        type: 'announce',
        kind: 'respawn',
        message: `@${rec.nickname || rec.username} VOLTOU PARA A ARENA!`,
        userId: rec.userId,
        username: rec.nickname || rec.username,
        timestamp: Date.now(),
      };
      emitted.push(ann);
      this.pushCombat(ann);
    }

    this.state = { ...this.state, playerCount: this.physics.count };
    this.ensurePhysicsRunning();
    this.emitRound();
    this.emitSnapshot();
    console.log(`[Respawn] ${rec.username} revenge=${hasRevenge}`);
    return emitted;
  }

  private ensurePlayerRecord(
    userId: string,
    username: string,
    nickname?: string
  ): PlayerRecord {
    let rec = this.players.get(userId);
    if (!rec) {
      rec = {
        userId,
        username,
        nickname,
        kills: 0,
        deaths: 0,
        alive: true,
        deadAt: null,
        lastKillerId: null,
        lastKillerName: null,
        revengeTargetId: null,
        revengeTargetName: null,
        damageDealt: 0,
        damageTaken: 0,
        collisions: 0,
        highestSpeed: 0,
        killsAgainst: new Map(),
      };
      this.players.set(userId, rec);
    } else {
      rec.username = username;
      if (nickname) rec.nickname = nickname;
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

  private syncSpeedStats(): void {
    for (const b of this.physics.getAll()) {
      const rec = this.players.get(b.userId);
      if (rec && b.highestSpeed > rec.highestSpeed) rec.highestSpeed = b.highestSpeed;
    }
  }

  private processDamages(damages: DamageApplication[]): CombatEvent[] {
    const emitted: CombatEvent[] = [];
    const killedIds = new Set<string>();

    // Count collision pairs once
    const pairs = new Set<string>();

    for (const d of damages) {
      if (d.damage <= 0) continue;

      const pairKey = [d.attackerId, d.victimId].sort().join(':');
      if (!pairs.has(pairKey)) {
        pairs.add(pairKey);
        const a = this.players.get(d.attackerId);
        const v = this.players.get(d.victimId);
        if (a) a.collisions += 1;
        if (v) v.collisions += 1;
      }

      const attacker = this.players.get(d.attackerId);
      const victim = this.players.get(d.victimId);
      if (attacker) attacker.damageDealt += d.damage;
      if (victim) victim.damageTaken += d.damage;

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

    const victim = this.ensurePlayerRecord(d.victimId, d.victimName);
    victim.alive = false;
    victim.deaths += 1;
    victim.deadAt = Date.now();
    victim.lastKillerId = lastHitterId && lastHitterId !== d.victimId ? lastHitterId : null;
    victim.lastKillerName = victim.lastKillerId ? lastHitterName : null;
    // Clear own revenge mark on death
    victim.revengeTargetId = null;
    victim.revengeTargetName = null;

    let attackerId: string | null = victim.lastKillerId;
    let attackerName: string | null = victim.lastKillerName;
    let isRevenge = false;
    let rivalryCount = 0;

    if (attackerId && attackerId !== 'admin') {
      const atk = this.ensurePlayerRecord(attackerId, attackerName || '???');
      atk.kills += 1;
      attackerName = atk.nickname || atk.username;

      // Rivalry: A killed B
      const prev = atk.killsAgainst.get(d.victimId) || 0;
      rivalryCount = prev + 1;
      atk.killsAgainst.set(d.victimId, rivalryCount);

      // Revenge fulfilled?
      if (atk.revengeTargetId === d.victimId) {
        isRevenge = true;
        atk.revengeTargetId = null;
        atk.revengeTargetName = null;
        this.physics.clearRevengeMark(d.victimId);
      }

      // Clear mark on attacker if they were someone's target and died... N/A here
    } else if (attackerId === 'admin') {
      attackerName = 'admin';
    } else {
      attackerId = null;
      attackerName = null;
    }

    let message: string;
    if (isRevenge && attackerName) {
      message = `VINGANÇA! @${attackerName} se vingou de @${d.victimName}`;
    } else if (attackerName) {
      message = `@${attackerName} eliminou @${d.victimName}`;
    } else {
      message = `@${d.victimName} foi eliminado`;
    }

    console.log(`[Kill] ${message}`);

    const killEv: KillEvent = {
      type: 'kill',
      attackerId,
      attackerName,
      victimId: d.victimId,
      victimName: d.victimName,
      message,
      x,
      y,
      timestamp: Date.now(),
      isRevenge,
      rivalryCount: rivalryCount || undefined,
    };

    // Elimination + respawn hint
    const hint: AnnounceEvent = {
      type: 'announce',
      kind: 'eliminated',
      message: attackerName
        ? `@${d.victimName} eliminado por @${attackerName} — COMENTE NOVAMENTE PARA VOLTAR`
        : `@${d.victimName} eliminado — COMENTE NOVAMENTE PARA VOLTAR`,
      userId: d.victimId,
      username: d.victimName,
      targetId: attackerId || undefined,
      targetName: attackerName || undefined,
      timestamp: Date.now(),
    };
    this.pushCombat(hint);

    // Occasional rivalry announcement (2nd+ kill in round, not every time spam — every 2+)
    if (rivalryCount >= 2 && attackerName && !isRevenge) {
      const riv: AnnounceEvent = {
        type: 'announce',
        kind: 'rivalry',
        message: `🔥 Rivalidade! @${attackerName} já eliminou @${d.victimName} ${rivalryCount}x nesta rodada`,
        userId: attackerId || undefined,
        username: attackerName,
        targetId: d.victimId,
        targetName: d.victimName,
        timestamp: Date.now(),
      };
      this.pushCombat(riv);
    }

    return killEv;
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
