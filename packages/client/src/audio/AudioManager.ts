/**
 * Arena audio: looping BGM file + punchy procedural SFX.
 * Soft procedural drone optional under music (dropped on phoneLite).
 * Mute toggles BGM + SFX together. Missing assets = silent (no crash).
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

/** Soft drone under BGM — not the main "música de fundo". */
const AMBIENT_BASE = 0.035;
/** HTMLAudioElement target scale (master * music * this ≈ 0.35–0.5). */
const BGM_BASE = 0.55;
/** One-shot beep master scale — hits must be unmistakable on phone speakers. */
const BEEP_SCALE = 0.62;

const BGM_CANDIDATES = ['/assets/sfx/arena-bgm.ogg', '/assets/sfx/arena-bgm.mp3'];

const FILE_MAP: Partial<Record<SfxKind, string>> = {
  // Optional file overrides — leave empty = synth only
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volumes: Record<VolKey, number> = { master: 0.9, sfx: 1.0, music: 0.85 };
  private lastPlay = new Map<string, number>();
  private quality = 1; // 1 = full, 0.3 = reduced (fewer beeps)

  // --- BGM (HTMLAudioElement loop) ---
  private bgmWanted = false;
  private bgmEl: HTMLAudioElement | null = null;
  private bgmPlaying = false;
  private bgmFadeTimer: number | null = null;
  private bgmRetryBound = false;

  // --- Soft ambient bed (procedural) ---
  private ambientWanted = false;
  private ambientIntensity = 1;
  /** Mild BGM trim on phone screen-share (?phone=1). Mute still wins. */
  private phoneLite = false;
  private ambientNodes: {
    master: GainNode;
    drone: OscillatorNode;
    drone2: OscillatorNode;
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    shimmerTimer: number | null;
  } | null = null;

  constructor() {
    this.exposeDebug();
  }

  private exposeDebug(): void {
    try {
      Object.defineProperty(window, '__arenaAudio', {
        configurable: true,
        get: () => ({
          ctxState: this.ctx?.state ?? 'none',
          muted: this.muted,
          bgmPlaying: this.bgmPlaying && !!this.bgmEl && !this.bgmEl.paused,
          bgmVol: this.bgmEl?.volume ?? 0,
        }),
      });
    } catch {
      /* ignore non-browser */
    }
  }

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

  /** Resume AudioContext if suspended (call on unlock and every play/hit). */
  private resumeCtx(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /**
   * Call from first touch/click — required for mobile autoplay policy.
   * Starts BGM + confirm blip. Resolves true if BGM started (or muted path ok).
   */
  async unlock(): Promise<boolean> {
    this.ensure();
    this.resumeCtx();
    this.bgmWanted = true;

    // Soft drone under music (skip on phone to keep BGM clear)
    if (!this.phoneLite) this.startAmbient();

    this.playConfirmBlip();
    const ok = await this.startBgm(true);
    this.bindBgmRetry();
    return ok;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyAmbientMute();
    this.applyBgmMute();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyAmbientMute();
    this.applyBgmMute();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(key: VolKey, v: number): void {
    this.volumes[key] = Math.max(0, Math.min(1, v));
    if (key === 'master' || key === 'music') {
      this.applyAmbientGain(0.05);
      this.applyBgmVolume(true);
    }
  }

  /** 0..1 adaptive quality — lower skips low-priority SFX */
  setQuality(q: number): void {
    this.quality = Math.max(0.2, Math.min(1, q));
  }

  // ---------------------------------------------------------------------------
  // BGM
  // ---------------------------------------------------------------------------

  private pickBgmUrl(): string {
    try {
      const probe = document.createElement('audio');
      for (const url of BGM_CANDIDATES) {
        const ext = url.endsWith('.ogg') ? 'audio/ogg; codecs="vorbis"' : 'audio/mpeg';
        const can = probe.canPlayType(ext);
        if (can === 'probably' || can === 'maybe') return url;
      }
    } catch {
      /* fall through */
    }
    return BGM_CANDIDATES[1] || BGM_CANDIDATES[0];
  }

  private bgmTargetVolume(): number {
    if (this.muted || !this.bgmWanted) return 0;
    const phoneMul = this.phoneLite ? 0.85 : 1;
    return Math.max(0, Math.min(1, this.volumes.master * this.volumes.music * BGM_BASE * phoneMul));
  }

  private applyBgmVolume(instant = false): void {
    if (!this.bgmEl) return;
    const target = this.bgmTargetVolume();
    if (this.bgmFadeTimer != null) {
      clearInterval(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
    if (instant || target <= 0.0001) {
      this.bgmEl.volume = target;
      return;
    }
    // short ramp if already playing
    const el = this.bgmEl;
    const from = el.volume;
    const steps = 8;
    let i = 0;
    this.bgmFadeTimer = window.setInterval(() => {
      i++;
      el.volume = from + (target - from) * (i / steps);
      if (i >= steps) {
        if (this.bgmFadeTimer != null) clearInterval(this.bgmFadeTimer);
        this.bgmFadeTimer = null;
        el.volume = target;
      }
    }, 40);
  }

  private applyBgmMute(): void {
    if (this.muted) {
      if (this.bgmEl) {
        this.bgmEl.pause();
        this.bgmEl.volume = 0;
        this.bgmPlaying = false;
      }
      return;
    }
    if (this.bgmWanted) {
      void this.startBgm(true);
    }
  }

  /**
   * Start / restart looping BGM. Fade in ~0.8s.
   * Returns false if .play() rejected (autoplay / missing file).
   */
  async startBgm(fadeIn = true): Promise<boolean> {
    this.bgmWanted = true;
    if (this.muted) return true;
    this.ensure();
    this.resumeCtx();

    if (!this.bgmEl) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      el.src = this.pickBgmUrl();
      el.volume = 0;
      this.bgmEl = el;
    }

    const el = this.bgmEl;
    if (!el.paused && this.bgmPlaying) {
      this.applyBgmVolume(false);
      return true;
    }

    const target = this.bgmTargetVolume();
    el.volume = fadeIn ? 0 : target;

    try {
      await el.play();
      this.bgmPlaying = true;
      if (fadeIn && target > 0) {
        if (this.bgmFadeTimer != null) clearInterval(this.bgmFadeTimer);
        const steps = 16; // ~0.8s at 50ms
        let i = 0;
        this.bgmFadeTimer = window.setInterval(() => {
          i++;
          const v = target * (i / steps);
          el.volume = Math.min(target, v);
          if (i >= steps) {
            if (this.bgmFadeTimer != null) clearInterval(this.bgmFadeTimer);
            this.bgmFadeTimer = null;
            el.volume = target;
          }
        }, 50);
      } else {
        el.volume = target;
      }
      return true;
    } catch {
      this.bgmPlaying = false;
      return false;
    }
  }

  stopBgm(fadeSec = 0.4): void {
    this.bgmWanted = false;
    const el = this.bgmEl;
    if (!el) return;
    if (this.bgmFadeTimer != null) {
      clearInterval(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
    const from = el.volume;
    const steps = Math.max(1, Math.round(fadeSec * 20));
    let i = 0;
    this.bgmFadeTimer = window.setInterval(() => {
      i++;
      el.volume = from * (1 - i / steps);
      if (i >= steps) {
        if (this.bgmFadeTimer != null) clearInterval(this.bgmFadeTimer);
        this.bgmFadeTimer = null;
        el.pause();
        el.volume = 0;
        this.bgmPlaying = false;
      }
    }, 50);
  }

  /** If BGM .play() was blocked, retry on next pointerdown. */
  private bindBgmRetry(): void {
    if (this.bgmRetryBound) return;
    this.bgmRetryBound = true;
    const retry = () => {
      if (this.muted || !this.bgmWanted) return;
      if (this.bgmPlaying && this.bgmEl && !this.bgmEl.paused) return;
      void this.startBgm(true);
    };
    window.addEventListener('pointerdown', retry, { passive: true });
    window.addEventListener('touchstart', retry, { passive: true });
  }

  /** Loud short confirmation so user knows audio works immediately. */
  private playConfirmBlip(): void {
    if (this.muted) return;
    this.ensure();
    this.resumeCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const vol = this.volumes.master * this.volumes.sfx * 0.55;
    // Two-note "ready" chirp
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.setValueAtTime(1320, t0 + 0.07);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  // ---------------------------------------------------------------------------
  // Ambient atmosphere (soft under BGM)
  // ---------------------------------------------------------------------------

  /** Soft dark pad under music. Skipped on phoneLite (BGM is primary). */
  startAmbient(intensity = 1): void {
    this.ambientWanted = true;
    this.ambientIntensity = Math.max(0, Math.min(1, intensity));
    if (this.phoneLite) return; // BGM only on phone
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

  /** Mild BGM reduction for phone screen-share; does not gut music. Mute still wins. */
  setPhoneLite(on: boolean): void {
    this.phoneLite = !!on;
    this.applyAmbientGain(0.08);
    this.applyBgmVolume(false);
    // Drop soft drone on phone so BGM stays clear
    if (this.phoneLite && this.ambientNodes) {
      this.stopAmbient(0.3);
    }
  }

  private ambientTargetGain(): number {
    if (this.muted || !this.ambientWanted || this.phoneLite) return 0;
    return (
      this.volumes.master * this.volumes.music * AMBIENT_BASE * this.ambientIntensity
    );
  }

  private applyAmbientMute(): void {
    if (this.muted) {
      this.applyAmbientGain(0.12);
      return;
    }
    if (this.ambientWanted && !this.phoneLite) {
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
      if (this.muted || !this.ambientWanted || this.phoneLite) {
        this.ambientNodes.master.gain.exponentialRampToValueAtTime(0.0001, t0 + rampSec);
      } else {
        this.ambientNodes.master.gain.exponentialRampToValueAtTime(target, t0 + rampSec);
      }
    } catch {
      /* ignore */
    }
  }

  private spawnAmbient(): void {
    if (!this.ctx || this.ambientNodes || this.phoneLite) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.55;
    drone.connect(droneGain);
    droneGain.connect(master);

    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 82.4;
    const drone2Gain = ctx.createGain();
    drone2Gain.gain.value = 0.28;
    drone2.connect(drone2Gain);
    drone2Gain.connect(master);

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

    const target = Math.max(0.0001, this.ambientTargetGain());
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(target, t0 + 1.2);

    this.scheduleShimmer();
  }

  private scheduleShimmer(): void {
    if (!this.ambientNodes || !this.ctx || !this.ambientWanted) return;
    const delay = 5000 + Math.random() * 6000;
    this.ambientNodes.shimmerTimer = window.setTimeout(() => {
      this.playShimmer();
      this.scheduleShimmer();
    }, delay);
  }

  private playShimmer(): void {
    if (this.muted || !this.ctx || !this.ambientNodes || this.quality < 0.4 || this.phoneLite)
      return;
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
    if (this.ambientWanted && !this.muted && !this.phoneLite) this.spawnAmbient();
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
    this.ensure();
    this.resumeCtx();

    if (kind === 'collision' && this.quality < 0.85 && Math.random() > this.quality + 0.15) return;

    const now = performance.now();
    const minGap = kind === 'collision' ? (this.quality >= 0.85 ? 28 : 45) : 80;
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
    this.resumeCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const t0 = ctx.currentTime;
    const inten = Math.max(0.05, Math.min(1, intensity));
    const vol = this.volumes.master * this.volumes.sfx * inten * BEEP_SCALE;

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

  /** Multi-layer ball hit: noise burst + body thud + bright tick — punchy on phone. */
  private playImpact(t0: number, inten: number, vol: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const rich = this.quality >= 0.7;

    // Layer 1 — filtered noise burst
    {
      const buf = this.makeNoiseBuffer(ctx, 0.08);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900 + inten * 1400;
      filter.Q.value = 1.2;
      const g = ctx.createGain();
      const nv = vol * (rich ? 1.85 : 1.35);
      g.gain.setValueAtTime(nv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055 + inten * 0.03);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.09);
    }

    // Layer 2 — low body thud
    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + inten * 80, t0);
      osc.frequency.exponentialRampToValueAtTime(55 + inten * 20, t0 + 0.09);
      const tv = vol * (rich ? 2.6 : 1.9);
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12 + inten * 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }

    // Layer 3 — bright tick
    if (rich) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 1200 + inten * 900;
      const tv = vol * 0.7;
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

    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, t0);
      osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.45);
      const tv = vol * 2.6;
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.52);
    }

    {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(50, t0 + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const tv = vol * 1.25;
      g.gain.setValueAtTime(tv, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    }

    {
      const buf = this.makeNoiseBuffer(ctx, 0.2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, t0);
      filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.25);
      const g = ctx.createGain();
      const tv = vol * 1.55 * (0.7 + inten * 0.3);
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
