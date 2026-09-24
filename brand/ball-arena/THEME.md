# Ball Arena — Cinematic Identity Tokens

Reference boards: `brand/ball-arena/refs/` (style-guide, hud-mock, waiting-mock).

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| Arena Red | `#FF4E45` | Brand, kills, primary energy |
| Ember Orange | `#FF8A3D` | CTA, sparks, heat |
| Gold | `#FFD166` | #1 / crown / ranking |
| Electric Cyan | `#22D3EE` | Shields, speed, accents |
| Arena Dark | `#0B0B0F` | Void / page bg |
| Stone | `#1E1A16` | Surfaces / cards |
| Steel | `#2E3440` | Borders / UI chrome |
| Light | `#F2EBD7` | Primary text |

CSS variables live in `packages/client/index.html` (`--arena-red`, …).  
Phaser tokens live in `packages/client/src/theme.ts` (`THEME` / `THEME_HEX`).

Legacy aliases (`coral`, `teal`, `cream`, `charcoal`) map onto this palette so existing UI keeps compiling.

## Typography

| Role | Family | Export |
|------|--------|--------|
| Logo / titles | Bevan | `FONT_BLACK` |
| Highlights / CTAs | Bebas Neue | `FONT_ACCENT` |
| UI / body | Inter | `FONT` |

## Asset folders

- `brand/ball-arena/{logos,backgrounds,icons,effects,ui,characters,refs}`
- Runtime copies (optional): `packages/client/public/assets/ball-arena/...`

Do **not** use a single flat mockup as the whole game background — build live Phaser layers.
