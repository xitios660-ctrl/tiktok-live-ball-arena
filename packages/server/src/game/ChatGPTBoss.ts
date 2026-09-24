import { isBotUser, type RoundPhase } from '@arena/shared';
import type { BallBody, PhysicsWorld } from './PhysicsWorld';

export const CHATGPT_BOSS_USER_ID = 'boss-chatgpt';
export const CHATGPT_BOSS_USERNAME = 'chatgpt_boss';
export const CHATGPT_BOSS_NAME = '🤖 ChatGPT BOSS';
export const CHATGPT_BOSS_REWARD_KILLS = 10;

const BOSS_RADIUS = 84;
const BOSS_HP = 650;
const BOSS_BASE_STRENGTH = 1.55;
const BOSS_MASS_MULT = 3.2;
const LOCAL_DECISION_MS = 900;
const CHATGPT_DECISION_MS = 10_000;
const BOSS_MAX_SPEED = 650;
const BOSS_MIN_CRUISE = 250;
const BOSS_ACCEL = 390;

type BossTactic =
  | 'hunt_leader'
  | 'hunt_weak'
  | 'intercept'
  | 'center_control'
  | 'retreat';

interface BossPlan {
  tactic: BossTactic;
  targetId: string | null;
  aggression: number;
  source: 'local' | 'chatgpt';
  reason?: string;
}

interface ChatGPTResponse {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw == null || raw === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  return fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function speedOf(b: BallBody): number {
  return Math.hypot(b.vx, b.vy);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const d = Math.hypot(x, y);
  if (!Number.isFinite(d) || d < 0.0001) return { x: 1, y: 0 };
  return { x: x / d, y: y / d };
}

/**
 * Server-authoritative boss controller.
 *
 * Fast steering is always local so physics never waits for a network request.
 * When OPENAI_API_KEY is available, ChatGPT can update the boss's high-level
 * tactic roughly every 10s. If the API is unavailable/slow, the local planner
 * keeps the boss fully playable.
 */
export class ChatGPTBossController {
  private enabled = envBool('CHATGPT_BOSS_ENABLED', true);
  private spawnedThisRound = false;
  private defeatedThisRound = false;
  private roundStartedAt = Date.now();
  private nextLocalDecisionAt = 0;
  private nextChatGPTDecisionAt = 0;
  private nextBurstAt = 0;
  private requestInFlight = false;
  private controller: AbortController | null = null;
  private plan: BossPlan = {
    tactic: 'hunt_leader',
    targetId: null,
    aggression: 0.8,
    source: 'local',
  };

  constructor(private readonly physics: PhysicsWorld) {}

  resetRound(): void {
    this.spawnedThisRound = false;
    this.defeatedThisRound = false;
    this.roundStartedAt = Date.now();
    this.nextLocalDecisionAt = 0;
    this.nextChatGPTDecisionAt = 0;
    this.nextBurstAt = 0;
    this.plan = {
      tactic: 'hunt_leader',
      targetId: null,
      aggression: 0.8,
      source: 'local',
    };
    this.controller?.abort();
    this.controller = null;
    this.requestInFlight = false;
  }

  destroy(): void {
    this.controller?.abort();
    this.controller = null;
  }

  markDefeated(): void {
    this.defeatedThisRound = true;
  }

  isBoss(userId: string | null | undefined): boolean {
    return userId === CHATGPT_BOSS_USER_ID;
  }

  /**
   * Returns true exactly on the tick where the boss is created.
   */
  tick(phase: RoundPhase, dt: number): boolean {
    if (!this.enabled || phase !== 'running' || this.defeatedThisRound) return false;

    let spawnedNow = false;
    let boss = this.physics.getBall(CHATGPT_BOSS_USER_ID);

    if (!boss && !this.spawnedThisRound && Date.now() - this.roundStartedAt >= 1800) {
      const opponents = this.getOpponents();
      if (opponents.length > 0) {
        boss = this.spawnBoss();
        this.spawnedThisRound = true;
        spawnedNow = true;
      }
    }

    if (!boss) return spawnedNow;

    const now = Date.now();
    const opponents = this.getOpponents();
    if (!opponents.length) {
      this.steerToCenter(boss, dt, 0.45);
      return spawnedNow;
    }

    if (now >= this.nextLocalDecisionAt) {
      this.nextLocalDecisionAt = now + LOCAL_DECISION_MS;
      this.refreshLocalPlan(boss, opponents);
    }

    if (now >= this.nextChatGPTDecisionAt) {
      this.nextChatGPTDecisionAt = now + CHATGPT_DECISION_MS;
      void this.requestChatGPTPlan(boss, opponents);
    }

    this.applyPlan(boss, opponents, dt, now);
    return spawnedNow;
  }

