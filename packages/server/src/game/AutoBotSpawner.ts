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
  private readonly batchSize: number;

  constructor(private readonly deps: AutoBotDeps) {
    this.enabled = envBool('AUTO_BOT_ENABLED', true);
    this.intervalMs = envInt('AUTO_BOT_INTERVAL_MS', 30_000);
    this.maxPlayers = envInt('AUTO_BOT_MAX_PLAYERS', 40);
    this.batchSize = envInt('AUTO_BOT_BATCH_SIZE', 3);
  }

  start(): void {
    if (!this.enabled) {
      console.log('[AutoBot] disabled (AUTO_BOT_ENABLED=false)');
      return;
    }
    this.stop();
    console.log(
      `[AutoBot] enabled — ${this.batchSize} bots every ${Math.round(this.intervalMs / 1000)}s, soft cap ${this.maxPlayers}`
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
    this.timer = setTimeout(() => {
      this.trySpawnBatch();
      this.scheduleNext();
    }, this.intervalMs);
  }

  /**
   * Test hook used by the production self-test so we can verify the exact
   * batch size without waiting 30 seconds.
   */
  runNowForTest(): number {
    return this.trySpawnBatch();
  }

  private trySpawnBatch(): number {
    if (!this.deps.canAcceptJoin()) return 0;

    let spawned = 0;
    for (let i = 0; i < this.batchSize; i += 1) {
      const count = this.deps.getPlayerCount();
      if (count >= this.maxPlayers) break;

      this.seq += 1;
      const now = Date.now();
      const username = `bot_auto_${this.seq}`;
      const nickname = `Bot Auto ${this.seq}`;
      const userId = `autobot-${now}-${this.seq}`;

      this.deps.injectJoin({ userId, username, nickname });
      spawned += 1;
      const after = this.deps.getPlayerCount();
      console.log(`[AutoBot] spawned @${username} (players=${after})`);
    }

    console.log(
      `[AutoBot] batch complete: +${spawned}/${this.batchSize} bots`
    );
    return spawned;
  }
}
