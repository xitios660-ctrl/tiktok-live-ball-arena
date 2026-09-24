/**
 * Cinematic neon glass kill-feed chips — soft accent halo, dual cream/accent
 * edge, living pulse, appear sparks. Client-only; OBS / phone-safe.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { THEME, THEME_HEX, FONT_ACCENT } from '../theme';
import { getOverlayOptions, SAFE } from '../overlayConfig';

export type KillTone = 'kill' | 'revenge' | 'gift' | 'power' | 'info' | 'gold';

export interface NeonFeedItem {
  row: Phaser.GameObjects.Container;
  chip: Phaser.GameObjects.Container;
  height: number;
  born: number;
  tone: KillTone;
  baseAlpha: number;
}

const TTL = 5200;
const MAX_ITEMS = 6;
const CARD_W = 460;
const CREAM = THEME.light;

const TONE: Record<
  KillTone,
  { accent: number; fill: number; fillA: number; text: string; icon: string; sparks: boolean }
> = {
  kill: {
    accent: THEME.arenaRed,
    fill: THEME.stone,
    fillA: 0.72,
    text: THEME_HEX.light,
    icon: '⚔',
    sparks: true,
  },
  revenge: {
    accent: THEME.gold,
    fill: 0x2a1c10,
    fillA: 0.76,
    text: THEME_HEX.gold,
    icon: '🎯',
    sparks: true,
  },
  gift: {
    accent: THEME.emberOrange,
    fill: THEME.stone,
    fillA: 0.72,
    text: THEME_HEX.emberOrange,
    icon: '✦',
    sparks: false,
  },
  power: {
    accent: THEME.electricCyan,
    fill: 0x10181c,
    fillA: 0.72,
    text: THEME_HEX.electricCyan,
    icon: '⚡',
    sparks: true,
  },
  info: {
    accent: THEME.light,
    fill: THEME.stone,
    fillA: 0.64,
    text: THEME_HEX.light,
    icon: '·',
    sparks: false,
  },
  gold: {
    accent: THEME.gold,
    fill: 0x1c1610,
    fillA: 0.74,
    text: THEME_HEX.gold,
    icon: '★',
    sparks: true,
  },
};

/** Map legacy color/bg pairs from ArenaScene combat handlers onto tones. */
export function toneFromColors(color: string, bg: string): KillTone {
  const c = color.toLowerCase();
  const b = bg.toLowerCase();
  if (b.includes('5c2020')) return 'revenge';
  if (b.includes('2a2040') || c.includes('7eb6ff') || c.includes('a78bfa')) return 'gift';
  if (
    b.includes('1a3040') ||
    b.includes('1a3d2a') ||
    c.includes('3dbea0') ||
    c.includes('4db6ac') ||
    c.includes('9ad17d')
  ) {
    return 'power';
  }
  if (c.includes('f0b429') || c.includes('ffc857')) return 'gold';
  if (
    c.includes('ff5a36') ||
    c.includes('ff6b6b') ||
    c.includes('ff4e45') ||
    b.includes('ff6b6b') ||
    b.includes('ff5a36') ||
    b.includes('ff4e45')
  ) {
    return 'kill';
  }
  return 'info';
}

