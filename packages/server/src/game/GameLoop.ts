import {
  DEFAULT_ROUND_DURATION_SEC,
  RESULTS_DURATION_SEC,
  PHYSICS_TICK_HZ,
  DEFAULT_BALL_HP,
  REVENGE_MARK_MS,
  KING_ANNOUNCE_COOLDOWN_MS,
  compareRanking,
  resolveAbilityKey,
  type RoundState,
  type TikTokMode,
  type ArenaLiveEvent,
  type ArenaGiftEvent,
  type ArenaUser,
  type GameSnapshot,
  type PlayerStats,
  type CombatEvent,
  type HitEvent,
  type KillEvent,
  type AnnounceEvent,
  type WinnerInfo,
  type HistoricalStats,
} from '@arena/shared';
import { randomUUID } from 'crypto';
import { PhysicsWorld, type DamageApplication } from './PhysicsWorld';
import { applyGiftAbility, sugarBurstAnnounce } from './GiftAbilities';

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
  private winner: WinnerInfo | null = null;
  private resultsRemainingSec = 0;
  private kingUserId: string | null = null;
  private lastKingAnnounceAt = 0;
  private lastMinuteAnnounced = false;
  private countdownAnnounced = new Set<number>();
  /** Persistent across rounds (in-memory stub for DB) */
  private historical = new Map<string, HistoricalStats>();
  /** Last ball that spawned / received focus — admin gifts target this */
  private lastSpawnedUserId: string | null = null;

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
    return {
      ...this.state,
      playerCount: this.physics.count,
      resultsRemainingSec: this.state.phase === 'results' ? this.resultsRemainingSec : undefined,
      kingUserId: this.kingUserId,
    };
  }

  getSnapshot(): GameSnapshot {
    this.syncSpeedStats();
    const stats = this.getStats();
    const top5 = stats.slice(0, 5);
    const kingUserId = this.kingUserId;
    const balls = this.physics.toPublicStates().map((b) => ({
      ...b,
      isKing: !!kingUserId && b.userId === kingUserId,
    }));
    return {
      tick: this.tick,
      tickHz: PHYSICS_TICK_HZ,
      phase: this.state.phase,
      remainingSec: this.state.remainingSec,
      resultsRemainingSec: this.state.phase === 'results' ? this.resultsRemainingSec : undefined,
      playerCount: this.physics.count,
      balls,
      stats,
      top5,
      kingUserId,
      winner: this.winner,
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
    list.sort(compareRanking);
    list.forEach((s, i) => {
      s.rank = i + 1;
    });
    return list;
  }

  getHistorical(): HistoricalStats[] {
    return [...this.historical.values()].sort((a, b) => b.wins - a.wins || b.totalKills - a.totalKills);
  }

  /** Admin: jump timer for fast testing */
  setRemainingSec(sec: number): RoundState {
    if (this.state.phase !== 'running') {
      return this.getState();
    }
    this.state = {
      ...this.state,
      remainingSec: Math.max(0, Math.floor(sec)),
    };
    this.lastMinuteAnnounced = this.state.remainingSec > 60 ? false : this.lastMinuteAnnounced;
    this.countdownAnnounced.clear();
    this.emitRound();
    this.emitSnapshot();
    return this.getState();
  }

  /** Admin: force end → results */
  forceEndRound(): RoundState {
    if (this.state.phase === 'running') {
      this.enterResults();
    }
    return this.getState();
  }

  /** Admin: skip results / start next immediately */
  forceNextRound(): RoundState {
    this.beginNextRound();
    return this.getState();
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
    this.lastSpawnedUserId = null;
    this.tick = 0;
    this.winner = null;
    this.resultsRemainingSec = 0;
    this.kingUserId = null;
    this.lastKingAnnounceAt = 0;
    this.lastMinuteAnnounced = false;
    this.countdownAnnounced.clear();
    this.state = {
      ...this.state,
      phase: 'running',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: Date.now(),
      playerCount: 0,
      resultsRemainingSec: undefined,
      kingUserId: null,
    };
    this.emitRound();
    this.roundTimer = setInterval(() => this.secondTick(), 1000);
    this.ensurePhysicsRunning();
    this.pushCombat({
      type: 'announce',
      kind: 'next_round',
      message: 'NOVA RODADA! Comentem para entrar na arena!',
      timestamp: Date.now(),
    });
    console.log(`[Game] Round ${this.state.roundId} started (${this.state.durationSec}s)`);
    return this.getState();
  }

  /** @deprecated use forceEndRound — kept for admin compat → results */
  endRound(): RoundState {
    return this.forceEndRound();
  }

  resetToWaiting(): RoundState {
    this.stopRoundTimer();
    this.stopPhysics();
    this.physics.clear();
    this.players.clear();
    this.recentCombat = [];
    this.tick = 0;
    this.winner = null;
    this.kingUserId = null;
    this.resultsRemainingSec = 0;
    this.state = {
      ...this.state,
      phase: 'waiting',
      roundId: randomUUID(),
      remainingSec: this.state.durationSec,
      startedAt: null,
      playerCount: 0,
      kingUserId: null,
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
    } else if (event.type === 'gift') {
      this.handleGift(event);
    }
  }

  /**
   * Gift benefits SENDER only. Spawns sender if missing.
   * Admin may pass preferred userId via event.user.
   */
  handleGift(event: ArenaGiftEvent): CombatEvent[] {
    if (this.state.phase === 'results' || this.state.phase === 'ended') return [];
    const ability = resolveAbilityKey(event.giftId);
    if (!ability) {
      console.warn(`[Gift] Unknown giftId=${event.giftId}`);
      return [];
    }

    // Ensure sender has a ball (gift can also be entry)
    this.spawnNewOrNudge(event.user);
    this.lastSpawnedUserId = event.user.userId;

    const result = applyGiftAbility(this.physics, event, ability);
    if (!result) return [];

    const emitted: CombatEvent[] = [];
    for (const a of result.announces) {
      emitted.push(a);
      this.pushCombat(a);
    }
    this.emitSnapshot();
    console.log(
      `[Gift] ${event.giftName} x${result.times} → @${event.user.username} (${ability})`
    );
    return emitted;
  }

  /** Prefer explicit userId, else last spawned, else first alive ball */
  resolveGiftTargetUserId(preferred?: string | null): string | null {
    if (preferred && this.physics.hasUser(preferred)) return preferred;
    if (this.lastSpawnedUserId && this.physics.hasUser(this.lastSpawnedUserId)) {
      return this.lastSpawnedUserId;
    }
    const first = this.physics.getAll()[0];
    return first?.userId ?? null;
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
    if (this.state.phase === 'ended' || this.state.phase === 'results') return;

    this.physics.spawnOrNudge(user);
    this.ensurePlayerRecord(user.userId, user.username, user.nickname);
    this.lastSpawnedUserId = user.userId;
    const rec = this.players.get(user.userId)!;
    rec.alive = true;
    rec.deadAt = null;
    this.state = { ...this.state, playerCount: this.physics.count };
    this.ensurePhysicsRunning();
    this.emitRound();
  }

  private respawnPlayer(user: ArenaUser): CombatEvent[] {
    if (this.state.phase === 'results' || this.state.phase === 'ended') return [];
    if (this.state.phase === 'waiting') {
      this.startRoundWithoutClear();
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
    this.winner = null;
    this.resultsRemainingSec = 0;
    this.lastMinuteAnnounced = false;
    this.countdownAnnounced.clear();
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
    const { damages, fx } = this.physics.step(this.dt);
    if (damages.length) this.processDamages(damages);
    for (const f of fx) {
      if (f.type === 'stomp') {
        this.pushCombat({
          type: 'announce',
          kind: 'stomp',
          message: `🦫 STOMP!`,
          userId: f.userId,
          timestamp: Date.now(),
        });
      } else if (f.type === 'galaxy_impact') {
        this.pushCombat({
          type: 'announce',
          kind: 'galaxy',
          message: `🌌 GALAXY IMPACT!`,
          userId: f.userId,
          timestamp: Date.now(),
        });
      }
    }
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
      if (d.damage <= 0 && !d.shieldBroke && !d.killed) continue;

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

      if (d.shieldBroke) {
        const victimBall = this.physics.getBall(d.victimId);
        const burst = this.physics.triggerSugarBurst(d.victimId);
        const ann = sugarBurstAnnounce(d.victimId, d.victimName);
        emitted.push(ann);
        this.pushCombat(ann);
        if (burst.damages.length) {
          // Process burst damages without re-entering shield recursion loops beyond one level
          for (const bd of burst.damages) {
            if (bd.killed && !killedIds.has(bd.victimId)) {
              killedIds.add(bd.victimId);
              const ke = this.handleDeath(bd);
              if (ke) {
                emitted.push(ke);
                this.pushCombat(ke);
              }
            }
          }
        }
        void victimBall;
      }

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
      this.updateKing();
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
    if (this.state.phase === 'results') {
      this.resultsRemainingSec = Math.max(0, this.resultsRemainingSec - 1);
      this.state = {
        ...this.state,
        resultsRemainingSec: this.resultsRemainingSec,
        playerCount: this.physics.count,
      };
      this.emitRound();
      this.emitSnapshot();
      if (this.resultsRemainingSec <= 0) {
        this.beginNextRound();
      }
      return;
    }

    if (this.state.phase !== 'running') return;

    const next = Math.max(0, this.state.remainingSec - 1);
    this.state = { ...this.state, remainingSec: next, playerCount: this.physics.count };

    // Timer announcements
    if (next === 60 && !this.lastMinuteAnnounced) {
      this.lastMinuteAnnounced = true;
      this.pushCombat({
        type: 'announce',
        kind: 'last_minute',
        message: 'ÚLTIMO MINUTO!',
        timestamp: Date.now(),
      });
    }
    if (next <= 10 && next >= 1 && !this.countdownAnnounced.has(next)) {
      this.countdownAnnounced.add(next);
      this.pushCombat({
        type: 'announce',
        kind: 'countdown',
        message: String(next),
        value: next,
        timestamp: Date.now(),
      });
    }

    this.updateKing();
    this.emitRound();
    this.emitSnapshot();

    if (next <= 0) {
      this.enterResults();
    }
  }

  private enterResults(): void {
    // Galaxy lasts ONLY until end of current round
    this.physics.clearAllGalaxy();
    this.physics.clearAllBuffs();
    // Freeze: stop physics stepping
    this.stopPhysics();
    const stats = this.getStats();
    const best = stats[0] || null;
    this.winner = best
      ? {
          userId: best.userId,
          username: best.username,
          nickname: best.nickname,
          kills: best.kills,
          deaths: best.deaths,
          damageDealt: best.damageDealt,
          highestSpeed: best.highestSpeed,
        }
      : null;

    // Roll into historical
    for (const s of stats) {
      this.accumulateHistorical(s, this.winner?.userId === s.userId);
    }

    this.resultsRemainingSec = RESULTS_DURATION_SEC;
    this.state = {
      ...this.state,
      phase: 'results',
      remainingSec: 0,
      resultsRemainingSec: this.resultsRemainingSec,
      playerCount: this.physics.count,
    };

    const wname = this.winner?.nickname || this.winner?.username;
    this.pushCombat({
      type: 'announce',
      kind: 'winner',
      message: wname
        ? `🏆 VENCEDOR: @${wname} — ${this.winner!.kills}☠ ${this.winner!.deaths}💀`
        : 'Rodada encerrada — sem vencedor',
      userId: this.winner?.userId,
      username: wname,
      timestamp: Date.now(),
    });

    // Ensure round timer keeps ticking for results countdown
    if (!this.roundTimer) {
      this.roundTimer = setInterval(() => this.secondTick(), 1000);
    }

    this.emitRound();
    this.emitSnapshot();
    console.log(`[Game] Results — winner=${wname || 'none'} (${RESULTS_DURATION_SEC}s)`);
  }

  /**
   * Decision (Etapa 11): wipe arena balls + clear round player records,
   * keep historical map, start fresh 5:00 running round.
   * Players re-enter via comment (cleanest).
   */
  private beginNextRound(): void {
    console.log('[Game] Auto-starting next round (wipe + reset temp state)');
    this.startRound();
  }

  private accumulateHistorical(s: PlayerStats, won: boolean): void {
    let h = this.historical.get(s.userId);
    if (!h) {
      h = {
        userId: s.userId,
        username: s.username,
        totalKills: 0,
        totalDeaths: 0,
        totalDamage: 0,
        wins: 0,
        roundsPlayed: 0,
      };
      this.historical.set(s.userId, h);
    }
    h.username = s.username;
    h.totalKills += s.kills;
    h.totalDeaths += s.deaths;
    h.totalDamage += s.damageDealt;
    h.roundsPlayed += 1;
    if (won) h.wins += 1;
  }

  private updateKing(): void {
    const stats = this.getStats();
    const top = stats[0];
    if (!top || (top.kills === 0 && top.damageDealt === 0)) {
      this.kingUserId = null;
      return;
    }
    const nextKing = top.userId;
    if (nextKing !== this.kingUserId) {
      this.kingUserId = nextKing;
      const now = Date.now();
      // Announce first crown + changes; throttle spam with KING_ANNOUNCE_COOLDOWN_MS
      if (now - this.lastKingAnnounceAt >= KING_ANNOUNCE_COOLDOWN_MS) {
        this.lastKingAnnounceAt = now;
        const name = top.nickname || top.username;
        this.pushCombat({
          type: 'announce',
          kind: 'new_king',
          message: `👑 NOVO REI DA ARENA: @${name}!`,
          userId: top.userId,
          username: name,
          timestamp: now,
        });
      }
    }
    this.state = { ...this.state, kingUserId: this.kingUserId };
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
