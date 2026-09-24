/**
 * Periodically injects fake join events so the arena stays lively
 * without admin clicks. Soft-capped; skips when joins are blocked.
 */
export interface AutoBotDeps {
  /** Current living balls / physics count */
  getPlayerCount: () => number;
  /** Mirror handleJoin phase rules: true when waiting or running */
  canAcceptJoin: () => boolean;
  /** Inject via GameLoop.handleLiveEvent({ type:'join', ... }) */
  injectJoin: (user: {
    userId: string;
    username: string;
    nickname: string;
  }) => void;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw == null || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
  return defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultValue;
}

export class AutoBotSpawner {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly maxPlayers: number;

  constructor(private readonly deps: AutoBotDeps) {
    this.enabled = envBool('AUTO_BOT_ENABLED', true);
    this.intervalMs = envInt('AUTO_BOT_INTERVAL_MS', 60_000);
    this.maxPlayers = envInt('AUTO_BOT_MAX_PLAYERS', 40);
  }

  start(): void {
    if (!this.enabled) {
      console.log('[AutoBot] disabled (AUTO_BOT_ENABLED=false)');
      return;
    }
    this.stop();
    console.log(
      `[AutoBot] enabled — ~${Math.round(this.intervalMs / 1000)}s (jitter 50–70%), soft cap ${this.maxPlayers}`
    );
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    const lo = Math.floor(this.intervalMs * (50 / 60));
    const hi = Math.floor(this.intervalMs * (70 / 60));
    const delay = lo + Math.floor(Math.random() * (hi - lo + 1));
    this.timer = setTimeout(() => {
      this.trySpawn();
      this.scheduleNext();
    }, delay);
  }

  private trySpawn(): void {
    if (!this.deps.canAcceptJoin()) return;
    const count = this.deps.getPlayerCount();
    if (count >= this.maxPlayers) return;

    this.seq += 1;
    const now = Date.now();
    const username = `bot_auto_${this.seq}`;
    const nickname = `Bot Auto ${this.seq}`;
    const userId = `autobot-${now}-${this.seq}`;

    this.deps.injectJoin({ userId, username, nickname });
    const after = this.deps.getPlayerCount();
    console.log(`[AutoBot] spawned @${username} (players=${after})`);
  }
}
