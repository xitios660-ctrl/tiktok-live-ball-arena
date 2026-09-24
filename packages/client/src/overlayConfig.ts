/** OBS / overlay URL query helpers (client-only, no server coupling).
 *
 * Recommended phone screen-share URL (opaque, not transparent):
 *   /overlay?phone=1
 * Also accepts ?lite=1. Keeps gameplay readable while cutting GPU load.
 * Do not combine with ?transparent=1 for phone screen-share into TikTok Live.
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
  const q = (params.get('quality') || 'max').toLowerCase();
  let qualityMode: QualityMode = q === 'auto' ? 'auto' : q === 'phone' ? 'phone' : 'max';
  // Phone screen-share always uses the dedicated budget curve.
  if (phoneLite) qualityMode = 'phone';
  return { transparent, debug, demoBadge, qualityMode, phoneLite };
}

/** Apply transparent CSS class to html/body/#game-container. */
export function applyOverlayDom(opts: OverlayOptions): void {
  if (!opts.transparent) return;
  document.documentElement.classList.add('obs-transparent');
  document.body.classList.add('obs-transparent');
  document.getElementById('game-container')?.classList.add('obs-transparent');
}

let cached: OverlayOptions | null = null;

export function getOverlayOptions(): OverlayOptions {
  if (!cached) cached = readOverlayOptions();
  return cached;
}
