import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_BALL_RADIUS,
  DEFAULT_BALL_HP,
  MAX_BALL_SPEED,
  MIN_SPAWN_SPEED,
  MAX_SPAWN_SPEED,
  SPEED_BOOST_ON_COLLISION,
  DAMAGE_SPEED_FACTOR,
  DAMAGE_MIN,
  DAMAGE_MAX,
  DAMAGE_IMPACT_THRESHOLD,
  SPAWN_PROTECTION_MS,
  killStrengthMult,
  MILD_ATTRACTION_ACCEL,
  MILD_ATTRACTION_RADIUS,
  MILD_ATTRACTION_MAX_ACCEL,
  LIGHTNING_SLOW_MS,
  LIGHTNING_SLOW_FACTOR,
  LIGHTNING_RANGE,
  LIGHTNING_DAMAGE,
  MAGNET_PULSE_RADIUS,
  MAGNET_PULSE_PULL,
  MAGNET_PULSE_VISUAL_MS,
  FREEZE_AURA_MS,
  FREEZE_AURA_RADIUS,
  FREEZE_AURA_SLOW,
  FREEZE_AURA_TICK_SLOW_MS,
  DASH_BURST_BOOST,
  DASH_BURST_SPEED_MS,
  DASH_BURST_SPEED_MULT,
  REFLECT_SHIELD_MS,
  REFLECT_RATIO,
  GIFT_SOFT_MAX_HP,
  DINO_STRENGTH_MULT,
  DINO_SPEED_MULT,
  DINO_COLLISION_DMG_MULT,
  DONUT_SPEED_MULT,
  DONUT_RESIST,
  SUGAR_BURST_SPEED_MULT,
  SUGAR_BURST_DURATION_MS,
  SUGAR_BURST_PUSH,
  SUGAR_BURST_DAMAGE,
  SUGAR_BURST_RADIUS,
  TITAN_SIZE_MULT,
  TITAN_MASS_MULT,
  TITAN_STRENGTH_MULT,
  TITAN_RESIST,
  TITAN_COLLISION_DMG_MULT,
  TITAN_SPEED_MULT,
  TITAN_ULTRA_CALMA_KB,
  TITAN_STOMP_SPEED,
  TITAN_STOMP_PUSH,
  TITAN_STOMP_RADIUS,
  TITAN_HIT_KB_BONUS,
  TITAN_HIT_SPEED,
  TITAN_REGEN_PER_SEC,
  GALAXY_STRENGTH_MULT,
  GALAXY_SPEED_MULT,
  GALAXY_SIZE_MULT,
  GALAXY_MASS_MULT,
  GALAXY_IMPACT_SPEED,
  GALAXY_IMPACT_PUSH,
  GALAXY_IMPACT_EXTRA_DMG,
  type ArenaUser,
  type BallState,
  type BuffKey,
} from '@arena/shared';

export interface BallBody {
  id: string;
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: number;
  hp: number;
  maxHp: number;
  strength: number;
  /** Round kill count — drives killStrengthMult in activeStrength */
  kills: number;
  /** External slow (lightning / freeze aura) */
  slowUntil: number;
  freezeAuraUntil: number;
  magnetPulseUntil: number;
  dashUntil: number;
  reflectUntil: number;
  hitFlashTicks: number;
  lastHitterId: string | null;
  lastHitterName: string | null;
  spawnProtectedUntil: number;
  revengeMarkedUntil: number;
  highestSpeed: number;
  /** Base (pre-buff) geometry */
  baseRadius: number;
  baseMass: number;
  baseStrength: number;
  /** Timed buffs */
  dinoRageUntil: number;
  donutUntil: number;
  sugarBurstUntil: number;
  titanUntil: number;
  /** Titan multipliers applied once until buff ends */
  titanApplied: boolean;
  galaxy: boolean;
  shieldHp: number;
  /** VFX */
  healFlashTicks: number;
  sugarBurstFlashTicks: number;
  stompFlashTicks: number;
  galaxyImpactFlashTicks: number;
  /** Accumulators for regen */
  regenAcc: number;
}

export interface DamageApplication {
  victimId: string;
  victimName: string;
  attackerId: string;
  attackerName: string;
  damage: number;
  victimHpAfter: number;
  x: number;
  y: number;
  killed: boolean;
  shieldBroke?: boolean;
  /** Victim had reflect_shield and bounced damage */
  reflected?: boolean;
  reflectX?: number;
  reflectY?: number;
}

export interface FxEvent {
  type: 'sugar_burst' | 'stomp' | 'galaxy_impact';
  userId: string;
  x: number;
  y: number;
}

export interface StepResult {
  damages: DamageApplication[];
  fx: FxEvent[];
}

