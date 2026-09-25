import Phaser from 'phaser';
import type { BallState } from '@arena/shared';
import { THEME } from '../theme';
import { paintKingCrown, clearKingCrown } from './BallKingCrown';

export type GlossSkin =
  | 'plain'
  | 'galaxy'
  | 'donut'
  | 'ice'
  | 'dino'
  | 'capy'
  | 'mirror'
  | 'rocket'
  | 'magnet'
  | 'ember'
  | 'cyan'
  | 'violet'
  | 'gold';

const TEX_SIZE = 128;

export function skinFromBall(b: BallState): GlossSkin {
  const buffs = b.buffs || [];
  if (buffs.includes('galaxy_god') || b.isGalaxy) return 'galaxy';
  if (buffs.includes('donut_overdrive')) return 'donut';
  if (buffs.includes('freeze_aura')) return 'ice';
  if (buffs.includes('dino_rage')) return 'dino';
  if (buffs.includes('capybara_titan')) return 'capy';
  if (buffs.includes('reflect_shield')) return 'mirror';
  if (buffs.includes('dash_burst')) return 'rocket';
  if (buffs.includes('magnet_pulse')) return 'magnet';
  const seed = [...b.userId].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % 4;
  return (['ember', 'cyan', 'violet', 'gold'] as const)[seed];
}

function textureKey(color: number, skin: GlossSkin): string {
  return `gloss-${color.toString(16)}-${skin}`;
}

/**
 * Ensure a cached 128px glossy sphere texture for color+skin.
 * King gold is NOT baked into the texture — stays on the Arc stroke.
 */
export function ensureGlossTexture(
  scene: Phaser.Scene,
  color: number,
  skin: GlossSkin
): string {
  const key = textureKey(color, skin);
  if (scene.textures.exists(key)) return key;

  const canvasTex = scene.textures.createCanvas(key, TEX_SIZE, TEX_SIZE);
  if (!canvasTex) return key;
  const ctx = canvasTex.getContext();
  const s = TEX_SIZE;
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - 1;

  ctx.clearRect(0, 0, s, s);

  // Base sphere radial fill
  const base = mixColor(color, 0x000000, 0.22);
  const mid = color;
  const hi = mixColor(color, 0xffffff, 0.35);
  const grad = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, r * 0.05, cx, cy + r * 0.1, r);
  grad.addColorStop(0, hexCss(hi));
  grad.addColorStop(0.45, hexCss(mid));
  grad.addColorStop(1, hexCss(base));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Specular gloss blob (top-left)
  const spec = ctx.createRadialGradient(
    cx - r * 0.32,
    cy - r * 0.38,
    0,
    cx - r * 0.32,
    cy - r * 0.38,
    r * 0.42
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.72)');
  spec.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = spec;
  ctx.fill();

  // Soft bottom rim shade
  const shade = ctx.createRadialGradient(cx, cy + r * 0.55, r * 0.1, cx, cy, r);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(0.7, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  paintSkinAccent(ctx, cx, cy, r, skin);

  // Cream rim + soft outer halo so photos pop on dark floor
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(242,235,215,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,209,102,0.22)';
  ctx.lineWidth = 4;
  ctx.stroke();

  canvasTex.refresh();
  return key;
}

