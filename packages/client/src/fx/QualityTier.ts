/**
 * Explicit quality tiers for cinematic FX.
 *
 * Maps particleBudget (0..1, set from FPS in ArenaScene.trackFps) into
 * 'high' | 'medium' | 'low', then scales twinkles / sparks / trails / dust.
 *
 * Default (max quality): stay at budget 1 / high unless FPS is catastrophic
 *   fps < 12 → budget 0.25 → low
 *   fps < 18 → budget 0.5  → medium
 *   else     → budget 1.00 → high
 *
 * Optional ?quality=auto restores the older adaptive curve (40 / 28 fps).
 *
 * Phone screen-share (?phone=1 / ?lite=1): prefer smooth FPS over max particles
 *   default budget ~0.65; degrade earlier (45 / 32 / 22 fps).
 *   High-tier FX slightly softened when phoneLite.
 *
 * Physics / TikTok stay server-side — this only gates client VFX counts.
 */
export type QualityMode = 'max' | 'auto' | 'phone';

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

export function qualityFromFps(fps: number, mode: QualityMode = 'max'): QualityTier {
  return qualityFromBudget(budgetFromFps(fps, mode));
}

/** Budget for trackFps — max stays at 1 unless catastrophic FPS. */
export function budgetFromFps(fps: number, mode: QualityMode = 'max'): number {
  if (mode === 'phone') {
    // Prefer medium-high smooth FPS over max particles on cellphone screen-share.
    if (fps < 22) return 0.25;
    if (fps < 32) return 0.35;
    if (fps < 45) return 0.5;
    return 0.65; // default target ~0.55–0.7
  }
  if (mode === 'auto') {
    if (fps < 28) return 0.25;
    if (fps < 40) return 0.5;
    return 1;
  }
  if (fps < 12) return 0.25;
  if (fps < 18) return 0.5;
  return 1;
}

export function fxScaleFor(tier: QualityTier): FxScale {
  switch (tier) {
    case 'high':
      // Modest bump vs older 1.0 / 1.35 — richer sparks/trails without melting mid phones
      return {
        twinkles: 1.15,
        sparks: 1.5,
        trails: 1.15,
        dust: 1.1,
        trailAlpha: 0.44,
        sparkSize: 1.22,
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

/**
 * Convenience: budget → scale in one call.
 * When phoneLite, slightly lower FX (especially high-tier) for mobile GPU headroom.
 */
export function fxScaleFromBudget(budget: number, phoneLite = false): FxScale {
  const scale = fxScaleFor(qualityFromBudget(budget));
  if (!phoneLite) return scale;
  return {
    ...scale,
    twinkles: scale.twinkles * 0.72,
    sparks: scale.sparks * 0.78,
    trails: scale.trails * 0.65,
    dust: scale.dust * 0.7,
    trailAlpha: scale.trailAlpha * 0.85,
    sparkSize: scale.sparkSize * 0.92,
    trailGhosts: Math.max(0, scale.trailGhosts - (scale.trailGhosts > 0 ? 1 : 0)),
  };
}
