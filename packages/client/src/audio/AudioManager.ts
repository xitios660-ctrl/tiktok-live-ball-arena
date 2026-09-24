/**
 * Lightweight Web Audio beeps + optional HTMLAudio file hooks.
 * Missing assets = silent (no crash). Mute toggle + volumes.
 *
 * To use real files later, place under /overlay/assets/sfx/ and set USE_FILES=true.
 */

export type SfxKind =
  | 'collision'
  | 'death'
  | 'respawn'
  | 'revenge'
  | 'gift'
  | 'victory'
  | 'countdown'
  | 'heal_rain'
  | 'speed_storm'
  | 'share';

type VolKey = 'master' | 'sfx' | 'music';

const FILE_MAP: Partial<Record<SfxKind, string>> = {
  // Optional — leave empty = synth only
  // collision: '/assets/sfx/hit.mp3',
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volumes: Record<VolKey, number> = { master: 0.7, sfx: 0.8, music: 0.5 };
  private lastPlay = new Map<string, number>();
  private quality = 1; // 1 = full, 0.3 = reduced (fewer beeps)

  ensure(): void {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(key: VolKey, v: number): void {
    this.volumes[key] = Math.max(0, Math.min(1, v));
  }

  /** 0..1 adaptive quality — lower skips low-priority SFX */
  setQuality(q: number): void {
    this.quality = Math.max(0.2, Math.min(1, q));
  }

  play(kind: SfxKind, opts?: { intensity?: number }): void {
    if (this.muted) return;
    // throttle collisions when quality low
    if (kind === 'collision' && this.quality < 0.6 && Math.random() > this.quality) return;

    const now = performance.now();
    const minGap = kind === 'collision' ? 40 : 80;
    const last = this.lastPlay.get(kind) || 0;
    if (now - last < minGap) return;
    this.lastPlay.set(kind, now);

    const file = FILE_MAP[kind];
    if (file) {
      try {
        const a = new Audio(file);
        a.volume = this.volumes.master * this.volumes.sfx * (opts?.intensity ?? 1);
        void a.play().catch(() => this.beep(kind, opts?.intensity ?? 0.5));
        return;
      } catch {
        /* fall through to beep */
      }
    }
    this.beep(kind, opts?.intensity ?? 0.5);
  }

  private beep(kind: SfxKind, intensity: number): void {
    this.ensure();
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const vol = this.volumes.master * this.volumes.sfx * Math.max(0.05, Math.min(1, intensity)) * 0.15;

    switch (kind) {
      case 'collision':
        osc.type = 'triangle';
        osc.frequency.value = 180 + intensity * 400;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
        osc.start(t0);
        osc.stop(t0 + 0.09);
        break;
      case 'death':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t0);
        osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.35);
        gain.gain.setValueAtTime(vol * 1.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
        osc.start(t0);
        osc.stop(t0 + 0.42);
        break;
      case 'respawn':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t0);
        osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.2);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
        osc.start(t0);
        osc.stop(t0 + 0.26);
        break;
      case 'revenge':
        osc.type = 'square';
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
        osc.start(t0);
        osc.stop(t0 + 0.22);
        break;
      case 'gift':
      case 'share':
      case 'heal_rain':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t0);
        osc.frequency.setValueAtTime(880, t0 + 0.08);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
        osc.start(t0);
        osc.stop(t0 + 0.32);
        break;
      case 'speed_storm':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t0);
        osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.25);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
        osc.start(t0);
        osc.stop(t0 + 0.32);
        break;
      case 'victory':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t0);
        osc.frequency.setValueAtTime(659, t0 + 0.15);
        osc.frequency.setValueAtTime(784, t0 + 0.3);
        gain.gain.setValueAtTime(vol * 1.3, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        osc.start(t0);
        osc.stop(t0 + 0.56);
        break;
      case 'countdown':
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(vol * 1.1, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        osc.start(t0);
        osc.stop(t0 + 0.13);
        break;
      default:
        osc.type = 'sine';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
        osc.start(t0);
        osc.stop(t0 + 0.11);
    }
  }
}

export const audio = new AudioManager();
