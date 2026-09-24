/**
 * Persistent gift / pickup cheat-sheet (gabarito) for viewers.
 * Style-guide power icons: circular glass discs with colored rings + emoji.
 */
import Phaser from 'phaser';
import { THEME, THEME_HEX, FONT, FONT_ACCENT } from '../theme';

interface PowerIcon {
  emoji: string;
  ring: number;
  label: string;
}

const POWER_ICONS: PowerIcon[] = [
  { emoji: '🔥', ring: THEME.arenaRed, label: 'Fogo' },
  { emoji: '🛡️', ring: THEME.electricCyan, label: 'Escudo' },
  { emoji: '⚡', ring: THEME.gold, label: 'Raio' },
  { emoji: '🧲', ring: THEME.electricCyan, label: 'Ímã' },
  { emoji: '❄️', ring: 0x7dd3fc, label: 'Gelo' },
  { emoji: '🚀', ring: THEME.emberOrange, label: 'Dash' },
  { emoji: '🪞', ring: 0xe0e7ff, label: 'Espelho' },
  { emoji: '🌌', ring: 0xa78bfa, label: 'Galáxia' },
];

export const GIFT_GABARITO_LINES: readonly string[] = [
  '🌹 Rosa — cura leve',
  '🦖 Dino — força/speed',
  '🍩 Donut — escudo',
  '🦫 Capy — gigante',
  '💬 Comente p/ entrar',
];

export interface GiftLegendHandles {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  neon: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  iconsGfx: Phaser.GameObjects.Graphics;
  iconLabels: Phaser.GameObjects.Text[];
  width: number;
  height: number;
  born: number;
}

export function createGiftLegend(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts?: { compact?: boolean; depth?: number; maxWidth?: number }
): GiftLegendHandles {
  const compact = !!opts?.compact;
  const depth = opts?.depth ?? 95;
  const maxWidth = opts?.maxWidth ?? 300;
  const fontSize = compact ? '14px' : '17px';
  const padX = 12;
  const padY = 10;

  const root = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();
  const neon = scene.add.graphics();
  const iconsGfx = scene.add.graphics();

  const title = scene.add.text(padX, padY, '★ POWER-UPS', {
    fontFamily: FONT_ACCENT,
    fontSize: compact ? '20px' : '24px',
    color: THEME_HEX.gold,
    stroke: '#000000',
    strokeThickness: 3,
  });

  // Circular icon discs row
  const iconY = padY + 36;
  const iconR = compact ? 16 : 18;
  const gap = compact ? 34 : 38;
  const startX = padX + iconR + 2;
  const iconLabels: Phaser.GameObjects.Text[] = [];

  for (let i = 0; i < POWER_ICONS.length; i++) {
    const ic = POWER_ICONS[i];
    const ix = startX + (i % 4) * gap;
    const iy = iconY + Math.floor(i / 4) * (gap + 4);
    drawPowerDisc(iconsGfx, ix, iy, iconR, ic.ring);
    const t = scene.add
      .text(ix, iy, ic.emoji, { fontSize: compact ? '14px' : '16px' })
      .setOrigin(0.5);
    iconLabels.push(t);
  }

  const bodyY = iconY + Math.ceil(POWER_ICONS.length / 4) * (gap + 4) + 8;
  const body = scene.add.text(padX, bodyY, GIFT_GABARITO_LINES.join('\n'), {
    fontFamily: FONT,
    fontSize,
    color: THEME_HEX.light,
    lineSpacing: compact ? 1 : 3,
    wordWrap: { width: maxWidth - padX * 2 },
  });

  root.add([bg, neon, iconsGfx, title, body, ...iconLabels]);

  const width = maxWidth;
  const height = Math.ceil(body.y + body.height + padY + 4);
  drawGlassCard(bg, neon, width, height, 0);

  return {
    root,
    bg,
    neon,
    title,
    body,
    iconsGfx,
    iconLabels,
    width,
    height,
    born: scene.time.now,
  };
}

function drawPowerDisc(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  ring: number
): void {
  g.fillStyle(THEME.ink, 0.55);
  g.fillCircle(x, y, r);
  g.fillStyle(THEME.stone, 0.45);
  g.fillCircle(x, y, r - 2);
  g.lineStyle(2.5, ring, 0.9);
  g.strokeCircle(x, y, r);
  g.lineStyle(1, THEME.light, 0.25);
  g.strokeCircle(x, y, r - 3);
}

function drawGlassCard(
  g: Phaser.GameObjects.Graphics,
  neon: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pulse: number
): void {
  g.clear();
  g.fillStyle(THEME.ink, 0.4);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(2, THEME.light, 0.2);
  g.strokeRoundedRect(0, 0, w, h, 14);
  g.lineStyle(3, THEME.emberOrange, 0.7);
  g.lineBetween(0, 12, 0, h - 12);
  g.lineStyle(1, THEME.gold, 0.4);
  g.lineBetween(14, 28, w - 14, 28);

  neon.clear();
  const a = 0.35 + pulse * 0.35;
  neon.lineStyle(2, THEME.electricCyan, a);
  neon.strokeRoundedRect(1, 1, w - 2, h - 2, 13);
  neon.lineStyle(1, THEME.emberOrange, a * 0.55);
  neon.strokeRoundedRect(3, 3, w - 6, h - 6, 11);
}

/** Soft neon pulse — call from scene.update */
export function tickGiftLegend(handles: GiftLegendHandles, time: number): void {
  const t = (time - handles.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
  drawGlassCard(handles.bg, handles.neon, handles.width, handles.height, pulse);
}

export function setGiftLegendCompact(handles: GiftLegendHandles, compact: boolean): void {
  const fontSize = compact ? '13px' : '17px';
  handles.body.setFontSize(fontSize);
  handles.title.setFontSize(compact ? '18px' : '22px');
  const h = Math.ceil(handles.body.y + handles.body.height + 14);
  handles.height = h;
  drawGlassCard(handles.bg, handles.neon, handles.width, h, 0);
}