const COLORS = [
  0xfe2c55, 0x25f4ee, 0xffd60a, 0x7cfc00, 0xff6b35, 0xa78bfa, 0x38bdf8, 0xf472b6,
];

function hashColor(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function speedOf(b: BallBody): number {
  return Math.hypot(b.vx, b.vy);
}

function activeSpeedMult(b: BallBody, now: number): number {
  let m = 1;
  if (now < b.dinoRageUntil) m *= DINO_SPEED_MULT;
  if (now < b.donutUntil) m *= DONUT_SPEED_MULT;
  if (now < b.sugarBurstUntil) m *= SUGAR_BURST_SPEED_MULT;
  if (now < b.dashUntil) m *= DASH_BURST_SPEED_MULT;
  if (now < b.titanUntil) m *= TITAN_SPEED_MULT;
  if (b.galaxy) m *= GALAXY_SPEED_MULT;
  if (now < b.slowUntil) m *= FREEZE_AURA_SLOW;
  return m;
}

function activeStrength(b: BallBody, now: number): number {
  let s = b.baseStrength * killStrengthMult(b.kills);
  if (now < b.dinoRageUntil) s *= DINO_STRENGTH_MULT;
  if (now < b.titanUntil) s *= TITAN_STRENGTH_MULT;
  if (b.galaxy) s *= GALAXY_STRENGTH_MULT;
  return s;
}

function activeCollisionDmgMult(b: BallBody, now: number): number {
  let m = 1;
  if (now < b.dinoRageUntil) m *= DINO_COLLISION_DMG_MULT;
  if (now < b.titanUntil) m *= TITAN_COLLISION_DMG_MULT;
  if (b.galaxy) m *= GALAXY_IMPACT_EXTRA_DMG;
  return m;
}

function activeResist(b: BallBody, now: number): number {
  let r = 0;
  if (now < b.donutUntil) r += DONUT_RESIST;
  if (now < b.titanUntil) r += TITAN_RESIST;
  return Math.min(0.85, r);
}

function knockbackTakenMult(b: BallBody, now: number): number {
  if (now < b.titanUntil) return TITAN_ULTRA_CALMA_KB;
  return 1;
}

function maxSpeedFor(b: BallBody, now: number): number {
  return MAX_BALL_SPEED * activeSpeedMult(b, now);
}

function capSpeed(b: BallBody, now = Date.now()): void {
  const s = speedOf(b);
  if (!Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
    b.vx = MIN_SPAWN_SPEED;
    b.vy = 0;
    return;
  }
  const max = maxSpeedFor(b, now);
  if (s > max) {
    const k = max / s;
    b.vx *= k;
    b.vy *= k;
  }
  const capped = speedOf(b);
  if (capped > b.highestSpeed) b.highestSpeed = capped;
}

function boostSpeed(b: BallBody, now = Date.now()): void {
  b.vx *= SPEED_BOOST_ON_COLLISION;
  b.vy *= SPEED_BOOST_ON_COLLISION;
  capSpeed(b, now);
}

function calcDamage(
  impact: number,
  attackerMass: number,
  victimMass: number,
  strength: number,
  collisionMult: number
): number {
  const total = attackerMass + victimMass || 1;
  const share = attackerMass / total;
  const raw = impact * DAMAGE_SPEED_FACTOR * share * strength * collisionMult;
  return clamp(Math.round(raw), DAMAGE_MIN, DAMAGE_MAX);
}

function isProtected(b: BallBody, now = Date.now()): boolean {
  return now < b.spawnProtectedUntil;
}

function recomputeGeometry(b: BallBody, now: number): void {
  let size = 1;
  let massM = 1;
  if (now < b.titanUntil && b.titanApplied) {
    size *= TITAN_SIZE_MULT;
    massM *= TITAN_MASS_MULT;
  }
  if (b.galaxy) {
    size *= GALAXY_SIZE_MULT;
    massM *= GALAXY_MASS_MULT;
  }
  b.radius = b.baseRadius * size;
  b.mass = b.baseMass * massM;
  b.strength = activeStrength(b, now);
}

export class PhysicsWorld {
  private balls = new Map<string, BallBody>();
  private globalDamageUntil = 0;
  private globalDamageMult = 1;
  private readonly width = CANVAS_WIDTH;
  private readonly height = CANVAS_HEIGHT;
  private readonly margin = 8;

  get count(): number {
    return this.balls.size;
  }

  clear(): void {
    this.balls.clear();
  }

  hasUser(userId: string): boolean {
    return this.balls.has(userId);
  }

  getBall(userId: string): BallBody | undefined {
    return this.balls.get(userId);
  }

  getAll(): BallBody[] {
    return [...this.balls.values()];
  }


  /** Sync round kills onto the live ball (strength scales with kills). */
  setKills(userId: string, kills: number): void {
    const b = this.balls.get(userId);
    if (!b) return;
    b.kills = Math.max(0, Math.floor(kills));
    recomputeGeometry(b, Date.now());
  }

  removeBall(userId: string): BallBody | undefined {
    const b = this.balls.get(userId);
    if (b) this.balls.delete(userId);
    return b;
  }

  markRevengeTarget(userId: string, untilMs: number): void {
    const b = this.balls.get(userId);
    if (b) b.revengeMarkedUntil = Math.max(b.revengeMarkedUntil, untilMs);
  }

  clearRevengeMark(userId: string): void {
    const b = this.balls.get(userId);
    if (b) b.revengeMarkedUntil = 0;
  }

  /** Soft heal — soft max GIFT_SOFT_MAX_HP unless galaxy */
  heal(userId: string, amount: number): number {
    const b = this.balls.get(userId);
    if (!b) return 0;
    const before = b.hp;
    if (b.galaxy) {
      b.hp += amount;
    } else {
      b.hp = Math.min(GIFT_SOFT_MAX_HP, b.hp + amount);
      b.maxHp = Math.min(GIFT_SOFT_MAX_HP, Math.max(b.maxHp, b.hp, DEFAULT_BALL_HP));
    }
    b.healFlashTicks = 10;
    return b.hp - before;
  }

  addShield(userId: string, amount: number, maxShield: number): number {
    const b = this.balls.get(userId);
    if (!b) return 0;
    const before = b.shieldHp;
    b.shieldHp = Math.min(maxShield, b.shieldHp + amount);
    return b.shieldHp - before;
  }

  setTimedBuff(
    userId: string,
    kind: 'dino' | 'donut' | 'sugar' | 'titan' | 'dash' | 'freeze' | 'reflect' | 'magnet',
    until: number
  ): void {
    const b = this.balls.get(userId);
    if (!b) return;
    const now = Date.now();
    if (kind === 'dino') b.dinoRageUntil = Math.max(b.dinoRageUntil, until);
    if (kind === 'donut') b.donutUntil = Math.max(b.donutUntil, until);
    if (kind === 'sugar') b.sugarBurstUntil = Math.max(b.sugarBurstUntil, until);
    if (kind === 'dash') b.dashUntil = Math.max(b.dashUntil, until);
    if (kind === 'freeze') b.freezeAuraUntil = Math.max(b.freezeAuraUntil, until);
    if (kind === 'reflect') b.reflectUntil = Math.max(b.reflectUntil, until);
    if (kind === 'magnet') b.magnetPulseUntil = Math.max(b.magnetPulseUntil, until);
    if (kind === 'titan') {
      const was = now < b.titanUntil && b.titanApplied;
      b.titanUntil = Math.max(b.titanUntil, until);
      if (!was) b.titanApplied = true;
    }
    recomputeGeometry(b, now);
    // Nudge velocity toward new speed mult
    const mult = activeSpeedMult(b, now);
    const s = speedOf(b);
    if (s > 40 && mult > 1) {
      const target = Math.min(s * 1.08, maxSpeedFor(b, now));
      const k = target / s;
      b.vx *= k;
      b.vy *= k;
    }
    capSpeed(b, now);
  }

  enableGalaxy(userId: string): void {
    const b = this.balls.get(userId);
    if (!b) return;
    b.galaxy = true;
    b.hp = Math.max(b.hp, 9999);
    b.maxHp = 9999;
    recomputeGeometry(b, Date.now());
    capSpeed(b);
  }

  clearGalaxy(userId: string): void {
    const b = this.balls.get(userId);
    if (!b || !b.galaxy) return;
    b.galaxy = false;
    b.hp = Math.min(b.hp, GIFT_SOFT_MAX_HP);
    b.maxHp = Math.min(DEFAULT_BALL_HP, GIFT_SOFT_MAX_HP);
    if (b.hp > b.maxHp) b.hp = b.maxHp;
    recomputeGeometry(b, Date.now());
  }

  clearAllGalaxy(): void {
    for (const b of this.balls.values()) {
      if (b.galaxy) this.clearGalaxy(b.userId);
    }
  }

  /** Clear all temporary buffs (round reset / wipe) */
  clearAllBuffs(): void {
    this.clearGlobalDamage();
    const now = Date.now();
    for (const b of this.balls.values()) {
      b.dinoRageUntil = 0;
      b.donutUntil = 0;
      b.sugarBurstUntil = 0;
      b.titanUntil = 0;
      b.titanApplied = false;
      b.galaxy = false;
      b.shieldHp = 0;
      b.hp = Math.min(b.hp, DEFAULT_BALL_HP);
      b.maxHp = DEFAULT_BALL_HP;
      recomputeGeometry(b, now);
    }
  }

  /** Arena-wide damage multiplier (DOUBLE DAMAGE event) */
  setGlobalDamage(mult: number, untilMs: number): void {
    this.globalDamageMult = Math.max(1, mult);
    this.globalDamageUntil = Math.max(this.globalDamageUntil, untilMs);
  }

  clearGlobalDamage(): void {
    this.globalDamageUntil = 0;
    this.globalDamageMult = 1;
  }

  getGlobalDamageMult(now = Date.now()): number {
    if (now >= this.globalDamageUntil) return 1;
    return this.globalDamageMult;
  }

  isGlobalDamageActive(now = Date.now()): boolean {
    return now < this.globalDamageUntil;
  }


  applyDirectDamage(victimId: string, damage: number, attackerId?: string): DamageApplication | null {
    const victim = this.balls.get(victimId);
    if (!victim) return null;
    if (isProtected(victim)) return null;

    let attacker = attackerId ? this.balls.get(attackerId) : undefined;
    if (attacker && isProtected(attacker)) attacker = undefined;
    if (!attacker) {
      for (const b of this.balls.values()) {
        if (b.userId !== victimId && !isProtected(b)) {
          attacker = b;
          break;
        }
      }
    }
    const now = Date.now();
    const result = this.dealDamage(victim, Math.round(damage), attacker, now);
    return result;
  }

  spawnOrNudge(user: ArenaUser, radius = DEFAULT_BALL_RADIUS, withProtection = false): BallBody {
    const existing = this.balls.get(user.userId);
    if (existing) {
      if (!isProtected(existing)) {
        const angle = Math.random() * Math.PI * 2;
        const impulse = 40 + Math.random() * 60;
        existing.vx += Math.cos(angle) * impulse;
        existing.vy += Math.sin(angle) * impulse;
        capSpeed(existing);
      }
      if (user.avatarUrl) existing.avatarUrl = user.avatarUrl;
      if (user.nickname) existing.nickname = user.nickname;
      existing.username = user.username;
      return existing;
    }
    return this.createBall(user, radius, withProtection ? SPAWN_PROTECTION_MS : 0);
  }

  respawn(user: ArenaUser, radius = DEFAULT_BALL_RADIUS): BallBody {
    this.balls.delete(user.userId);
    return this.createBall(user, radius, SPAWN_PROTECTION_MS);
  }

  private createBall(user: ArenaUser, radius: number, protectionMs: number): BallBody {
    const r = radius;
    const pos = this.findSafeSpawn(r);
    const angle = Math.random() * Math.PI * 2;
    const speed = MIN_SPAWN_SPEED + Math.random() * (MAX_SPAWN_SPEED - MIN_SPAWN_SPEED);
    const now = Date.now();
    const body: BallBody = {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: r,
      mass: r * r,
      color: hashColor(user.userId),
      hp: DEFAULT_BALL_HP,
      maxHp: DEFAULT_BALL_HP,
      strength: 1,
      kills: 0,
      slowUntil: 0,
      freezeAuraUntil: 0,
      magnetPulseUntil: 0,
      dashUntil: 0,
      reflectUntil: 0,
      hitFlashTicks: 0,
      lastHitterId: null,
      lastHitterName: null,
      spawnProtectedUntil: protectionMs > 0 ? now + protectionMs : 0,
      revengeMarkedUntil: 0,
      highestSpeed: speed,
      baseRadius: r,
      baseMass: r * r,
      baseStrength: 1,
      dinoRageUntil: 0,
      donutUntil: 0,
      sugarBurstUntil: 0,
      titanUntil: 0,
      titanApplied: false,
      galaxy: false,
      shieldHp: 0,
      healFlashTicks: 0,
      sugarBurstFlashTicks: 0,
      stompFlashTicks: 0,
      galaxyImpactFlashTicks: 0,
      regenAcc: 0,
    };
    this.balls.set(user.userId, body);
    return body;
  }

  private findSafeSpawn(r: number): { x: number; y: number } {
    const minX = this.margin + r;
    const maxX = this.width - this.margin - r;
    const minY = this.margin + r;
    const maxY = this.height - this.margin - r;
    const others = [...this.balls.values()];
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const ok = others.every((o) => Math.hypot(o.x - x, o.y - y) > o.radius + r + 20);
      if (ok) return { x, y };
    }
    return {
      x: clamp(minX + Math.random() * (maxX - minX), minX, maxX),
      y: clamp(minY + Math.random() * (maxY - minY), minY, maxY),
    };
  }

  step(dt: number): StepResult {
    const damages: DamageApplication[] = [];
    const fx: FxEvent[] = [];
    if (dt <= 0 || !Number.isFinite(dt)) return { damages, fx };
    const now = Date.now();
    const list = [...this.balls.values()];

    for (const b of list) {
      if (b.hitFlashTicks > 0) b.hitFlashTicks -= 1;
      if (b.healFlashTicks > 0) b.healFlashTicks -= 1;
      if (b.sugarBurstFlashTicks > 0) b.sugarBurstFlashTicks -= 1;
      if (b.stompFlashTicks > 0) b.stompFlashTicks -= 1;
      if (b.galaxyImpactFlashTicks > 0) b.galaxyImpactFlashTicks -= 1;

      // Expire titan flag
      if (b.titanApplied && now >= b.titanUntil) {
        b.titanApplied = false;
      }
      recomputeGeometry(b, now);

      // Titan regen
      if (now < b.titanUntil) {
        b.regenAcc += TITAN_REGEN_PER_SEC * dt;
        if (b.regenAcc >= 1) {
          const add = Math.floor(b.regenAcc);
          b.regenAcc -= add;
          if (!b.galaxy) {
            b.hp = Math.min(GIFT_SOFT_MAX_HP, b.hp + add);
            b.maxHp = Math.max(b.maxHp, Math.min(GIFT_SOFT_MAX_HP, b.hp));
          } else {
            b.hp += add;
          }
        }
      }

      if (!Number.isFinite(b.x)) b.x = this.width / 2;
      if (!Number.isFinite(b.y)) b.y = this.height / 2;
      if (!Number.isFinite(b.vx)) b.vx = 0;
      if (!Number.isFinite(b.vy)) b.vy = 0;
    }

    // Mild mutual attraction (cluster fights) — before integrate
    this.applyMildAttraction(list, now, dt);

    // Freeze aura: keep nearby foes slowed
    for (const caster of list) {
      if (now >= caster.freezeAuraUntil) continue;
      for (const o of list) {
        if (o.userId === caster.userId) continue;
        if (isProtected(o, now) || isProtected(caster, now)) continue;
        const dist = Math.hypot(o.x - caster.x, o.y - caster.y);
        if (dist > FREEZE_AURA_RADIUS) continue;
        o.slowUntil = Math.max(o.slowUntil, now + FREEZE_AURA_TICK_SLOW_MS);
      }
    }

    for (const b of list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const wallFx = this.resolveWalls(b, now);
      if (wallFx) fx.push(wallFx);
      capSpeed(b, now);
    }

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (isProtected(a, now) || isProtected(b, now)) continue;
        const res = this.resolveBallBall(a, b, now);
        damages.push(...res.damages);
        fx.push(...res.fx);
      }
    }

    for (const b of list) {
      this.resolveWalls(b, now);
      capSpeed(b, now);
    }

    return { damages, fx };
  }


  /** Soft pull toward nearby balls — see MILD_ATTRACTION_* in shared. */
  private applyMildAttraction(list: BallBody[], now: number, dt: number): void {
    if (dt <= 0 || list.length < 2) return;
    const R = MILD_ATTRACTION_RADIUS;
    const acc = new Map<string, { ax: number; ay: number }>();
    for (const b of list) acc.set(b.userId, { ax: 0, ay: 0 });

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (isProtected(a, now) || isProtected(b, now)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist > R) continue;
        const falloff = 1 - dist / R;
        const mag = MILD_ATTRACTION_ACCEL * falloff;
        const nx = dx / dist;
        const ny = dy / dist;
        const aa = acc.get(a.userId)!;
        const bb = acc.get(b.userId)!;
        aa.ax += nx * mag;
        aa.ay += ny * mag;
        bb.ax -= nx * mag;
        bb.ay -= ny * mag;
      }
    }

    for (const b of list) {
      const a = acc.get(b.userId)!;
      let ax = a.ax;
      let ay = a.ay;
      const amag = Math.hypot(ax, ay);
      if (amag > MILD_ATTRACTION_MAX_ACCEL && amag > 0) {
        const k = MILD_ATTRACTION_MAX_ACCEL / amag;
        ax *= k;
        ay *= k;
      }
      b.vx += ax * dt;
      b.vy += ay * dt;
    }
  }

  /** Zap nearest unprotected foe: damage + brief slow. */
  applyLightningZap(casterId: string): {
    targetId: string | null;
    damage: number;
    x: number;
    y: number;
    targetX?: number;
    targetY?: number;
  } {
    const src = this.balls.get(casterId);
    if (!src) return { targetId: null, damage: 0, x: 0, y: 0 };
    const now = Date.now();
    let best: BallBody | null = null;
    let bestDist = LIGHTNING_RANGE;
    for (const o of this.balls.values()) {
      if (o.userId === casterId) continue;
      if (isProtected(o, now)) continue;
      const d = Math.hypot(o.x - src.x, o.y - src.y);
      if (d < bestDist) {
        bestDist = d;
        best = o;
      }
    }
    if (!best) return { targetId: null, damage: 0, x: src.x, y: src.y };
    best.vx *= LIGHTNING_SLOW_FACTOR;
    best.vy *= LIGHTNING_SLOW_FACTOR;
    best.slowUntil = Math.max(best.slowUntil, now + LIGHTNING_SLOW_MS);
    best.hitFlashTicks = 10;
    this.dealDamage(best, LIGHTNING_DAMAGE, src, now);
    return {
      targetId: best.userId,
      damage: LIGHTNING_DAMAGE,
      x: src.x,
      y: src.y,
      targetX: best.x,
      targetY: best.y,
    };
  }

  /** Strong short pull of nearby balls toward caster. */
  applyMagnetPulse(casterId: string): { count: number; x: number; y: number } {
    const src = this.balls.get(casterId);
    if (!src) return { count: 0, x: 0, y: 0 };
    const now = Date.now();
    src.magnetPulseUntil = Math.max(src.magnetPulseUntil, now + MAGNET_PULSE_VISUAL_MS);
    let n = 0;
    for (const o of this.balls.values()) {
      if (o.userId === casterId) continue;
      if (isProtected(o, now) || isProtected(src, now)) continue;
      const dx = src.x - o.x;
      const dy = src.y - o.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > MAGNET_PULSE_RADIUS) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const falloff = 1 - dist / MAGNET_PULSE_RADIUS;
      const pull = MAGNET_PULSE_PULL * (0.45 + 0.55 * falloff);
      o.vx += nx * pull;
      o.vy += ny * pull;
      capSpeed(o, now);
      n += 1;
    }
    return { count: n, x: src.x, y: src.y };
  }

  applyFreezeAura(casterId: string): { x: number; y: number } | null {
    const b = this.balls.get(casterId);
    if (!b) return null;
    this.setTimedBuff(casterId, 'freeze', Date.now() + FREEZE_AURA_MS);
    return { x: b.x, y: b.y };
  }

  applyDashBurst(casterId: string): { x: number; y: number; vx: number; vy: number } | null {
    const b = this.balls.get(casterId);
    if (!b) return null;
    const now = Date.now();
    const s = speedOf(b);
    let nx = 1;
    let ny = 0;
    if (s > 20) {
      nx = b.vx / s;
      ny = b.vy / s;
    } else {
      const ang = Math.random() * Math.PI * 2;
      nx = Math.cos(ang);
      ny = Math.sin(ang);
    }
    b.vx += nx * DASH_BURST_BOOST;
    b.vy += ny * DASH_BURST_BOOST;
    this.setTimedBuff(casterId, 'dash', now + DASH_BURST_SPEED_MS);
    capSpeed(b, now);
    return { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
  }

  applyReflectShield(casterId: string): { x: number; y: number } | null {
    const b = this.balls.get(casterId);
    if (!b) return null;
    this.setTimedBuff(casterId, 'reflect', Date.now() + REFLECT_SHIELD_MS);
    return { x: b.x, y: b.y };
  }

  toPublicStates(): BallState[] {
    const now = Date.now();
    const out: BallState[] = [];
    for (const b of this.balls.values()) {
      const buffs: BuffKey[] = [];
      if (now < b.dinoRageUntil) buffs.push('dino_rage');
      if (now < b.donutUntil) buffs.push('donut_overdrive');
      if (now < b.sugarBurstUntil) buffs.push('sugar_burst');
      if (now < b.titanUntil) buffs.push('capybara_titan');
      if (b.galaxy) buffs.push('galaxy_god');
      if (now < b.freezeAuraUntil) buffs.push('freeze_aura');
      if (now < b.reflectUntil) buffs.push('reflect_shield');
      if (now < b.slowUntil) buffs.push('slowed');
      if (now < b.magnetPulseUntil) buffs.push('magnet_pulse');
      if (now < b.dashUntil) buffs.push('dash_burst');
      const sizeScale = b.radius / b.baseRadius;
      out.push({
        id: b.id,
        userId: b.userId,
        username: b.username,
        nickname: b.nickname,
        avatarUrl: b.avatarUrl,
        x: b.x,
        y: b.y,
        radius: b.radius,
        color: b.color,
        hp: b.galaxy ? 9999 : b.hp,
        maxHp: b.galaxy ? 9999 : b.maxHp,
        label: b.nickname || b.username,
        hitFlash: b.hitFlashTicks > 0,
        spawnProtected: isProtected(b, now),
        revengeMarked: now < b.revengeMarkedUntil,
        buffs,
        shieldHp: b.shieldHp,
        isGalaxy: b.galaxy,
        sizeScale,
        healFlash: b.healFlashTicks > 0,
        sugarBurstFlash: b.sugarBurstFlashTicks > 0,
        stompFlash: b.stompFlashTicks > 0,
        galaxyImpactFlash: b.galaxyImpactFlashTicks > 0,
        kills: b.kills,
        strengthMult: killStrengthMult(b.kills),
      });
    }
    return out;
  }

  /** Apply damage with resist + shield + galaxy immortality */
  private dealDamage(
    victim: BallBody,
    raw: number,
    attacker: BallBody | undefined,
    now: number
  ): DamageApplication {
    const gMult = this.getGlobalDamageMult(now);
    let dmg = Math.max(0, Math.round(raw * gMult * (1 - activeResist(victim, now))));
    let shieldBroke = false;
    if (victim.shieldHp > 0 && dmg > 0) {
      const absorbed = Math.min(victim.shieldHp, dmg);
      victim.shieldHp -= absorbed;
      dmg -= absorbed;
      if (victim.shieldHp <= 0) {
        victim.shieldHp = 0;
        shieldBroke = true;
      }
    }
    // Reflect shield: bounce portion back (no infinite loop — only if victim has reflect)
    let reflected = false;
    let reflectX: number | undefined;
    let reflectY: number | undefined;
    if (attacker && now < victim.reflectUntil && dmg > 0 && !(now < attacker.reflectUntil)) {
      const bounced = Math.max(1, Math.round(dmg * REFLECT_RATIO));
      reflected = true;
      reflectX = victim.x;
      reflectY = victim.y;
      if (!attacker.galaxy) {
        // Non-lethal bounce — avoids orphan deaths without a kill event path
        attacker.hp = Math.max(1, attacker.hp - bounced);
        attacker.hitFlashTicks = 6;
      }
    }

    if (victim.galaxy) {
      // Cannot die — cosmetic chip only
      victim.hp = Math.max(5000, victim.hp - Math.min(dmg, 50));
      dmg = 0;
    } else if (dmg > 0) {
      victim.hp = Math.max(0, victim.hp - dmg);
    }
    victim.hitFlashTicks = 6;
    if (attacker) {
      victim.lastHitterId = attacker.userId;
      victim.lastHitterName = attacker.nickname || attacker.username;
    }
    return {
      victimId: victim.userId,
      victimName: victim.nickname || victim.username,
      attackerId: attacker?.userId || 'admin',
      attackerName: attacker ? attacker.nickname || attacker.username : 'admin',
      damage: Math.max(0, Math.round(raw)),
      victimHpAfter: victim.galaxy ? 9999 : victim.hp,
      x: victim.x,
      y: victim.y,
      killed: !victim.galaxy && victim.hp <= 0,
      shieldBroke,
      reflected: reflected || undefined,
      reflectX,
      reflectY,
    };
  }

  /** Public sugar burst after shield break */
  triggerSugarBurst(userId: string): { damages: DamageApplication[]; fx: FxEvent | null } {
    const src = this.balls.get(userId);
    if (!src) return { damages: [], fx: null };
    const now = Date.now();
    src.sugarBurstFlashTicks = 12;
    this.setTimedBuff(userId, 'sugar', now + SUGAR_BURST_DURATION_MS);
    const damages: DamageApplication[] = [];
    for (const o of this.balls.values()) {
      if (o.userId === userId) continue;
      if (isProtected(o, now)) continue;
      const dist = Math.hypot(o.x - src.x, o.y - src.y);
      if (dist > SUGAR_BURST_RADIUS || dist < 1) continue;
      const nx = (o.x - src.x) / dist;
      const ny = (o.y - src.y) / dist;
      const kb = SUGAR_BURST_PUSH * knockbackTakenMult(o, now);
      o.vx += nx * kb;
      o.vy += ny * kb;
      capSpeed(o, now);
      damages.push(this.dealDamage(o, SUGAR_BURST_DAMAGE, src, now));
    }
    return {
      damages,
      fx: { type: 'sugar_burst', userId, x: src.x, y: src.y },
    };
  }

  private resolveWalls(b: BallBody, now: number): FxEvent | null {
    const minX = this.margin + b.radius;
    const maxX = this.width - this.margin - b.radius;
    const minY = this.margin + b.radius;
    const maxY = this.height - this.margin - b.radius;
    let hit = false;
    const preSpeed = speedOf(b);

    if (b.x < minX) {
      b.x = minX;
      b.vx = Math.abs(b.vx);
      hit = true;
    } else if (b.x > maxX) {
      b.x = maxX;
      b.vx = -Math.abs(b.vx);
      hit = true;
    }

    if (b.y < minY) {
      b.y = minY;
      b.vy = Math.abs(b.vy);
      hit = true;
    } else if (b.y > maxY) {
      b.y = maxY;
      b.vy = -Math.abs(b.vy);
      hit = true;
    }

    if (hit) {
      boostSpeed(b, now);
      // Capybara stomp on hard wall hit
      if (now < b.titanUntil && preSpeed >= TITAN_STOMP_SPEED) {
        b.stompFlashTicks = 10;
        this.applyRadialPush(b, TITAN_STOMP_RADIUS, TITAN_STOMP_PUSH, now);
        return { type: 'stomp', userId: b.userId, x: b.x, y: b.y };
      }
    }
    return null;
  }

  private applyRadialPush(src: BallBody, radius: number, push: number, now: number): void {
    for (const o of this.balls.values()) {
      if (o.userId === src.userId) continue;
      const dist = Math.hypot(o.x - src.x, o.y - src.y);
      if (dist > radius || dist < 1) continue;
      const nx = (o.x - src.x) / dist;
      const ny = (o.y - src.y) / dist;
      const falloff = 1 - dist / radius;
      const kb = push * falloff * knockbackTakenMult(o, now);
      o.vx += nx * kb;
      o.vy += ny * kb;
      capSpeed(o, now);
    }
  }

  private resolveBallBall(
    a: BallBody,
    b: BallBody,
    now: number
  ): { damages: DamageApplication[]; fx: FxEvent[] } {
    const damages: DamageApplication[] = [];
    const fx: FxEvent[] = [];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;

    if (dist === 0 || !Number.isFinite(dist)) {
      dx = Math.random() - 0.5;
      dy = Math.random() - 0.5;
      dist = Math.hypot(dx, dy) || 1;
    }

    if (dist >= minDist) return { damages, fx };

    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = minDist - dist;
    const totalMass = a.mass + b.mass;
    const pushA = overlap * (b.mass / totalMass);
    const pushB = overlap * (a.mass / totalMass);
    a.x -= nx * pushA;
    a.y -= ny * pushA;
    b.x += nx * pushB;
    b.y += ny * pushB;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal > 0) {
      boostSpeed(a, now);
      boostSpeed(b, now);
      return { damages, fx };
    }

    const impact = -velAlongNormal;

    if (impact >= DAMAGE_IMPACT_THRESHOLD) {
      const dmgToA = calcDamage(
        impact,
        b.mass * activeStrength(b, now),
        a.mass,
        activeStrength(b, now),
        activeCollisionDmgMult(b, now)
      );
      const dmgToB = calcDamage(
        impact,
        a.mass * activeStrength(a, now),
        b.mass,
        activeStrength(a, now),
        activeCollisionDmgMult(a, now)
      );

      const appA = this.dealDamage(a, dmgToA, b, now);
      const appB = this.dealDamage(b, dmgToB, a, now);
      damages.push(appA, appB);

      // Galaxy impact
      if (a.galaxy && impact >= GALAXY_IMPACT_SPEED) {
        a.galaxyImpactFlashTicks = 10;
        const kb = GALAXY_IMPACT_PUSH * knockbackTakenMult(b, now);
        b.vx += nx * kb;
        b.vy += ny * kb;
        fx.push({ type: 'galaxy_impact', userId: a.userId, x: a.x, y: a.y });
      }
      if (b.galaxy && impact >= GALAXY_IMPACT_SPEED) {
        b.galaxyImpactFlashTicks = 10;
        const kb = GALAXY_IMPACT_PUSH * knockbackTakenMult(a, now);
        a.vx -= nx * kb;
        a.vy -= ny * kb;
        fx.push({ type: 'galaxy_impact', userId: b.userId, x: b.x, y: b.y });
      }
    }

    const restitution = 0.92;
    const invMassA = 1 / a.mass;
    const invMassB = 1 / b.mass;
    let j = -(1 + restitution) * velAlongNormal;
    j /= invMassA + invMassB;

    // Titan extra knockback on high-speed hits
    let jA = j;
    let jB = j;
    const spdA = speedOf(a);
    const spdB = speedOf(b);
    if (now < a.titanUntil && spdA >= TITAN_HIT_SPEED) jB *= TITAN_HIT_KB_BONUS;
    if (now < b.titanUntil && spdB >= TITAN_HIT_SPEED) jA *= TITAN_HIT_KB_BONUS;

    // Ultra Calma reduces received knockback
    jA *= knockbackTakenMult(a, now);
    jB *= knockbackTakenMult(b, now);

    a.vx -= jA * nx * invMassA;
    a.vy -= jA * ny * invMassA;
    b.vx += jB * nx * invMassB;
    b.vy += jB * ny * invMassB;

    boostSpeed(a, now);
    boostSpeed(b, now);
    return { damages, fx };
  }
}
