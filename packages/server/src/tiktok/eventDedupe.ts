/**
 * Short-window fingerprint dedupe for gifts/shares (Webcast can redeliver).
 */
export class EventDedupe {
  private seen = new Map<string, number>();
  constructor(private readonly ttlMs = 60_000, private readonly maxSize = 5_000) {}

  /** @returns true if this fingerprint is NEW (should process) */
  check(fingerprint: string): boolean {
    const now = Date.now();
    this.gc(now);
    if (this.seen.has(fingerprint)) return false;
    this.seen.set(fingerprint, now);
    return true;
  }

  private gc(now: number): void {
    if (this.seen.size < this.maxSize) {
      // opportunistic
      if (this.seen.size > 0 && this.seen.size % 200 === 0) {
        for (const [k, t] of this.seen) {
          if (now - t > this.ttlMs) this.seen.delete(k);
        }
      }
      return;
    }
    for (const [k, t] of this.seen) {
      if (now - t > this.ttlMs) this.seen.delete(k);
    }
    if (this.seen.size >= this.maxSize) {
      // drop oldest ~20%
      const entries = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < Math.floor(entries.length * 0.2); i++) {
        this.seen.delete(entries[i][0]);
      }
    }
  }
}
