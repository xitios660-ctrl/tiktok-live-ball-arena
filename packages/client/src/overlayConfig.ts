/** OBS / overlay URL query helpers (client-only, no server coupling).
 *
 * Recommended phone screen-share URL (opaque, not transparent):
 *   /overlay?phone=1
 * Also accepts ?lite=1. Keeps gameplay readable while cutting GPU load.
 * Do not combine with ?transparent=1 for phone screen-share into TikTok Live.
 *
 * Orientation / fill:
 *   default           — Phaser FIT letterbox (portrait 1080×1920 stays readable in landscape)
 *   ?spin=1|?rotate=1 — CSS rotate(90°) when landscape so the portrait canvas fills the phone
 *   ?fill=landscape   — same as spin/rotate
 */

export type QualityMode = 'max' | 'auto' | 'phone';

export interface OverlayOptions {
  /** Clear canvas + CSS so OBS Browser Source composites over the live. */
  transparent: boolean;
  /** Show FPS + optional safe-area guides. */
  debug: boolean;
  /** Tiny DEMO badge when ?demo=1 is present. */
  demoBadge: boolean;
  /**
   * Visual quality mode.
   * - 'max' (default): stay high unless FPS is catastrophic (<18 / <12).
   * - 'auto': older adaptive curve (degrade below 40 / 28 fps). Pass ?quality=auto.
   * - 'phone': mobile screen-share budget (forced by ?phone=1 or ?lite=1).
   */
  qualityMode: QualityMode;
  /**
   * Phone / lite overlay preset — fewer particles, earlier FPS degrade,
   * softer ambient. From ?phone=1 or ?lite=1.
   */
  phoneLite: boolean;
  /**
   * Start muted (OBS silent capture). From ?mute=1.
   * Default = sound on after unlock gesture.
   */
  startMuted: boolean;
  /**
   * Rotate portrait canvas 90° to fill a landscape phone viewport
   * (CSS transform wrapper). From ?spin=1, ?rotate=1, or ?fill=landscape.
   * Default / omitted = Phaser FIT letterbox (no CSS rotate).
   */
  spinFill: boolean;
}

/** TikTok Live chrome insets — keep HUD out of username/status and comments/gift bar. */
export const SAFE = {
  top: 140,
  bottom: 320,
  side: 36,
} as const;

export function readOverlayOptions(): OverlayOptions {
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const bg = (params.get('bg') || '').toLowerCase();
  const transparent =
    params.get('transparent') === '1' || bg === 'transparent' || bg === 'none';
  const debug = params.get('debug') === '1';
  const demoBadge = params.get('demo') === '1';
  const phoneLite = params.get('phone') === '1' || params.get('lite') === '1';
  const startMuted = params.get('mute') === '1';
  const fill = (params.get('fill') || '').toLowerCase();
  const spinFill =
    params.get('spin') === '1' ||
    params.get('rotate') === '1' ||
    fill === 'landscape';
  const q = (params.get('quality') || 'max').toLowerCase();
  let qualityMode: QualityMode = q === 'auto' ? 'auto' : q === 'phone' ? 'phone' : 'max';
  // Phone screen-share always uses the dedicated budget curve.
  if (phoneLite) qualityMode = 'phone';
  return { transparent, debug, demoBadge, qualityMode, phoneLite, startMuted, spinFill };
}

/** Apply transparent / spin CSS classes to html/body/#game-container. */
export function applyOverlayDom(opts: OverlayOptions): void {
  if (opts.transparent) {
    document.documentElement.classList.add('obs-transparent');
    document.body.classList.add('obs-transparent');
    document.getElementById('game-container')?.classList.add('obs-transparent');
  }
  if (opts.spinFill) {
    document.documentElement.classList.add('spin-fill');
  }
}

let cached: OverlayOptions | null = null;

export function getOverlayOptions(): OverlayOptions {
  if (!cached) cached = readOverlayOptions();
  return cached;
}
