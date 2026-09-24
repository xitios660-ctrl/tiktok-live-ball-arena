/**
 * Ball Arena — cinematic arcade / esports design tokens.
 * Source of truth for Phaser colors + CSS variables in index.html.
 * Reference boards: brand/ball-arena/refs/
 */

/** Phaser-friendly numeric colors */
export const THEME = {
  // Brand
  arenaRed: 0xff4e45 as number,
  emberOrange: 0xff8a3d as number,
  gold: 0xffd166 as number,
  electricCyan: 0x22d3ee as number,
  arenaDark: 0x0b0b0f as number,
  stone: 0x1e1a16 as number,
  steel: 0x2e3440 as number,
  light: 0xf2ebd7 as number,

  // Aliases used across existing UI (map to new identity)
  charcoal: 0x0b0b0f as number,
  cream: 0xf2ebd7 as number,
  coral: 0xff4e45 as number,
  teal: 0x22d3ee as number,
  sage: 0x34d399 as number,
  lavender: 0xa78bfa as number,
  card: 0x1e1a16 as number,
  ink: 0x0b0b0f as number,
};

export const THEME_HEX = {
  arenaRed: '#FF4E45',
  emberOrange: '#FF8A3D',
  gold: '#FFD166',
  electricCyan: '#22D3EE',
  arenaDark: '#0B0B0F',
  stone: '#1E1A16',
  steel: '#2E3440',
  light: '#F2EBD7',

  // Aliases
  charcoal: '#0B0B0F',
  cream: '#F2EBD7',
  coral: '#FF4E45',
  teal: '#22D3EE',
  sage: '#34D399',
  lavender: '#A78BFA',
  muted: '#8B8794',
  cardBg: '#1E1A16cc',
  ink: '#0B0B0F',
  card: '#1E1A16',
};

/** Body / HUD — Inter */
export const FONT = 'Inter, Outfit, Nunito, system-ui, sans-serif';
/** Logo / big titles — Bevan */
export const FONT_BLACK = 'Bevan, Fraunces, Georgia, serif';
/** Condensed highlights / CTAs — Bebas Neue */
export const FONT_ACCENT = 'Bebas Neue, Inter, sans-serif';

/** Rank medal tones */
export const RANK_HEX = {
  gold: '#FFD166',
  silver: '#C0C7D4',
  bronze: '#CD7F32',
} as const;
