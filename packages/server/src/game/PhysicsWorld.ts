import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_BALL_RADIUS,
  DEFAULT_BALL_HP,
  MAX_BALL_SPEED,
  MIN_SPAWN_SPEED,
  MAX_SPAWN_SPEED,
  SPEED_BOOST_ON_COLLISION,
  type ArenaUser,
  type BallState,
} from '@arena/shared';

/** Internal physics body (server-only) */
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

/**
 * Authoritative circle physics for 1080×1920 arena.
 * Tick at PHYSICS_TICK_HZ from GameLoop.
 */
export class PhysicsWorld {
  private balls = new Map<string, BallBody>();
  private readonly width = CANVAS_WIDTH;
  private readonly height = CANVAS_HEIGHT;
  private readonly margin = 8; // inner padding from canvas edge

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

  /**
   * Spawn one ball per userId. If already present, nudge with small impulse.
   * Returns the body (new or existing).
   */
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
      mass: r * r, // area-proportional
      color: hashColor(user.userId),
      hp: DEFAULT_BALL_HP,
      maxHp: DEFAULT_BALL_HP,
    };
    this.balls.set(user.userId, body);
    return body;
  }

  /** Integrate physics for dt seconds */
  step(dt: number): void {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    const list = [...this.balls.values()];

    // Integrate positions
    for (const b of list) {
      if (!Number.isFinite(b.x)) b.x = this.width / 2;
      if (!Number.isFinite(b.y)) b.y = this.height / 2;
      if (!Number.isFinite(b.vx)) b.vx = 0;
      if (!Number.isFinite(b.vy)) b.vy = 0;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      this.resolveWalls(b);
      capSpeed(b);
    }

    // Ball-ball collisions (pairwise)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        this.resolveBallBall(list[i], list[j]);
      }
    }

    // Second wall pass after separations
    for (const b of list) {
      this.resolveWalls(b);
      capSpeed(b);
    }
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

  private resolveBallBall(a: BallBody, b: BallBody): void {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;

    if (dist === 0 || !Number.isFinite(dist)) {
      // Overlap at same point — separate randomly
      dx = Math.random() - 0.5;
      dy = Math.random() - 0.5;
      dist = Math.hypot(dx, dy) || 1;
    }

    if (dist >= minDist) return;

    // Normalize
    const nx = dx / dist;
    const ny = dy / dist;

    // Positional correction (push out)
    const overlap = minDist - dist;
    const totalMass = a.mass + b.mass;
    const pushA = (overlap * (b.mass / totalMass));
    const pushB = (overlap * (a.mass / totalMass));
    a.x -= nx * pushA;
    a.y -= ny * pushA;
    b.x += nx * pushB;
    b.y += ny * pushB;

    // Relative velocity along normal
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) {
      // Separating — still apply mild boost for "collision" contact
      boostSpeed(a);
      boostSpeed(b);
      return;
    }

    // Elastic-ish impulse (restitution ~0.9)
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
  }
}
