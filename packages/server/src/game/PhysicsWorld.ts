import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_BALL_RADIUS,
  DEFAULT_BALL_HP,
  MAX_BALL_HP,
  MAX_BALL_SPEED,
  MIN_SPAWN_SPEED,
  MAX_SPAWN_SPEED,
  SPEED_BOOST_ON_COLLISION,
  DAMAGE_SPEED_FACTOR,
  DAMAGE_MIN,
  DAMAGE_MAX,
  DAMAGE_IMPACT_THRESHOLD,
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
  /** Strength multiplier (gifts later); default 1 */
  strength: number;
  /** Frames remaining to show hit flash on client */
  hitFlashTicks: number;
  lastHitterId: string | null;
  lastHitterName: string | null;
}

/** One-sided damage applied during a ball-ball collision */
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
}

function boostSpeed(b: BallBody): void {
  b.vx *= SPEED_BOOST_ON_COLLISION;
  b.vy *= SPEED_BOOST_ON_COLLISION;
  capSpeed(b);
}

function calcDamage(impact: number, attackerMass: number, victimMass: number, strength: number): number {
  const total = attackerMass + victimMass || 1;
  // Heavier attacker / lighter victim → more damage to victim
  const share = attackerMass / total;
  const raw = impact * DAMAGE_SPEED_FACTOR * share * strength;
  return clamp(Math.round(raw), DAMAGE_MIN, DAMAGE_MAX);
}

/**
 * Authoritative circle physics + collision damage for 1080×1920 arena.
 */
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

  /** Admin / test: apply flat damage. Returns application or null. */
  applyDirectDamage(victimId: string, damage: number, attackerId?: string): DamageApplication | null {
    const victim = this.balls.get(victimId);
    if (!victim) return null;
    let attacker = attackerId ? this.balls.get(attackerId) : undefined;
    if (!attacker) {
      // pick any other ball as attacker for kill credit, else self/null
      for (const b of this.balls.values()) {
        if (b.userId !== victimId) {
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
    const killed = victim.hp <= 0;
    return {
      victimId: victim.userId,
      victimName: victim.nickname || victim.username,
      attackerId: attacker?.userId || 'admin',
      attackerName: attacker ? attacker.nickname || attacker.username : 'admin',
      damage: dmg,
      victimHpAfter: victim.hp,
      x: victim.x,
      y: victim.y,
      killed,
    };
  }

  spawnOrNudge(user: ArenaUser, radius = DEFAULT_BALL_RADIUS): BallBody {
    const existing = this.balls.get(user.userId);
    if (existing) {
      const angle = Math.random() * Math.PI * 2;
      const impulse = 40 + Math.random() * 60;
      existing.vx += Math.cos(angle) * impulse;
      existing.vy += Math.sin(angle) * impulse;
      if (user.avatarUrl) existing.avatarUrl = user.avatarUrl;
      if (user.nickname) existing.nickname = user.nickname;
      existing.username = user.username;
      capSpeed(existing);
      return existing;
    }

    const r = radius;
    const x = clamp(
      this.margin + r + Math.random() * (this.width - 2 * (this.margin + r)),
      this.margin + r,
      this.width - this.margin - r
    );
    const y = clamp(
      this.margin + r + Math.random() * (this.height - 2 * (this.margin + r)),
      this.margin + r,
      this.height - this.margin - r
    );
    const angle = Math.random() * Math.PI * 2;
    const speed = MIN_SPAWN_SPEED + Math.random() * (MAX_SPAWN_SPEED - MIN_SPAWN_SPEED);
    const body: BallBody = {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: r,
      mass: r * r,
      color: hashColor(user.userId),
      hp: DEFAULT_BALL_HP,
      maxHp: Math.min(MAX_BALL_HP, DEFAULT_BALL_HP),
      strength: 1,
      hitFlashTicks: 0,
      lastHitterId: null,
      lastHitterName: null,
    };
    // Fresh spawn: maxHp starts at 100; heals can raise toward MAX_BALL_HP later
    body.maxHp = DEFAULT_BALL_HP;
    this.balls.set(user.userId, body);
    return body;
  }

  step(dt: number): StepResult {
    const damages: DamageApplication[] = [];
    if (dt <= 0 || !Number.isFinite(dt)) return { damages };

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
        const hitDmgs = this.resolveBallBall(list[i], list[j]);
        damages.push(...hitDmgs);
      }
    }

    for (const b of list) {
      this.resolveWalls(b);
      capSpeed(b);
    }

    return { damages };
  }

  toPublicStates(): BallState[] {
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

    // Separating — no damage, mild boost only
    if (velAlongNormal > 0) {
      boostSpeed(a);
      boostSpeed(b);
      return out;
    }

    const impact = -velAlongNormal; // closing speed

    // Damage before impulse (use pre-bounce closing speed)
    if (impact >= DAMAGE_IMPACT_THRESHOLD) {
      // Mutual: each takes damage weighted by the OTHER's mass (heavier hits harder)
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

    const ix = j * nx;
    const iy = j * ny;
    a.vx -= ix * invMassA;
    a.vy -= iy * invMassA;
    b.vx += ix * invMassB;
    b.vy += iy * invMassB;

    boostSpeed(a);
    boostSpeed(b);
    return out;
  }
}
