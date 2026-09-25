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
  { emoji: '🌹', ring: THEME.sage, label: 'Rosa' },
  { emoji: '🦖', ring: THEME.emberOrange, label: 'Dino' },
  { emoji: '🍩', ring: THEME.gold, label: 'Rosquinha' },
  { emoji: '🦫', ring: THEME.emberOrange, label: 'Capivara' },
  { emoji: '🌌', ring: 0xa78bfa, label: 'Galáxia' },
  { emoji: '⚡', ring: THEME.gold, label: 'Raio' },
  { emoji: '🧲', ring: THEME.electricCyan, label: 'Ímã' },
  { emoji: '❄️', ring: 0x7dd3fc, label: 'Gelo' },
  { emoji: '🚀', ring: THEME.emberOrange, label: 'Dash' },
  { emoji: '🪞', ring: 0xe0e7ff, label: 'Espelho' },
  { emoji: '💚', ring: THEME.sage, label: 'Cura' },
];

/** Portuguese gabarito — gameplay meanings from GiftAbilities / PhysicsWorld */
export const GIFT_GABARITO_LINES: readonly string[] = [
  '🌹 Rosa — cura leve',
  '🦖 Dino — força e velocidade',
  '🍩 Rosquinha — cura + escudo, empilha ×3',
  '🦫 Capivara — gigante, empilha ×3',
  '🌌 Galáxia — God Mode até o fim da rodada',
  '⚡ Raio — dano + lentidão no alvo próximo',
  '🧲 Ímã — puxa bolas próximas',
  '❄️ Gelo — desacelera inimigos próximos',
  '🚀 Foguete — dash e velocidade temporária',
  '🪞 Espelho — devolve parte do dano',
  '💚 Cura — recupera vida',
  '💬 Comente — entre ou renasça',
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
  const maxWidth = opts?.maxWidth ?? 320;
  const fontSize = compact ? '15px' : '18px';
  const padX = 14;
  const padY = 12;

  const root = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();
  const neon = scene.add.graphics();
  const iconsGfx = scene.add.graphics();

  const title = scene.add.text(padX, padY, '🎁 PRESENTES', {
    fontFamily: FONT_ACCENT,
    fontSize: compact ? '22px' : '26px',
    color: THEME_HEX.gold,
    stroke: '#0B0B0F',
    strokeThickness: 5,
  });

  // Circular icon discs row
  const iconY = padY + 40;
  const iconR = compact ? 15 : 18;
  const gap = compact ? 34 : 38;
  const iconCols = 4;
  const iconRows = Math.ceil(POWER_ICONS.length / iconCols);
  const startX = padX + iconR + 2;
  const iconLabels: Phaser.GameObjects.Text[] = [];

  for (let i = 0; i < POWER_ICONS.length; i++) {
    const ic = POWER_ICONS[i];
    const ix = startX + (i % iconCols) * gap;
    const iy = iconY + Math.floor(i / iconCols) * (gap + 6);
    drawPowerDisc(iconsGfx, ix, iy, iconR, ic.ring);
    const t = scene.add
      .text(ix, iy, ic.emoji, { fontSize: compact ? '15px' : '18px' })
      .setOrigin(0.5);
    iconLabels.push(t);
  }

  const bodyY = iconY + (iconRows - 1) * (gap + 6) + iconR + 16;
  const body = scene.add.text(padX, bodyY, GIFT_GABARITO_LINES.join('\n'), {
    fontFamily: FONT,
    fontSize,
    color: THEME_HEX.light,
    stroke: '#0B0B0F',
    strokeThickness: 3,
    lineSpacing: compact ? 3 : 5,
    wordWrap: { width: maxWidth - padX * 2 },
  });

  root.add([bg, neon, iconsGfx, title, body, ...iconLabels]);

  const width = maxWidth;
  const height = Math.ceil(body.y + body.height + padY + 6);
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
  g.fillStyle(THEME.ink, 0.75);
  g.fillCircle(x, y, r + 1);
  g.fillStyle(THEME.stone, 0.7);
  g.fillCircle(x, y, r - 1);
  g.lineStyle(3, ring, 0.95);
  g.strokeCircle(x, y, r);
  g.lineStyle(1.5, THEME.light, 0.35);
  g.strokeCircle(x, y, r - 3.5);
}

function drawGlassCard(
  g: Phaser.GameObjects.Graphics,
  neon: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pulse: number
): void {
  g.clear();
  // Stronger glass backdrop for readability on busy arena
  g.fillStyle(THEME.ink, 0.78);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.fillStyle(THEME.stone, 0.45);
  g.fillRoundedRect(2, 2, w - 4, h - 4, 12);
  g.lineStyle(2, THEME.gold, 0.45);
  g.strokeRoundedRect(0, 0, w, h, 14);
  g.lineStyle(3.5, THEME.emberOrange, 0.85);
  g.lineBetween(0, 12, 0, h - 12);
  g.lineStyle(1.5, THEME.gold, 0.55);
  g.lineBetween(14, 32, w - 14, 32);

  neon.clear();
  const a = 0.4 + pulse * 0.4;
  neon.lineStyle(2.5, THEME.electricCyan, a);
  neon.strokeRoundedRect(1, 1, w - 2, h - 2, 13);
  neon.lineStyle(1.5, THEME.emberOrange, a * 0.6);
  neon.strokeRoundedRect(3, 3, w - 6, h - 6, 11);
}

/** Static power-up guide. Kept as a tick hook for scene compatibility. */
export function tickGiftLegend(_handles: GiftLegendHandles, _time: number): void {
  // Intentionally static: no pulsing/blinking during gameplay.
}

export function setGiftLegendCompact(handles: GiftLegendHandles, compact: boolean): void {
  const fontSize = compact ? '14px' : '18px';
  handles.body.setFontSize(fontSize);
  handles.title.setFontSize(compact ? '20px' : '26px');
  const h = Math.ceil(handles.body.y + handles.body.height + 16);
  handles.height = h;
  drawGlassCard(handles.bg, handles.neon, handles.width, h, 0);
}