export function pushNeonKillFeed(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  items: NeonFeedItem[],
  message: string,
  tone: KillTone = 'kill'
): void {
  const style = TONE[tone];
  const opts = getOverlayOptions();
  const phoneLite = !!opts.phoneLite;

  const row = scene.add.container(0, 0);
  const chip = scene.add.container(32, 0);

  const text = scene.add
    .text(0, 0, `${style.icon}  ${message}`, {
      fontFamily: FONT_ACCENT,
      fontSize: '22px',
      color: style.text,
      wordWrap: { width: CARD_W - 40 },
      lineSpacing: 2,
    })
    .setOrigin(1, 0.5);

  const padX = 18;
  const padY = 12;
  const tw = Math.min(CARD_W, Math.max(190, text.width + padX * 2 + 6));
  const th = Math.max(38, text.height + padY * 2);

  const g = scene.add.graphics();

  // Soft outer neon halo (accent wash)
  g.fillStyle(style.accent, phoneLite ? 0.08 : 0.14);
  g.fillRoundedRect(-tw - 10, -th / 2 - 10, tw + 20, th + 20, 18);
  g.fillStyle(style.accent, phoneLite ? 0.05 : 0.09);
  g.fillRoundedRect(-tw - 5, -th / 2 - 5, tw + 10, th + 10, 15);

  // Glass body
  g.fillStyle(style.fill, style.fillA);
  g.fillRoundedRect(-tw, -th / 2, tw, th, 12);

  // Dual edge: accent outer + cream inner reflect
  g.lineStyle(2, style.accent, phoneLite ? 0.45 : 0.62);
  g.strokeRoundedRect(-tw, -th / 2, tw, th, 12);
  g.lineStyle(1.25, CREAM, 0.32);
  g.strokeRoundedRect(-tw + 2.5, -th / 2 + 2.5, tw - 5, th - 5, 10);
  g.lineStyle(1, THEME.steel, 0.35);
  g.strokeRoundedRect(-tw + 1, -th / 2 + 1, tw - 2, th - 2, 11);

  // Accent rail with soft glow
  g.fillStyle(style.accent, 0.28);
  g.fillRoundedRect(-tw + 1, -th / 2 + 4, 8, th - 8, 3);
  g.fillStyle(style.accent, 0.95);
  g.fillRoundedRect(-tw + 3, -th / 2 + 7, 4, th - 14, 2);
  g.fillStyle(CREAM, 0.35);
  g.fillRoundedRect(-tw + 4, -th / 2 + 8, 1.5, Math.max(6, (th - 14) * 0.4), 1);

  // Top glass sheen
  g.fillStyle(CREAM, 0.07);
  g.fillRoundedRect(-tw + 12, -th / 2 + 3, tw - 18, th * 0.36, 8);

  text.setPosition(-padX, 0);
  chip.add([g, text]);
  chip.setAlpha(0);
  chip.setScale(0.88);

  row.add(chip);
  layer.add(row);

  items.unshift({
    row,
    chip,
    height: th,
    born: Date.now(),
    tone,
    baseAlpha: 1,
  });

  scene.tweens.add({
    targets: chip,
    alpha: 1,
    scale: 1,
    x: 0,
    duration: 320,
    ease: 'Cubic.Out',
  });

  // Appear sparks for dramatic tones (skip phoneLite)
  if (style.sparks && !phoneLite) {
    spawnAppearSparks(scene, chip, -tw * 0.35, 0, style.accent, tone === 'revenge' || tone === 'gold');
  }

  // Soft accent flash ring behind chip
  if (!phoneLite && (tone === 'kill' || tone === 'revenge' || tone === 'gold' || tone === 'power')) {
    const flash = scene.add.graphics();
    flash.fillStyle(style.accent, 0.22);
    flash.fillRoundedRect(-tw - 6, -th / 2 - 6, tw + 12, th + 12, 14);
    chip.addAt(flash, 0);
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  while (items.length > MAX_ITEMS) {
    const old = items.pop();
    old?.row.destroy(true);
  }

  layoutNeonKillFeed(items);
}

function spawnAppearSparks(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  goldMix: boolean
): void {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI * 0.15 - (i / (n - 1)) * Math.PI * 0.7;
    const dist = 18 + Math.random() * 28;
    const c = goldMix && i % 2 === 0 ? THEME.gold : color;
    const dot = scene.add
      .circle(x, y, 1.8 + Math.random() * 1.6, c, 0.95)
      .setAlpha(0.9);
    parent.add(dot);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.3,
      duration: 280 + Math.random() * 160,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

export function tickNeonKillFeed(items: NeonFeedItem[], now: number): NeonFeedItem[] {
  const phoneLite = !!getOverlayOptions().phoneLite;
  const next = items.filter((item) => {
    const age = now - item.born;
    if (age > TTL) {
      item.row.destroy(true);
      return false;
    }
    const fadeStart = TTL - 900;
    let alpha = 1;
    if (age > fadeStart) {
      alpha = 1 - (age - fadeStart) / 900;
    } else if (!phoneLite) {
      // Soft living pulse while fully visible
      const pulse = 0.92 + 0.08 * Math.sin(now / 1000 * 2.8 + item.born * 0.001);
      alpha = pulse;
    }
    item.row.setAlpha(alpha);
    return true;
  });
  layoutNeonKillFeed(next);
  return next;
}

export function layoutNeonKillFeed(items: NeonFeedItem[]): void {
  const x = CANVAS_WIDTH - SAFE.side;
  let y = CANVAS_HEIGHT - SAFE.bottom - 24;
  for (const item of items) {
    y -= item.height;
    item.row.setPosition(x, y);
    y -= 10;
  }
}