function paintSkinAccent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  skin: GlossSkin
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  switch (skin) {
    case 'galaxy': {
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 + i * 0.4;
        const d = r * (0.15 + (i % 5) * 0.12);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.2 + (i % 3), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(34,211,238,0.85)' : 'rgba(242,235,215,0.7)';
        ctx.fill();
      }
      const neb = ctx.createRadialGradient(cx + r * 0.2, cy - r * 0.1, 0, cx, cy, r);
      neb.addColorStop(0, 'rgba(34,211,238,0.35)');
      neb.addColorStop(0.5, 'rgba(160,100,255,0.15)');
      neb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    }
    case 'donut': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,159,28,0.75)';
      ctx.lineWidth = r * 0.22;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(35,30,25,0.35)';
      ctx.fill();
      // Sprinkles
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
        ctx.rotate(a);
        ctx.fillStyle = i % 2 ? 'rgba(255,90,54,0.9)' : 'rgba(240,180,41,0.9)';
        ctx.fillRect(-2, -5, 4, 10);
        ctx.restore();
      }
      break;
    }
    case 'ice': {
      ctx.strokeStyle = 'rgba(125,211,252,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
      const frost = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      frost.addColorStop(0, 'rgba(186,230,253,0.35)');
      frost.addColorStop(1, 'rgba(125,211,252,0)');
      ctx.fillStyle = frost;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    }
    case 'dino': {
      ctx.fillStyle = 'rgba(124,252,0,0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      // Spikes along top
      ctx.fillStyle = 'rgba(124,252,0,0.85)';
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.35;
        const bx = cx + Math.cos(a) * r * 0.55;
        const by = cy + Math.sin(a) * r * 0.55;
        const tipx = cx + Math.cos(a) * r * 0.95;
        const tipy = cy + Math.sin(a) * r * 0.95;
        const perp = a + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(perp) * 6, by + Math.sin(perp) * 6);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(bx - Math.cos(perp) * 6, by - Math.sin(perp) * 6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'capy': {
      ctx.fillStyle = 'rgba(196,164,132,0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.05, r * 0.7, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.fillStyle = 'rgba(180,140,100,0.8)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.45, cy - r * 0.35, r * 0.18, r * 0.22, -0.3, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.45, cy - r * 0.35, r * 0.18, r * 0.22, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mirror': {
      const mir = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      mir.addColorStop(0, 'rgba(224,231,255,0.55)');
      mir.addColorStop(0.45, 'rgba(255,255,255,0.15)');
      mir.addColorStop(0.55, 'rgba(126,182,255,0.25)');
      mir.addColorStop(1, 'rgba(224,231,255,0.4)');
      ctx.fillStyle = mir;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(224,231,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'rocket': {
      ctx.fillStyle = 'rgba(255,78,69,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.35, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.35, cy + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,138,61,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.25);
      ctx.lineTo(cx, cy + r * 0.75);
      ctx.lineTo(cx + r * 0.2, cy + r * 0.25);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'magnet': {
      ctx.strokeStyle = 'rgba(34,211,238,0.85)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34,211,238,0.9)';
      ctx.fillRect(cx - r * 0.55, cy - r * 0.2, 10, r * 0.4);
      ctx.fillRect(cx + r * 0.55 - 10, cy - r * 0.2, 10, r * 0.4);
      break;
    }
    case 'plain': {
      // Bots and viewers without photo still read as characters, not blank tokens.
      ctx.fillStyle = 'rgba(11,11,15,0.72)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.25, cy - r * 0.08, r * 0.10, r * 0.14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.25, cy - r * 0.08, r * 0.10, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(242,235,215,0.88)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.11, r * 0.035, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.25, cy - r * 0.11, r * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(11,11,15,0.7)';
      ctx.lineWidth = Math.max(2, r * 0.045);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.10, r * 0.24, 0.15, Math.PI - 0.15);
      ctx.stroke();
      break;
    }
    case 'ember':
    case 'cyan':
    case 'violet':
    case 'gold': {
      const accent = skin === 'ember' ? 'rgba(255,78,69,.88)' : skin === 'cyan' ? 'rgba(34,211,238,.9)' : skin === 'violet' ? 'rgba(192,132,252,.9)' : 'rgba(255,209,102,.95)';
      ctx.strokeStyle = accent; ctx.lineWidth = Math.max(3, r * .08);
      ctx.beginPath(); ctx.arc(cx, cy, r * .72, -.35, Math.PI * 1.4); ctx.stroke();
      ctx.fillStyle = 'rgba(11,11,15,.76)';
      ctx.beginPath(); ctx.arc(cx-r*.24, cy-r*.08, r*.1, 0, Math.PI*2); ctx.arc(cx+r*.24, cy-r*.08, r*.1, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(242,235,215,.9)';
      ctx.beginPath(); ctx.arc(cx-r*.2, cy-r*.11, r*.035, 0, Math.PI*2); ctx.arc(cx+r*.2, cy-r*.11, r*.035, 0, Math.PI*2); ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/** Gold crown graphics (not emoji). Drawn above the ball. */
export function drawCrown(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale = 1
): void {
  g.clear();
  const s = scale;
  const baseY = y;
  const left = x - 16 * s;
  const right = x + 16 * s;
  const mid = x;

  // Band
  g.fillStyle(THEME.gold, 0.95);
  g.fillRoundedRect(left, baseY, 32 * s, 8 * s, 2 * s);
  g.lineStyle(1, mixColor(THEME.gold, 0x000000, 0.35), 0.8);
  g.strokeRoundedRect(left, baseY, 32 * s, 8 * s, 2 * s);

  // Points
  const tips = [
    { x: left + 2 * s, peak: baseY - 14 * s },
    { x: mid, peak: baseY - 20 * s },
    { x: right - 2 * s, peak: baseY - 14 * s },
  ];
  g.fillStyle(THEME.gold, 1);
  for (const t of tips) {
    g.fillTriangle(t.x - 5 * s, baseY + 1, t.x + 5 * s, baseY + 1, t.x, t.peak);
  }
  // Jewels
  g.fillStyle(THEME.coral, 0.95);
  g.fillCircle(mid, baseY - 10 * s, 2.4 * s);
  g.fillStyle(THEME.cream, 0.9);
  g.fillCircle(left + 4 * s, baseY - 6 * s, 1.6 * s);
  g.fillCircle(right - 4 * s, baseY - 6 * s, 1.6 * s);
}

export interface GlossBallParts {
  shadow: Phaser.GameObjects.Ellipse;
  gloss: Phaser.GameObjects.Image;
  crownGfx: Phaser.GameObjects.Graphics;
  glossKey: string;
  skin: GlossSkin;
}

/**
 * Create shadow + gloss image + crown graphics for a ball view.
 * Caller adds them into the container in the right order.
 */
export function createGlossParts(
  scene: Phaser.Scene,
  b: BallState
): GlossBallParts {
  const skin = skinFromBall(b);
  const key = ensureGlossTexture(scene, b.color, skin);
  const gloss = scene.add.image(0, 0, key);
  gloss.setDisplaySize(b.radius * 2, b.radius * 2);

  const shadow = scene.add.ellipse(0, b.radius * 0.72, b.radius * 1.55, b.radius * 0.42, 0x000000, 0.35);
  const crownGfx = scene.add.graphics();
  crownGfx.setVisible(false);

  return { shadow, gloss, crownGfx, glossKey: key, skin };
}

export function syncGlossParts(
  scene: Phaser.Scene,
  parts: GlossBallParts,
  b: BallState,
  opts: {
    hitFlash?: boolean;
    spawnProtected?: boolean;
    /** When set, king crown gets cinematic halo/pulse/sparks. */
    crownChrome?: { timeMs: number; phoneLite?: boolean; budget?: number };
  }
): void {
  const skin = skinFromBall(b);
  const key = ensureGlossTexture(scene, b.color, skin);
  if (key !== parts.glossKey) {
    parts.gloss.setTexture(key);
    parts.glossKey = key;
  }
  parts.skin = skin;
  parts.gloss.setDisplaySize(b.radius * 2, b.radius * 2);
  // hitFlash → light tint; spawnProtected alpha is applied on the container
  if (opts.hitFlash) {
    parts.gloss.setTint(0xffffff);
  } else {
    parts.gloss.clearTint();
  }
  parts.gloss.setAlpha(1);

  parts.shadow.setPosition(0, b.radius * 0.72);
  parts.shadow.setSize(b.radius * 1.55, b.radius * 0.42);
  parts.shadow.setAlpha(opts.spawnProtected ? 0.2 : 0.35);

  if (b.isKing) {
    const crownY = -b.radius - 18;
    const crownScale = Math.max(0.85, b.radius / 28);
    if (opts.crownChrome) {
      paintKingCrown(parts.crownGfx, {
        y: crownY,
        scale: crownScale,
        timeMs: opts.crownChrome.timeMs,
        phoneLite: opts.crownChrome.phoneLite,
        budget: opts.crownChrome.budget,
      });
    } else {
      parts.crownGfx.setVisible(true);
      drawCrown(parts.crownGfx, 0, crownY, crownScale);
    }
  } else {
    clearKingCrown(parts.crownGfx);
  }
}

function hexCss(n: number): string {
  const c = n >>> 0;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgb(${r},${g},${b})`;
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
