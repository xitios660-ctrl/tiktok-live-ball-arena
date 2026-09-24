/**
 * Lightweight Web Audio synth SFX + procedural arena ambient.
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

/** Soft ceiling so ambient never drowns TikTok LIVE mic when screen-sharing. */
const AMBIENT_BASE = 0.045;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volumes: Record<VolKey, number> = { master: 0.7, sfx: 0.85, music: 0.55 };
  private lastPlay = new Map<string, number>();
  private quality = 1; // 1 = full, 0.3 = reduced (fewer beeps)

  // --- Ambient bed (procedural, looping) ---
  private ambientWanted = false;
  private ambientIntensity = 1;
  private ambientNodes: {
    master: GainNode;
    drone: OscillatorNode;
    drone2: OscillatorNode;
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    shimmerTimer: number | null;
  } | null = null;

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** Call from first touch/click — required for mobile autoplay policy. */
  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    // Start arena atmosphere as soon as audio is allowed.
    this.startAmbient();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyAmbientMute();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyAmbientMute();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(key: VolKey, v: number): void {
    this.volumes[key] = Math.max(0, Math.min(1, v));
    if (key === 'master' || key === 'music') this.applyAmbientGain(0.05);
  }

  /** 0..1 adaptive quality — lower skips low-priority SFX */
  setQuality(q: number): void {
    this.quality = Math.max(0.2, Math.min(1, q));
  }

  // ---------------------------------------------------------------------------
  // Ambient atmosphere
  // ---------------------------------------------------------------------------

  /** Soft dark pad + noise bed + occasional shimmer. Modest volume for LIVE overlays. */
  startAmbient(intensity = 1): void {
    this.ambientWanted = true;
    this.ambientIntensity = Math.max(0, Math.min(1, intensity));
    this.ensure();
    if (!this.ctx || this.muted) return;
    if (this.ambientNodes) {
      this.applyAmbientGain(0.05);
      return;
    }
    this.spawnAmbient();
  }

  stopAmbient(fadeSec = 0.6): void {
    this.ambientWanted = false;
    const nodes = this.ambientNodes;
    if (!nodes || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    try {
      nodes.master.gain.cancelScheduledValues(t0);
      nodes.master.gain.setValueAtTime(Math.max(0.0001, nodes.master.gain.value), t0);
      nodes.master.gain.exponentialRampToValueAtTime(0.0001, t0 + fadeSec);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => this.teardownAmbient(), fadeSec * 1000 + 40);
  }

  setAmbientIntensity(v: number): void {
    this.ambientIntensity = Math.max(0, Math.min(1, v));
    this.applyAmbientGain(0.15);
  }

  private ambientTargetGain(): number {
    if (this.muted || !this.ambientWanted) return 0;
    return (
      this.volumes.master *
      this.volumes.music *
      AMBIENT_BASE *
      this.ambientIntensity
    );
  }

  private applyAmbientMute(): void {
    if (this.muted) {
      this.applyAmbientGain(0.12);
      return;
    }
    if (this.ambientWanted) {
      if (!this.ambientNodes) this.spawnAmbient();
      else this.applyAmbientGain(0.25);
    }
  }

  private applyAmbientGain(rampSec: number): void {
    if (!this.ambientNodes || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const target = Math.max(0.0001, this.ambientTargetGain());
    try {
      this.ambientNodes.master.gain.cancelScheduledValues(t0);
      this.ambientNodes.master.gain.setValueAtTime(
        Math.max(0.0001, this.ambientNodes.master.gain.value),
        t0
      );
      if (this.muted || !this.ambientWanted) {
        this.ambientNodes.master.gain.exponentialRampToValueAtTime(0.0001, t0 + rampSec);
      } else {
        this.ambientNodes.master.gain.exponentialRampToValueAtTime(target, t0 + rampSec);
      }
    } catch {
      /* ignore */
    }
  }

  private spawnAmbient(): void {
    if (!this.ctx || this.ambientNodes) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // Low dark drone (two detuned sines)
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.55;
    drone.connect(droneGain);
    droneGain.connect(master);

    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.4; // ~E2, slight interval
    const drone2Gain = ctx.createGain();
    drone2Gain.gain.value = 0.28;
    drone2.connect(drone2Gain);
    drone2Gain.connect(master);

    // Filtered noise bed
    const noiseBuf = this.makeNoiseBuffer(ctx, 2);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.22;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    const t0 = ctx.currentTime;
    drone.start(t0);
    drone2.start(t0);
    noise.start(t0);

    this.ambientNodes = {
      master,
      drone,
      drone2,
      noise,
      noiseFilter,
      shimmerTimer: null,
    };

    // Fade in ~1.4s
    const target = Math.max(0.0001, this.ambientTargetGain());
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(target, t0 + 1.4);

    this.scheduleShimmer();
  }

  private scheduleShimmer(): void {
    if (!this.ambientNodes || !this.ctx || !this.ambientWanted) return;
    // Quiet high sine blip every 4–9s
    const delay = 4000 + Math.random() * 5000;
    this.ambientNodes.shimmerTimer = window.setTimeout(() => {
      this.playShimmer();
      this.scheduleShimmer();
    }, delay);
  }

  private playShimmer(): void {
    if (this.muted || !this.ctx || !this.ambientNodes || this.quality < 0.4) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400 + Math.random() * 1200;
    f.Q.value = 4;
    osc.type = 'sine';
    osc.frequency.value = 1800 + Math.random() * 900;
    const vol =
      this.volumes.master * this.volumes.music * AMBIENT_BASE * this.ambientIntensity * 0.35;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(f);
    f.connect(g);
    g.connect(this.ambientNodes.master);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }

  private teardownAmbient(): void {
    const nodes = this.ambientNodes;
    if (!nodes) return;
    if (nodes.shimmerTimer != null) {
      clearTimeout(nodes.shimmerTimer);
      nodes.shimmerTimer = null;
    }
    try {
      nodes.drone.stop();
      nodes.drone2.stop();
      nodes.noise.stop();
    } catch {
      /* already stopped */
    }
    try {
      nodes.drone.disconnect();
      nodes.drone2.disconnect();
      nodes.noise.disconnect();
      nodes.noiseFilter.disconnect();
      nodes.master.disconnect();
    } catch {
      /* ignore */
    }
    this.ambientNodes = null;
    // If still wanted (e.g. unmute race), respawn
    if (this.ambientWanted && !this.muted) this.spawnAmbient();
  }

  private makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------------------------------------------------------------------------
  // One-shot SFX
  // ---------------------------------------------------------------------------

  play(kind: SfxKind, opts?: { intensity?: number }): void {
    if (this.muted) return;
    // throttle collisions when quality low; at max quality keep full richness
    if (kind === 'collision' && this.quality < 0.85 && Math.random() > this.quality + 0.15) return;

    const now = performance.now();
    // Slightly tighter min-gap at high quality so layered impacts still feel dense
    const minGap =
      kind === 'collision' ? (this.quality >= 0.85 ? 28 : 45) : 80;
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
    const inten = Math.max(0.05, Math.min(1, intensity));
    const vol = this.volumes.master * this.volumes.sfx * inten * 0.15;

    switch (kind) {
      case 'collision':
        this.playImpact(t0, inten, vol);
        break;
      case 'death':
        this.playDeathBoom(t0, inten, vol);
        break;
      case 'respawn':
        this.playSimpleTone(t0, 'sine', 400, 800, vol, 0.25);
        break;
      case 'revenge':
        this.playSimpleTone(t0, 'square', 520, 520, vol, 0.2);
        break;
      case 'gift':
      case 'share':
      case 'heal_rain':
        this.playGiftChime(t0, vol);
        break;
      case 'speed_storm':
        this.playSimpleTone(t0, 'triangle', 300, 900, vol, 0.3);
        break;
      case 'victory':
        this.playVictory(t0, vol);
        break;
      case 'countdown':
        this.playSimpleTone(t0, 'square', 880, 880, vol * 1.1, 0.12);
        break;
      default:
        this.playSimpleTone(t0, 'sine', 440, 440, vol, 0.1);
    }
  }

  /** Multi-layer ball hit: noise burst + body thud + bright tick. */
  private playImpact(t0: number, inten: number, vol: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const rich = this.quality >= 0.7;

    // Layer 1 — filtered noise burst (contact grit)
    {
      const buf = this.makeNoiseBuffer(ctx, 0.08);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900 + inten * 1400;
      filter.Q.value = 1.2;
      const g = ctx.createGain();
      const nv = vol * (rich ? 1.6 : 1.1);
      g.gain.setValueAtTime(nv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055 + inten * 0.03);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.09);
    }

    // Layer 2 — low body thud (sine drop)
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + inten * 80, t0);
      osc.frequency.exponentialRampToValueAtTime(55 + inten * 20, t0 + 0.09);
      const tv = vol * (rich ? 2.2 : 1.6);
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12 + inten * 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }

    // Layer 3 — bright tick (optional at high quality)
    if (rich) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 1200 + inten * 900;
      const tv = vol * 0.55;
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.04);
    }
  }

  /** Deeper boom for eliminations. */
  private playDeathBoom(t0: number, inten: number, vol: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Sub boom
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, t0);
      osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.45);
      const tv = vol * 2.4;
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.52);
    }

    // Mid growl
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const tv = vol * 1.1;
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    }

    // Noise smash
    {
      const buf = this.makeNoiseBuffer(ctx, 0.2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, t0);
      filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.25);
      const g = ctx.createGain();
      const tv = vol * 1.4 * (0.7 + inten * 0.3);
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.3);
    }
  }

  private playSimpleTone(
    t0: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    vol: number,
    dur: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    if (f0 === f1) {
      osc.frequency.value = f0;
    } else {
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur * 0.85);
    }
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private playGiftChime(t0: number, vol: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t0);
    osc.frequency.setValueAtTime(880, t0 + 0.08);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }

  private playVictory(t0: number, vol: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, t0);
    osc.frequency.setValueAtTime(659, t0 + 0.15);
    osc.frequency.setValueAtTime(784, t0 + 0.3);
    g.gain.setValueAtTime(vol * 1.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.56);
  }
}

export const audio = new AudioManager();
