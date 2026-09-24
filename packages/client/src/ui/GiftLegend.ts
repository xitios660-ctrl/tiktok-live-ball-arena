/**
 * Persistent gift cheat-sheet (gabarito) for viewers.
 * Compact glass card — left side under likes / opposite TOP5 if needed.
 */
import Phaser from 'phaser';
import { THEME, THEME_HEX, FONT, FONT_BLACK } from '../theme';

export const GIFT_GABARITO_LINES: readonly string[] = [
  '🌹 Rosa — cura leve (+2 HP)',
  '🦖 Mini Dino — +força/+speed ~10s',
  '🍩 Rosquinha — escudo (+100, máx 300) ~15s',
  '   Sugar Burst se o escudo quebrar',
  '🦫 Capivara — Titan ~20s (stomp)',
  '🌌 Galáxia — God Mode; 2ª = Duelo',
  '⚡ Raio — dano+slow no mais perto',
  '🧲 Ímã — puxa bolas',
  '❄️ Gelo — aura de slow',
  '🚀 Foguete — dash de velocidade',
  '🪞 Espelho — reflete dano ~5s',
  '',
  '💬 Comente para entrar / respawnar',
];

export interface GiftLegendHandles {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  width: number;
  height: number;
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
  const fontSize = compact ? '16px' : '18px';
  const titleSize = compact ? '18px' : '20px';
  const padX = 12;
  const padY = 10;

  const root = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();

  const title = scene.add
    .text(padX, padY, '★ GABARITO', {
      fontFamily: FONT_BLACK,
      fontSize: titleSize,
      color: THEME_HEX.gold,
      stroke: '#000000',
      strokeThickness: 3,
    });

  const body = scene.add
    .text(padX, padY + 28, GIFT_GABARITO_LINES.join('\n'), {
      fontFamily: FONT,
      fontSize,
      color: THEME_HEX.cream,
      lineSpacing: compact ? 2 : 3,
      wordWrap: { width: maxWidth - padX * 2 },
    });

  root.add([bg, title, body]);

  const width = maxWidth;
  const height = Math.ceil(body.y + body.height + padY + 4);
  drawGlassCard(bg, width, height);

  return { root, bg, title, body, width, height };
}

function drawGlassCard(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.clear();
  g.fillStyle(THEME.ink, 0.72);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(2, THEME.cream, 0.28);
  g.strokeRoundedRect(0, 0, w, h, 14);
  g.lineStyle(3, THEME.lavender, 0.85);
  g.lineBetween(0, 12, 0, h - 12);
  g.lineStyle(1, THEME.gold, 0.45);
  g.lineBetween(14, 30, w - 14, 30);
}

/** Reposition / shrink for tight layouts (e.g. many balls + TOP5). */
export function setGiftLegendCompact(handles: GiftLegendHandles, compact: boolean): void {
  const fontSize = compact ? '15px' : '18px';
  handles.body.setFontSize(fontSize);
  handles.title.setFontSize(compact ? '17px' : '20px');
  const h = Math.ceil(handles.body.y + handles.body.height + 14);
  handles.height = h;
  drawGlassCard(handles.bg, handles.width, h);
}