  private spawnBoss(): BallBody {
    const boss = this.physics.spawnOrNudge(
      {
        userId: CHATGPT_BOSS_USER_ID,
        username: CHATGPT_BOSS_USERNAME,
        nickname: CHATGPT_BOSS_NAME,
      },
      BOSS_RADIUS,
      false
    );

    boss.x = 540;
    boss.y = 960;
    boss.baseRadius = BOSS_RADIUS;
    boss.radius = BOSS_RADIUS;
    boss.baseMass = BOSS_RADIUS * BOSS_RADIUS * BOSS_MASS_MULT;
    boss.mass = boss.baseMass;
    boss.baseStrength = BOSS_BASE_STRENGTH;
    boss.strength = BOSS_BASE_STRENGTH;
    boss.hp = BOSS_HP;
    boss.maxHp = BOSS_HP;
    boss.color = 0x10a37f;
    boss.spawnProtectedUntil = Date.now() + 900;
    boss.kills = 0;
    boss.hitPower = 0;

    const angle = Math.random() * Math.PI * 2;
    boss.vx = Math.cos(angle) * BOSS_MIN_CRUISE;
    boss.vy = Math.sin(angle) * BOSS_MIN_CRUISE;
    return boss;
  }

  private getOpponents(): BallBody[] {
    const all = this.physics
      .getAll()
      .filter((b) => b.userId !== CHATGPT_BOSS_USER_ID);

    const humans = all.filter((b) => !isBotUser(b));
    return humans.length ? humans : all;
  }

  private refreshLocalPlan(boss: BallBody, opponents: BallBody[]): void {
    if (this.plan.source === 'chatgpt' && Date.now() < this.nextChatGPTDecisionAt - 1500) {
      return;
    }

    const hpRatio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 1;
    const leader = [...opponents].sort(
      (a, b) => b.kills * 100 + b.hitPower - (a.kills * 100 + a.hitPower)
    )[0];
    const weak = [...opponents].sort((a, b) => a.hp - b.hp)[0];
    const nearest = [...opponents].sort(
      (a, b) =>
        Math.hypot(a.x - boss.x, a.y - boss.y) -
        Math.hypot(b.x - boss.x, b.y - boss.y)
    )[0];

    let tactic: BossTactic = 'intercept';
    let targetId: string | null = nearest?.userId ?? null;
    let aggression = 0.78;

    if (hpRatio < 0.24) {
      tactic = 'retreat';
      targetId = nearest?.userId ?? null;
      aggression = 0.38;
    } else if (leader && leader.kills >= 3) {
      tactic = 'hunt_leader';
      targetId = leader.userId;
      aggression = 0.9;
    } else if (weak && weak.hp / Math.max(1, weak.maxHp) < 0.35) {
      tactic = 'hunt_weak';
      targetId = weak.userId;
      aggression = 0.96;
    } else if (Math.random() < 0.16) {
      tactic = 'center_control';
      targetId = leader?.userId ?? nearest?.userId ?? null;
      aggression = 0.58;
    }

    this.plan = { tactic, targetId, aggression, source: 'local' };
  }

  private applyPlan(
    boss: BallBody,
    opponents: BallBody[],
    dt: number,
    now: number
  ): void {
    let target = opponents.find((b) => b.userId === this.plan.targetId) ?? null;

    if (!target) {
      if (this.plan.tactic === 'hunt_weak') {
        target = [...opponents].sort((a, b) => a.hp - b.hp)[0] ?? null;
      } else if (this.plan.tactic === 'hunt_leader') {
        target =
          [...opponents].sort(
            (a, b) => b.kills * 100 + b.hitPower - (a.kills * 100 + a.hitPower)
          )[0] ?? null;
      } else {
        target =
          [...opponents].sort(
            (a, b) =>
              Math.hypot(a.x - boss.x, a.y - boss.y) -
              Math.hypot(b.x - boss.x, b.y - boss.y)
          )[0] ?? null;
      }
    }

    if (!target || this.plan.tactic === 'center_control') {
      this.steerToCenter(boss, dt, this.plan.aggression);
      return;
    }

    let aimX = target.x;
    let aimY = target.y;
    const targetSpeed = speedOf(target);

    if (this.plan.tactic === 'intercept' || this.plan.tactic === 'hunt_leader') {
      const lead = clamp(0.18 + targetSpeed / 1600, 0.18, 0.55);
      aimX += target.vx * lead;
      aimY += target.vy * lead;
    }

    let dir = normalize(aimX - boss.x, aimY - boss.y);

    if (this.plan.tactic === 'retreat') {
      dir = normalize(boss.x - target.x, boss.y - target.y);
      const center = normalize(540 - boss.x, 960 - boss.y);
      dir = normalize(dir.x * 0.72 + center.x * 0.28, dir.y * 0.72 + center.y * 0.28);
    }

    // Avoid scraping walls. This changes steering only, never server collision rules.
    const wall = this.wallAvoidance(boss);
    dir = normalize(dir.x + wall.x * 1.4, dir.y + wall.y * 1.4);

    const accel = BOSS_ACCEL * clamp(this.plan.aggression, 0.25, 1);
    boss.vx += dir.x * accel * dt;
    boss.vy += dir.y * accel * dt;

    const dist = Math.hypot(target.x - boss.x, target.y - boss.y);
    if (
      this.plan.tactic !== 'retreat' &&
      dist < 360 &&
      now >= this.nextBurstAt
    ) {
      this.nextBurstAt = now + 2200 + Math.floor(Math.random() * 1600);
      boss.vx += dir.x * 180;
      boss.vy += dir.y * 180;
    }

    this.limitBossSpeed(boss);
  }

