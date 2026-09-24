/**
 * Persistent gift / pickup cheat-sheet (gabarito) for viewers.
 * Compact glass card — right side under title / opposite TOP5.
 */
import Phaser from 'phaser';
import { THEME, THEME_HEX, FONT, FONT_BLACK } from '../theme';

export const GIFT_GABARITO_LINES: readonly string[] = [
  '🎁 PRESENTES',
  '🌹 Rosa — cura leve (+2 HP)',
  '🦖 Mini Dino — +força/+speed ~10s',
  '🍩 Rosquinha — escudo (+100) ~15s',
  '🦫 Capivara — Titan ~20s (stomp)',
  '🌌 Galáxia — God Mode / Duelo',
  '',
  '⬇ NO CHÃO (passe por cima)',
  '⚡ Raio · 🧲 Ímã · ❄️ Gelo',
  '🚀 Foguete · 🪞 Espelho',
  '',
  '💬 Comente p/ entrar / respawn',
];

export interface GiftLegendHandles {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  neon: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
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
  const fontSize = compact ? '15px' : '18px';
  const titleSize = compact ? '17px' : '20px';
  const padX = 12;
  const padY = 10;

  const root = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();
  const neon = scene.add.graphics();

  const title = scene.add.text(padX, padY, '★ GABARITO', {
    fontFamily: FONT_BLACK,
    fontSize: titleSize,
    color: THEME_HEX.gold,
    stroke: '#000000',
    strokeThickness: 3,
  });

  const body = scene.add.text(padX, padY + 26, GIFT_GABARITO_LINES.join('\n'), {
    fontFamily: FONT,
    fontSize,
    color: THEME_HEX.cream,
    lineSpacing: compact ? 1 : 3,
    wordWrap: { width: maxWidth - padX * 2 },
  });

  root.add([bg, neon, title, body]);

  const width = maxWidth;
  const height = Math.ceil(body.y + body.height + padY + 4);
  drawGlassCard(bg, neon, width, height, 0);

  return { root, bg, neon, title, body, width, height, born: scene.time.now };
}

function drawGlassCard(
  g: Phaser.GameObjects.Graphics,
  neon: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pulse: number
): void {
  g.clear();
  g.fillStyle(THEME.ink, 0.72);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(2, THEME.cream, 0.22);
  g.strokeRoundedRect(0, 0, w, h, 14);
  g.lineStyle(3, THEME.lavender, 0.75);
  g.lineBetween(0, 12, 0, h - 12);
  g.lineStyle(1, THEME.gold, 0.4);
  g.lineBetween(14, 28, w - 14, 28);

  neon.clear();
  const a = 0.35 + pulse * 0.35;
  neon.lineStyle(2, THEME.teal, a);
  neon.strokeRoundedRect(1, 1, w - 2, h - 2, 13);
  neon.lineStyle(1, THEME.lavender, a * 0.7);
  neon.strokeRoundedRect(3, 3, w - 6, h - 6, 11);
}

/** Soft neon pulse + bob — call from scene.update */
export function tickGiftLegend(handles: GiftLegendHandles, time: number): void {
  const t = (time - handles.born) / 1000;
  const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
  drawGlassCard(handles.bg, handles.neon, handles.width, handles.height, pulse);
  handles.root.y = handles.root.y; // bob applied by caller via baseY
}

export function setGiftLegendCompact(handles: GiftLegendHandles, compact: boolean): void {
  const fontSize = compact ? '14px' : '18px';
  handles.body.setFontSize(fontSize);
  handles.title.setFontSize(compact ? '16px' : '20px');
  const h = Math.ceil(handles.body.y + handles.body.height + 14);
  handles.height = h;
  drawGlassCard(handles.bg, handles.neon, handles.width, h, 0);
}
