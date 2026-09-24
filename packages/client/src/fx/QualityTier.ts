/**
 * Explicit quality tiers for cinematic FX.
 *
 * Maps particleBudget (0..1, set from FPS in ArenaScene.trackFps) into
 * 'high' | 'medium' | 'low', then scales twinkles / sparks / trails / dust.
 *
 * Tiers (ArenaScene):
 *   fps >= 40  → budget 1.00 → high
 *   fps >= 28  → budget 0.50 → medium
 *   fps <  28  → budget 0.25 → low
 *
 * Physics / TikTok stay server-side — this only gates client VFX counts.
 */
export type QualityTier = 'high' | 'medium' | 'low';

export interface FxScale {
  /** Ambient twinkle / dust multiplier */
  twinkles: number;
  /** Collision spark count multiplier */
  sparks: number;
  /** Speed-trail spawn chance / count multiplier */
  trails: number;
  /** Soft smoke / energy dust multiplier */
  dust: number;
  /** Trail ghost alpha */
  trailAlpha: number;
  /** Spark radius scale */
  sparkSize: number;
  /** Extra trail ghosts per smear (high only) */
  trailGhosts: number;
}

export function qualityFromBudget(budget: number): QualityTier {
  if (budget >= 0.85) return 'high';
  if (budget >= 0.4) return 'medium';
  return 'low';
}

export function qualityFromFps(fps: number): QualityTier {
  if (fps >= 40) return 'high';
  if (fps >= 28) return 'medium';
  return 'low';
}

export function fxScaleFor(tier: QualityTier): FxScale {
  switch (tier) {
    case 'high':
      return {
        twinkles: 1,
        sparks: 1.35,
        trails: 1,
        dust: 1,
        trailAlpha: 0.4,
        sparkSize: 1.15,
        trailGhosts: 2,
      };
    case 'medium':
      return {
        twinkles: 0.55,
        sparks: 0.7,
        trails: 0.55,
        dust: 0.5,
        trailAlpha: 0.28,
        sparkSize: 0.9,
        trailGhosts: 1,
      };
    case 'low':
    default:
      return {
        twinkles: 0.25,
        sparks: 0.35,
        trails: 0.2,
        dust: 0.2,
        trailAlpha: 0.16,
        sparkSize: 0.7,
        trailGhosts: 0,
      };
  }
}

/** Convenience: budget → scale in one call. */
export function fxScaleFromBudget(budget: number): FxScale {
  return fxScaleFor(qualityFromBudget(budget));
}
