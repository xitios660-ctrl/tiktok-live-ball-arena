/**
 * Premium TOP 5 leaderboard — glass dark card, gold header, medal rows.
 * Ticulinho palette + neon pulse. Homage only.
 */
import Phaser from 'phaser';
import type { PlayerStats } from '@arena/shared';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT, RANK_HEX } from '../theme';

const CARD_W = 340;
const HEADER_H = 42;
const ROW_H = 38;
const ROW_H_FIRST = 44;
const PAD = 10;
const RADIUS = 16;
const MAX_NAME = 12;

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'] as const;
const RANK_COLORS = [
  RANK_HEX.gold,
  RANK_HEX.silver,
  RANK_HEX.bronze,
  THEME_HEX.electricCyan,
  THEME_HEX.muted,
] as const;
const RANK_BORDER = [THEME.gold, 0xc0c7d4, 0xcd7f32, THEME.electricCyan, THEME.steel] as const;

export interface PremiumTop5Handles {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  neon: Phaser.GameObjects.Graphics;
  headerBg: Phaser.GameObjects.Graphics;
  headerTitle: Phaser.GameObjects.Text;
  headerCrown: Phaser.GameObjects.Text;
  emptyHint: Phaser.GameObjects.Text;
  rows: Top5Row[];
  width: number;
  height: number;
  born: number;
  lastIds: string[];
}

interface Top5Row {
  root: Phaser.GameObjects.Container;
  strip: Phaser.GameObjects.Graphics;
  flash: Phaser.GameObjects.Graphics;
  medalGfx: Phaser.GameObjects.Graphics;
  medal: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  kills: Phaser.GameObjects.Text;
  hpPip: Phaser.GameObjects.Graphics;
  status: Phaser.GameObjects.Text;
  userId: string | null;
  rank: number;
}

