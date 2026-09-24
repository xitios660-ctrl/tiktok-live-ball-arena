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
  type ArenaUser,
  type BallState,
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
  hitFlashTicks: number;
  lastHitterId: string | null;
  lastHitterName: string | null;
  /** ms timestamp — protected until */
  spawnProtectedUntil: number;
  /** ms timestamp — 🎯 mark until */
  revengeMarkedUntil: number;
  highestSpeed: number;
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
}

export interface StepResult {
  damages: DamageApplication[];
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

function capSpeed(b: BallBody): void {
  const s = speedOf(b);
  if (!Number.isFinite(b.vx) || !Number.isFinite(b.vy)) {
    b.vx = MIN_SPAWN_SPEED;
    b.vy = 0;
    return;
  }
  if (s > MAX_BALL_SPEED) {
    const k = MAX_BALL_SPEED / s;
    b.vx *= k;
    b.vy *= k;
  }
  const capped = speedOf(b);
  if (capped > b.highestSpeed) b.highestSpeed = capped;
}

function boostSpeed(b: BallBody): void {
  b.vx *= SPEED_BOOST_ON_COLLISION;
  b.vy *= SPEED_BOOST_ON_COLLISION;
  capSpeed(b);
}

function calcDamage(impact: number, attackerMass: number, victimMass: number, strength: number): number {
  const total = attackerMass + victimMass || 1;
  const share = attackerMass / total;
  const raw = impact * DAMAGE_SPEED_FACTOR * share * strength;
  return clamp(Math.round(raw), DAMAGE_MIN, DAMAGE_MAX);
}

function isProtected(b: BallBody, now = Date.now()): boolean {
  return now < b.spawnProtectedUntil;
}

export class PhysicsWorld {
  private balls = new Map<string, BallBody>();
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
    const dmg = clamp(Math.round(damage), 1, 999);
    victim.hp = Math.max(0, victim.hp - dmg);
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
      damage: dmg,
      victimHpAfter: victim.hp,
      x: victim.x,
      y: victim.y,
      killed: victim.hp <= 0,
    };
  }

  /** First join / comment while alive-missing — create ball (optional short protection for first spawn too) */
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

  /** Respawn after death — always new ball, HP 100, spawn protection */
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
      hitFlashTicks: 0,
      lastHitterId: null,
      lastHitterName: null,
      spawnProtectedUntil: protectionMs > 0 ? now + protectionMs : 0,
      revengeMarkedUntil: 0,
      highestSpeed: speed,
    };
    this.balls.set(user.userId, body);
    return body;
  }

  /** Prefer empty space away from other balls */
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
    if (dt <= 0 || !Number.isFinite(dt)) return { damages };
    const now = Date.now();
    const list = [...this.balls.values()];

    for (const b of list) {
      if (b.hitFlashTicks > 0) b.hitFlashTicks -= 1;
      if (!Number.isFinite(b.x)) b.x = this.width / 2;
      if (!Number.isFinite(b.y)) b.y = this.height / 2;
      if (!Number.isFinite(b.vx)) b.vx = 0;
      if (!Number.isFinite(b.vy)) b.vy = 0;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.resolveWalls(b);
      capSpeed(b);
    }

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Spawn protection: no push, no damage with either party
        if (isProtected(a, now) || isProtected(b, now)) continue;
        damages.push(...this.resolveBallBall(a, b));
      }
    }

    for (const b of list) {
      this.resolveWalls(b);
      capSpeed(b);
    }

    return { damages };
  }

  toPublicStates(): BallState[] {
    const now = Date.now();
    const out: BallState[] = [];
    for (const b of this.balls.values()) {
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
        hp: b.hp,
        maxHp: b.maxHp,
        label: b.nickname || b.username,
        hitFlash: b.hitFlashTicks > 0,
        spawnProtected: isProtected(b, now),
        revengeMarked: now < b.revengeMarkedUntil,
      });
    }
    return out;
  }

  private resolveWalls(b: BallBody): void {
    const minX = this.margin + b.radius;
    const maxX = this.width - this.margin - b.radius;
    const minY = this.margin + b.radius;
    const maxY = this.height - this.margin - b.radius;
    let hit = false;

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

    if (hit) boostSpeed(b);
  }

  private resolveBallBall(a: BallBody, b: BallBody): DamageApplication[] {
    const out: DamageApplication[] = [];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;

    if (dist === 0 || !Number.isFinite(dist)) {
      dx = Math.random() - 0.5;
      dy = Math.random() - 0.5;
      dist = Math.hypot(dx, dy) || 1;
    }

    if (dist >= minDist) return out;

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
      boostSpeed(a);
      boostSpeed(b);
      return out;
    }

    const impact = -velAlongNormal;

    if (impact >= DAMAGE_IMPACT_THRESHOLD) {
      const dmgToA = calcDamage(impact, b.mass * b.strength, a.mass, b.strength);
      const dmgToB = calcDamage(impact, a.mass * a.strength, b.mass, a.strength);

      a.hp = Math.max(0, a.hp - dmgToA);
      b.hp = Math.max(0, b.hp - dmgToB);
      a.hitFlashTicks = 6;
      b.hitFlashTicks = 6;
      a.lastHitterId = b.userId;
      a.lastHitterName = b.nickname || b.username;
      b.lastHitterId = a.userId;
      b.lastHitterName = a.nickname || a.username;

      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;

      out.push({
        victimId: a.userId,
        victimName: a.nickname || a.username,
        attackerId: b.userId,
        attackerName: b.nickname || b.username,
        damage: dmgToA,
        victimHpAfter: a.hp,
        x: cx,
        y: cy,
        killed: a.hp <= 0,
      });
      out.push({
        victimId: b.userId,
        victimName: b.nickname || b.username,
        attackerId: a.userId,
        attackerName: a.nickname || a.username,
        damage: dmgToB,
        victimHpAfter: b.hp,
        x: cx,
        y: cy,
        killed: b.hp <= 0,
      });
    }

    const restitution = 0.92;
    const invMassA = 1 / a.mass;
    const invMassB = 1 / b.mass;
    let j = -(1 + restitution) * velAlongNormal;
    j /= invMassA + invMassB;

    a.vx -= j * nx * invMassA;
    a.vy -= j * ny * invMassA;
    b.vx += j * nx * invMassB;
    b.vy += j * ny * invMassB;

    boostSpeed(a);
    boostSpeed(b);
    return out;
  }
}
