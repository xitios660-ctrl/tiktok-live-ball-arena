/**
 * Neon glass kill-feed chips — slide in from the right, soft glow accent.
 * Matches arena glossy palette; client-only, no gameplay impact.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { THEME, THEME_HEX, FONT_ACCENT } from '../theme';
import { SAFE } from '../overlayConfig';

export type KillTone = 'kill' | 'revenge' | 'gift' | 'power' | 'info' | 'gold';

export interface NeonFeedItem {
  row: Phaser.GameObjects.Container;
  chip: Phaser.GameObjects.Container;
  height: number;
  born: number;
}

const TTL = 5200;
const MAX_ITEMS = 6;
const CARD_W = 460;

const TONE: Record<
  KillTone,
  { accent: number; fill: number; fillA: number; text: string; icon: string }
> = {
  kill: { accent: THEME.arenaRed, fill: THEME.stone, fillA: 0.68, text: THEME_HEX.light, icon: '⚔' },
  revenge: { accent: THEME.gold, fill: 0x2a1c10, fillA: 0.72, text: THEME_HEX.gold, icon: '🎯' },
  gift: { accent: THEME.emberOrange, fill: THEME.stone, fillA: 0.68, text: THEME_HEX.emberOrange, icon: '✦' },
  power: { accent: THEME.electricCyan, fill: 0x10181c, fillA: 0.68, text: THEME_HEX.electricCyan, icon: '⚡' },
  info: { accent: THEME.light, fill: THEME.stone, fillA: 0.62, text: THEME_HEX.light, icon: '·' },
  gold: { accent: THEME.gold, fill: 0x1c1610, fillA: 0.7, text: THEME_HEX.gold, icon: '★' },
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
  const row = scene.add.container(0, 0);
  const chip = scene.add.container(28, 0);

  const text = scene.add
    .text(0, 0, `${style.icon}  ${message}`, {
      fontFamily: FONT_ACCENT,
      fontSize: '22px',
      color: style.text,
      wordWrap: { width: CARD_W - 36 },
      lineSpacing: 2,
    })
    .setOrigin(1, 0.5);

  const padX = 16;
  const padY = 11;
  const tw = Math.min(CARD_W, Math.max(180, text.width + padX * 2));
  const th = Math.max(36, text.height + padY * 2);

  const g = scene.add.graphics();
  g.fillStyle(style.accent, 0.12);
  g.fillRoundedRect(-tw - 4, -th / 2 - 4, tw + 8, th + 8, 14);
  g.fillStyle(style.fill, style.fillA);
  g.fillRoundedRect(-tw, -th / 2, tw, th, 12);
  g.lineStyle(1.25, THEME.light, 0.22);
  g.strokeRoundedRect(-tw, -th / 2, tw, th, 12);
  g.lineStyle(1, THEME.steel, 0.4);
  g.strokeRoundedRect(-tw + 2, -th / 2 + 2, tw - 4, th - 4, 10);
  g.fillStyle(style.accent, 0.95);
  g.fillRoundedRect(-tw + 3, -th / 2 + 6, 4, th - 12, 2);
  g.fillStyle(THEME.light, 0.06);
  g.fillRoundedRect(-tw + 10, -th / 2 + 3, tw - 16, th * 0.38, 8);

  text.setPosition(-padX, 0);
  chip.add([g, text]);
  chip.setAlpha(0);
  chip.setScale(0.9);

  row.add(chip);
  layer.add(row);

  items.unshift({ row, chip, height: th, born: Date.now() });

  scene.tweens.add({
    targets: chip,
    alpha: 1,
    scale: 1,
    x: 0,
    duration: 300,
    ease: 'Cubic.Out',
  });

  while (items.length > MAX_ITEMS) {
    const old = items.pop();
    old?.row.destroy(true);
  }

  layoutNeonKillFeed(items);
}

export function tickNeonKillFeed(items: NeonFeedItem[], now: number): NeonFeedItem[] {
  const next = items.filter((item) => {
    const age = now - item.born;
    if (age > TTL) {
      item.row.destroy(true);
      return false;
    }
    const fadeStart = TTL - 900;
    if (age > fadeStart) {
      item.row.setAlpha(1 - (age - fadeStart) / 900);
    }
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
