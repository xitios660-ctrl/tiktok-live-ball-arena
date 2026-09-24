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
   * Full-bleed landscape:
   * - Server physics remains the original 1080×1920 portrait world.
   * - Presentation maps the 1920 source-height across the ENTIRE landscape
   *   viewport width, including ultra-wide phones.
   * - Vertical source width maps to the full 1080 landscape height.
   * - Object radii stay circular by using the smaller axis scale.
   *
   * This removes the dark side gutters without changing server collision or
   * round logic. Only client-side presentation coordinates are stretched.
   */
  const xScale = viewWidth / SOURCE_HEIGHT;
  const yScale = LANDSCAPE_HEIGHT / SOURCE_WIDTH;
  const scale = Math.min(xScale, yScale);
  const playWidth = viewWidth;
  const playHeight = LANDSCAPE_HEIGHT;
  const offsetX = 0;
  const offsetY = 0;

  return {
    scale,
    offsetX,
    offsetY,
    playWidth,
    playHeight,
    map(x: number, y: number) {
      return {
        x: y * xScale,
        y: (SOURCE_WIDTH - x) * yScale,
      };
    },
  };
}
