import type { OverlayOptions } from './overlayConfig';

export const LANDSCAPE_HEIGHT = 1080;
export const SOURCE_WIDTH = 1080;
export const SOURCE_HEIGHT = 1920;

export interface LandscapeMapper {
  scale: number;
  offsetX: number;
  offsetY: number;
  playWidth: number;
  playHeight: number;
  map: (x: number, y: number) => { x: number; y: number };
}

export function viewportSize(): { width: number; height: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
  const width = Math.max(1, vv?.width ?? window.innerWidth);
  const height = Math.max(1, vv?.height ?? window.innerHeight);
  return { width, height };
}

export function shouldUsePhoneLandscape(opts: OverlayOptions): boolean {
  if (!opts.phoneLite || !opts.spinFill) return false;
  const { width, height } = viewportSize();
  return width > height;
}

export function landscapeGameWidth(): number {
  const { width, height } = viewportSize();
  const aspect = Math.max(1.2, Math.min(3.4, width / Math.max(1, height)));
  return Math.max(1440, Math.round(LANDSCAPE_HEIGHT * aspect));
}

export function makeLandscapeMapper(viewWidth: number): LandscapeMapper {
  /*
   * Preserve the original arena geometry in landscape.
   *
   * The server physics world stays 1080×1920. We rotate that coordinate space
   * into a centered 1920×1080 presentation at a UNIFORM scale so circles stay
   * circles and distances keep their visual proportions.
   *
   * Ultra-wide space is intentionally left outside this mapper and is painted
   * by the landscape scene as decorative stadium scenery. That fills the whole
   * phone without stretching gameplay.
   */
  const scale = Math.min(1, viewWidth / SOURCE_HEIGHT);
  const playWidth = SOURCE_HEIGHT * scale;
  const playHeight = SOURCE_WIDTH * scale;
  const offsetX = (viewWidth - playWidth) / 2;
  const offsetY = (LANDSCAPE_HEIGHT - playHeight) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    playWidth,
    playHeight,
    map(x: number, y: number) {
      return {
        x: offsetX + y * scale,
        y: offsetY + (SOURCE_WIDTH - x) * scale,
      };
    },
  };
}
