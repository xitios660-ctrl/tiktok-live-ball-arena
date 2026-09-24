/** OBS / overlay URL query helpers (client-only, no server coupling). */

export interface OverlayOptions {
  /** Clear canvas + CSS so OBS Browser Source composites over the live. */
  transparent: boolean;
  /** Show FPS + optional safe-area guides. */
  debug: boolean;
  /** Tiny DEMO badge when ?demo=1 is present. */
  demoBadge: boolean;
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
  return { transparent, debug, demoBadge };
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