export function createPremiumTop5(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 100
): PremiumTop5Handles {
  const root = scene.add.container(x, y).setDepth(depth);
  const bg = scene.add.graphics();
  const neon = scene.add.graphics();
  const headerBg = scene.add.graphics();

  const headerCrown = scene.add
    .text(PAD + 4, PAD + 4, '👑', { fontSize: '22px' })
    .setOrigin(0, 0.5)
    .setY(PAD + HEADER_H / 2);

  const headerTitle = scene.add
    .text(PAD + 34, PAD + HEADER_H / 2, '◆  TOP 5', {
      fontFamily: FONT_ACCENT,
      fontSize: '26px',
      color: THEME_HEX.gold,
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0, 0.5);
  try {
    (headerTitle as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(2);
  } catch {
    /* ignore */
  }

  const emptyHint = scene.add
    .text(CARD_W / 2, HEADER_H + PAD + 28, '— aguardando —', {
      fontFamily: FONT,
      fontSize: '16px',
      color: THEME_HEX.muted,
    })
    .setOrigin(0.5)
    .setVisible(true);

  const rows: Top5Row[] = [];
  for (let i = 0; i < 5; i++) {
    rows.push(createRow(scene, i));
  }

  root.add([bg, neon, headerBg, headerCrown, headerTitle, emptyHint, ...rows.map((r) => r.root)]);

  const height = computeHeight(0);
  drawCard(bg, neon, headerBg, CARD_W, height, 0.5);

  return {
    root,
    bg,
    neon,
    headerBg,
    headerTitle,
    headerCrown,
    emptyHint,
    rows,
    width: CARD_W,
    height,
    born: scene.time.now,
    lastIds: [],
  };
}

function createRow(scene: Phaser.Scene, rank: number): Top5Row {
  const root = scene.add.container(PAD, 0).setVisible(false);
  const strip = scene.add.graphics();
  const flash = scene.add.graphics().setAlpha(0);
  const medalGfx = scene.add.graphics();
  drawMedalDisc(medalGfx, 18, 0, rank);
  const medal = scene.add
    .text(18, 0, rank < 3 ? String(rank + 1) : MEDALS[rank], {
      fontFamily: FONT_ACCENT,
      fontSize: rank === 0 ? '16px' : '14px',
      color: rank < 3 ? THEME_HEX.arenaDark : RANK_COLORS[rank],
      stroke: rank < 3 ? '#00000000' : '#000000',
      strokeThickness: rank < 3 ? 0 : 2,
    })
    .setOrigin(0.5);
  const name = scene.add
    .text(40, 0, '', {
      fontFamily: FONT_BLACK,
      fontSize: rank === 0 ? '18px' : '16px',
      color: RANK_COLORS[rank],
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0, 0.5);
  const kills = scene.add
    .text(CARD_W - PAD * 2 - 52, 0, '0', {
      fontFamily: FONT_ACCENT,
      fontSize: rank === 0 ? '22px' : '20px',
      color: THEME_HEX.light,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(1, 0.5);
  const hpPip = scene.add.graphics();
  const status = scene.add
    .text(CARD_W - PAD * 2 - 8, 0, '', {
      fontFamily: FONT,
      fontSize: '11px',
      color: THEME_HEX.muted,
    })
    .setOrigin(1, 0.5);

  root.add([strip, flash, medalGfx, medal, name, kills, hpPip, status]);
  return { root, strip, flash, medalGfx, medal, name, kills, hpPip, status, userId: null, rank };
}

/** Ornate medal discs for 1/2/3 (gold/silver/bronze) + simple laurel arcs. */
function drawMedalDisc(g: Phaser.GameObjects.Graphics, x: number, y: number, rank: number): void {
  g.clear();
  const colors = [THEME.gold, 0xc0c7d4, 0xcd7f32, THEME.electricCyan, THEME.steel];
  const c = colors[rank] ?? THEME.steel;
  const r = rank === 0 ? 15 : rank < 3 ? 13 : 11;

  // Soft glow
  g.fillStyle(c, rank === 0 ? 0.35 : 0.2);
  g.fillCircle(x, y, r + 5);

  // Disc
  g.fillStyle(c, 0.95);
  g.fillCircle(x, y, r);
  g.fillStyle(THEME.light, 0.25);
  g.fillCircle(x - r * 0.25, y - r * 0.3, r * 0.45);
  g.lineStyle(1.5, THEME.arenaDark, 0.45);
  g.strokeCircle(x, y, r);
  g.lineStyle(1, THEME.light, 0.35);
  g.strokeCircle(x, y, r - 3);

  // Laurel arcs for top 3
  if (rank < 3) {
    g.lineStyle(2, c, 0.75);
    g.beginPath();
    g.arc(x, y, r + 6, Math.PI * 0.55, Math.PI * 1.45, false);
    g.strokePath();
    g.beginPath();
    g.arc(x, y, r + 6, -Math.PI * 0.45, Math.PI * 0.45, false);
    g.strokePath();
    // Tiny leaf ticks
    g.lineStyle(1.5, c, 0.7);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = side < 0
          ? Math.PI * 0.7 + i * 0.28
          : -Math.PI * 0.3 + i * 0.28;
        const lx = x + Math.cos(a) * (r + 6);
        const ly = y + Math.sin(a) * (r + 6);
        g.lineBetween(lx, ly, lx + side * 4, ly - 3);
      }
    }
  }
}

function computeHeight(count: number): number {
  if (count <= 0) return HEADER_H + PAD * 2 + 36;
  let h = HEADER_H + PAD;
  for (let i = 0; i < count; i++) h += (i === 0 ? ROW_H_FIRST : ROW_H) + 4;
  return h + PAD;
}

function drawCard(
  bg: Phaser.GameObjects.Graphics,
  neon: Phaser.GameObjects.Graphics,
  headerBg: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pulse: number
): void {
  bg.clear();
  // Deep glass base
  bg.fillStyle(THEME.ink, 0.42);
  bg.fillRoundedRect(0, 0, w, h, RADIUS);
  // Soft inner gradient bands (layered rects)
  bg.fillStyle(THEME.card, 0.18);
  bg.fillRoundedRect(2, 2, w - 4, Math.min(h - 4, 56), RADIUS - 2);
  bg.fillStyle(0x000000, 0.10);
  bg.fillRoundedRect(3, HEADER_H + 4, w - 6, Math.max(0, h - HEADER_H - 8), 10);
  // Outer light edge
  bg.lineStyle(1.5, THEME.light, 0.22);
  bg.strokeRoundedRect(0, 0, w, h, RADIUS);
  bg.lineStyle(1, THEME.steel, 0.35);
  bg.strokeRoundedRect(2, 2, w - 4, h - 4, RADIUS - 2);
  // Gold left rail
  bg.lineStyle(3.5, THEME.gold, 0.95);
  bg.lineBetween(0, 12, 0, h - 12);
  // Soft gold underline under header
  bg.lineStyle(1, THEME.gold, 0.45);
  bg.lineBetween(14, HEADER_H + 2, w - 14, HEADER_H + 2);

  headerBg.clear();
  headerBg.fillStyle(THEME.gold, 0.12 + pulse * 0.06);
  headerBg.fillRoundedRect(6, 6, w - 12, HEADER_H - 4, 10);
  headerBg.lineStyle(1, THEME.gold, 0.35 + pulse * 0.25);
  headerBg.strokeRoundedRect(6, 6, w - 12, HEADER_H - 4, 10);

  neon.clear();
  const a = 0.3 + pulse * 0.4;
  neon.lineStyle(2.2, THEME.electricCyan, a);
  neon.strokeRoundedRect(1, 1, w - 2, h - 2, RADIUS - 1);
  neon.lineStyle(1, THEME.emberOrange, a * 0.55);
  neon.strokeRoundedRect(4, 4, w - 8, h - 8, RADIUS - 4);
  neon.lineStyle(1.5, THEME.gold, a * 0.45);
  neon.strokeRoundedRect(0, 0, w, h, RADIUS);
}

function drawRowStrip(
  strip: Phaser.GameObjects.Graphics,
  flash: Phaser.GameObjects.Graphics,
  rank: number,
  rowW: number,
  rowH: number,
  alive: boolean
): void {
  strip.clear();
  const border = RANK_BORDER[rank];
  const alphaFill = rank === 0 ? 0.22 : 0.12;
  strip.fillStyle(THEME.card, alive ? alphaFill : 0.12);
  strip.fillRoundedRect(0, -rowH / 2, rowW, rowH, rank === 0 ? 12 : 10);
  if (rank === 0) {
    strip.fillStyle(THEME.gold, 0.16);
    strip.fillRoundedRect(1, -rowH / 2 + 1, rowW - 2, rowH - 2, 11);
    strip.fillStyle(THEME.emberOrange, 0.08);
    strip.fillRoundedRect(2, -rowH / 2 + 2, rowW - 4, rowH - 4, 10);
  }
  strip.lineStyle(rank === 0 ? 2.2 : 1.4, border, alive ? (rank === 0 ? 0.95 : 0.65) : 0.3);
  strip.strokeRoundedRect(0, -rowH / 2, rowW, rowH, rank === 0 ? 12 : 10);

  flash.clear();
  flash.fillStyle(THEME.gold, 0.55);
  flash.fillRoundedRect(0, -rowH / 2, rowW, rowH, 10);
}

function drawHpPip(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ratio: number,
  alive: boolean
): void {
  g.clear();
  const w = 28;
  const h = 5;
  g.fillStyle(THEME.ink, 0.85);
  g.fillRoundedRect(x, y - h / 2, w, h, 2);
  if (!alive) {
    g.lineStyle(1, THEME.coral, 0.5);
    g.strokeRoundedRect(x, y - h / 2, w, h, 2);
    return;
  }
  const fill = Math.max(0, Math.min(1, ratio));
  const color = fill > 0.55 ? THEME.sage : fill > 0.25 ? THEME.gold : THEME.coral;
  g.fillStyle(color, 0.95);
  g.fillRoundedRect(x, y - h / 2, Math.max(2, w * fill), h, 2);
}

function truncateName(name: string, max = MAX_NAME): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

/** Update TOP 5 rows from snapshot; animates rows that changed rank. */
export function updatePremiumTop5(
  scene: Phaser.Scene,
  handles: PremiumTop5Handles,
  top5: PlayerStats[]
): void {
  const count = Math.min(5, top5.length);
  handles.height = computeHeight(count);
  const pulse = 0.5 + Math.sin((scene.time.now - handles.born) / 450) * 0.5;
  drawCard(handles.bg, handles.neon, handles.headerBg, CARD_W, handles.height, pulse);

  handles.emptyHint.setVisible(count === 0);

  const rowW = CARD_W - PAD * 2;
  let y = HEADER_H + PAD + 4;
  const newIds = top5.slice(0, 5).map((s) => s.userId);
  const prevIds = handles.lastIds;

  for (let i = 0; i < 5; i++) {
    const row = handles.rows[i];
    const stats = top5[i];
    const rowH = i === 0 ? ROW_H_FIRST : ROW_H;
    const cy = y + rowH / 2;

    if (!stats) {
      row.root.setVisible(false);
      row.userId = null;
      continue;
    }

    row.root.setVisible(true);
    row.root.setY(cy);
    row.rank = i;

    const alive = !!stats.alive;
    drawRowStrip(row.strip, row.flash, i, rowW, rowH - 4, alive);

    drawMedalDisc(row.medalGfx, 18, 0, i);
    row.medal.setText(i < 3 ? String(i + 1) : MEDALS[i]).setY(0);
    if (i < 3) row.medal.setColor(THEME_HEX.arenaDark);
    else row.medal.setColor(RANK_COLORS[i]);
    row.name
      .setText(truncateName(stats.username || stats.nickname || '?'))
      .setColor(alive ? RANK_COLORS[i] : THEME_HEX.muted)
      .setAlpha(alive ? 1 : 0.55);
    row.kills
      .setText(`☠${stats.kills}`)
      .setColor(i === 0 ? THEME_HEX.gold : THEME_HEX.light)
      .setAlpha(alive ? 1 : 0.5);

    const ratio = stats.maxHp > 0 ? stats.hp / stats.maxHp : 0;
    drawHpPip(row.hpPip, rowW - 88, 10, ratio, alive);

    row.status
      .setText(alive ? '' : '✕')
      .setColor(THEME_HEX.coral)
      .setAlpha(alive ? 0 : 0.85);

    // Entrance / rank-change flash
    const prevIdx = prevIds.indexOf(stats.userId);
    const moved = prevIds.length > 0 && (prevIdx !== i || row.userId !== stats.userId);
    if (moved || row.userId === null) {
      row.root.setX(PAD - 18);
      row.root.setAlpha(0.35);
      row.flash.setAlpha(0.55);
      scene.tweens.add({
        targets: row.root,
        x: PAD,
        alpha: 1,
        duration: 280,
        ease: 'Cubic.Out',
      });
      scene.tweens.add({
        targets: row.flash,
        alpha: 0,
        duration: 420,
        ease: 'Sine.Out',
      });
    } else {
      row.root.setX(PAD);
      row.root.setAlpha(1);
      row.flash.setAlpha(0);
    }

    row.userId = stats.userId;
    y += rowH + 4;
  }

  handles.lastIds = newIds;
}

/** Neon pulse — call each frame (cheap redraw of neon + header wash). */
export function tickPremiumTop5(handles: PremiumTop5Handles, time: number): void {
  const pulse = 0.5 + Math.sin((time - handles.born) / 450) * 0.5;
  drawCard(handles.bg, handles.neon, handles.headerBg, CARD_W, handles.height, pulse);
  handles.headerCrown.setAlpha(0.75 + pulse * 0.25);
  handles.headerTitle.setAlpha(0.9 + pulse * 0.1);
}