  private steerToCenter(boss: BallBody, dt: number, aggression: number): void {
    const center = normalize(540 - boss.x, 960 - boss.y);
    const tangent = { x: -center.y, y: center.x };
    const t = Date.now() / 1000;
    const orbit = Math.sin(t * 0.9) * 0.38;
    const dir = normalize(
      center.x * 0.75 + tangent.x * orbit,
      center.y * 0.75 + tangent.y * orbit
    );
    boss.vx += dir.x * BOSS_ACCEL * aggression * dt;
    boss.vy += dir.y * BOSS_ACCEL * aggression * dt;
    this.limitBossSpeed(boss);
  }

  private wallAvoidance(boss: BallBody): { x: number; y: number } {
    const pad = 170;
    let x = 0;
    let y = 0;
    if (boss.x < pad) x += (pad - boss.x) / pad;
    if (boss.x > 1080 - pad) x -= (boss.x - (1080 - pad)) / pad;
    if (boss.y < pad) y += (pad - boss.y) / pad;
    if (boss.y > 1920 - pad) y -= (boss.y - (1920 - pad)) / pad;
    return { x, y };
  }

  private limitBossSpeed(boss: BallBody): void {
    const speed = speedOf(boss);
    if (speed > BOSS_MAX_SPEED && speed > 0) {
      const k = BOSS_MAX_SPEED / speed;
      boss.vx *= k;
      boss.vy *= k;
    } else if (speed < BOSS_MIN_CRUISE && speed > 5) {
      const k = BOSS_MIN_CRUISE / speed;
      boss.vx *= k;
      boss.vy *= k;
    }
  }

  private async requestChatGPTPlan(
    boss: BallBody,
    opponents: BallBody[]
  ): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || this.requestInFlight || !envBool('CHATGPT_BOSS_OPENAI_ENABLED', true)) {
      return;
    }

    this.requestInFlight = true;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 2800);

    try {
      const candidates = opponents.slice(0, 8).map((b) => ({
        id: b.userId,
        hp: Math.round(b.hp),
        maxHp: Math.round(b.maxHp),
        kills: b.kills,
        hitPower: b.hitPower,
        x: Math.round(b.x),
        y: Math.round(b.y),
        speed: Math.round(speedOf(b)),
      }));

      const prompt = [
        'You control a boss in a 2D collision arena. Pick a tactical plan only.',
        'Return ONLY compact JSON with tactic, targetId, aggression, reason.',
        'Allowed tactics: hunt_leader, hunt_weak, intercept, center_control, retreat.',
        'aggression must be 0.25 to 1. targetId must be one of the candidate ids or null.',
        'Prefer varied, challenging play. Retreat only when boss HP is low.',
        'Boss state: ' + JSON.stringify({
          hp: Math.round(boss.hp),
          maxHp: Math.round(boss.maxHp),
          x: Math.round(boss.x),
          y: Math.round(boss.y),
          speed: Math.round(speedOf(boss)),
        }),
        'Candidates: ' + JSON.stringify(candidates),
      ].join('\n');

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.CHATGPT_BOSS_MODEL || 'gpt-5.6-luna',
          input: prompt,
          max_output_tokens: 120,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('OpenAI response ' + response.status);
      }

      const data = (await response.json()) as ChatGPTResponse;
      const raw =
        data.output
          ?.flatMap((item) => item.content || [])
          .find((item) => item.type === 'output_text' && typeof item.text === 'string')
          ?.text || '';

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return;
      const parsed = JSON.parse(match[0]) as Partial<BossPlan>;
      const allowed: BossTactic[] = [
        'hunt_leader',
        'hunt_weak',
        'intercept',
        'center_control',
        'retreat',
      ];

      if (!parsed.tactic || !allowed.includes(parsed.tactic as BossTactic)) return;
      const targetId =
        typeof parsed.targetId === 'string' &&
        candidates.some((c) => c.id === parsed.targetId)
          ? parsed.targetId
          : null;

      this.plan = {
        tactic: parsed.tactic as BossTactic,
        targetId,
        aggression: clamp(Number(parsed.aggression ?? 0.75), 0.25, 1),
        source: 'chatgpt',
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : undefined,
      };
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('[ChatGPTBoss] planner fallback:', err instanceof Error ? err.message : err);
      }
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.controller = null;
      this.requestInFlight = false;
    }
  }
}
