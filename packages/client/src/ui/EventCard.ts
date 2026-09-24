/**
 * Cinematic event cards — glass slide-in banners for gifts, Cosmic Duel,
 * round moments, and big arena announcements. Client-only; OBS-safe.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '@arena/shared';
import { THEME, THEME_HEX, FONT_ACCENT, FONT } from '../theme';
import { SAFE } from '../overlayConfig';

export type EventCardTone =
  | 'duel'
  | 'gift'
  | 'round'
  | 'urgent'
  | 'power'
  | 'gold'
  | 'info';

export interface EventCardOpts {
  title: string;
  message: string;
  tone?: EventCardTone;
  /** Hold time before fade-out (ms). Default ~3200. */
  ttl?: number;
  /** Soft glow flash (skip on low FX budget). */
  glow?: boolean;
}

export interface EventCardHandles {
  root: Phaser.GameObjects.Container;
  /** Update the reusable card anchor without rebuilding it. */
  setPresentation: (x: number, y: number, rotation?: number) => void;
  /** Show a card; replaces any active card. */
  show: (opts: EventCardOpts) => void;
  /** Hide immediately. */
  hide: () => void;
  destroy: () => void;
}

const CARD_W = 720;
const CARD_H = 118;
const DEPTH = 305;

const TONE: Record<
  EventCardTone,
  { accent: number; accentHex: string; fill: number; title: string; icon: string }
> = {
  duel: {
    accent: THEME.gold,
    accentHex: THEME_HEX.gold,
    fill: 0x1a1410,
    title: THEME_HEX.gold,
    icon: '⚔',
  },
  gift: {
    accent: THEME.emberOrange,
    accentHex: THEME_HEX.emberOrange,
    fill: 0x1c1410,
    title: THEME_HEX.emberOrange,
    icon: '✦',
  },
  round: {
    accent: THEME.electricCyan,
    accentHex: THEME_HEX.electricCyan,
    fill: 0x10161c,
    title: THEME_HEX.electricCyan,
    icon: '▶',
  },
  urgent: {
    accent: THEME.arenaRed,
    accentHex: THEME_HEX.arenaRed,
    fill: 0x1c1010,
    title: THEME_HEX.arenaRed,
    icon: '!',
  },
  power: {
    accent: THEME.electricCyan,
    accentHex: THEME_HEX.electricCyan,
    fill: 0x10181c,
    title: THEME_HEX.electricCyan,
    icon: '⚡',
  },
  gold: {
    accent: THEME.gold,
    accentHex: THEME_HEX.gold,
    fill: 0x1c1610,
    title: THEME_HEX.gold,
    icon: '★',
  },
  info: {
    accent: THEME.light,
    accentHex: THEME_HEX.light,
    fill: THEME.stone,
    title: THEME_HEX.light,
    icon: '·',
  },
};

/** Map announce/kill kinds onto card title + tone. */
export function cardFromKind(
  kind: string | undefined,
  message: string
): EventCardOpts {
  const k = (kind || '').toLowerCase();
  switch (k) {
    case 'cosmic_duel':
      return { title: 'DUELO CÓSMICO', message, tone: 'duel', glow: true, ttl: 3800 };
    case 'galaxy':
      return { title: 'GALÁXIA', message, tone: 'duel', glow: true };
    case 'gift':
      return { title: 'PRESENTE', message, tone: 'gift', glow: true };
    case 'sugar_burst':
      return { title: 'EXPLOSÃO DOCE', message, tone: 'gift' };
    case 'pickup':
      return { title: 'POWER-UP', message, tone: 'power' };
    case 'last_minute':
      return { title: 'ÚLTIMO MINUTO', message, tone: 'urgent', glow: true, ttl: 3600 };
    case 'new_king':
      return { title: 'NOVO REI', message, tone: 'gold', glow: true, ttl: 3600 };
    case 'winner':
      return { title: 'VENCEDOR', message, tone: 'gold', glow: true, ttl: 4000 };
    case 'next_round':
      return { title: 'PRÓXIMA RODADA', message, tone: 'round', ttl: 3400 };
    case 'heal_rain':
      return { title: 'CHUVA DE CURA', message, tone: 'power' };
    case 'speed_storm':
      return { title: 'TEMPESTADE', message, tone: 'power', glow: true };
    case 'double_damage':
      return { title: 'DANO DUPLICADO', message, tone: 'urgent' };
    case 'likes_threshold':
      return { title: 'LIKES', message, tone: 'round' };
    case 'share_boost':
      return { title: 'BOOST', message, tone: 'power' };
    case 'strength_up':
      return { title: 'FORÇA+', message, tone: 'gold' };
    case 'stomp':
      return { title: 'STOMP', message, tone: 'urgent' };
    case 'shield_expire':
      return { title: 'ESCUDO', message, tone: 'info', ttl: 2600 };
    case 'eliminated':
      return { title: 'ELIMINADO', message, tone: 'urgent' };
    case 'respawn':
      return { title: 'RESPAWN', message, tone: 'round' };
    case 'revenge_respawn':
      return { title: 'REVANCHE', message, tone: 'gold', glow: true };
    case 'rivalry':
      return { title: 'RIVALIDADE', message, tone: 'urgent' };
    default:
      return { title: 'ARENA', message, tone: 'info' };
  }
}

/**
 * Create a reusable event-card overlay (top-center under the title chrome).
 */
export function createEventCard(
  scene: Phaser.Scene,
  y = SAFE.top + 210,
  depth = DEPTH
): EventCardHandles {
  let anchorX = CANVAS_WIDTH / 2;
  let anchorY = y;
  let anchorRotation = 0;
  const root = scene.add.container(anchorX, anchorY).setDepth(depth).setAlpha(0);
  root.setVisible(false);

  let hideTimer: Phaser.Time.TimerEvent | null = null;
  let activeTween: Phaser.Tweens.Tween | null = null;

  const clearTimers = () => {
    if (hideTimer) {
      hideTimer.remove(false);
      hideTimer = null;
    }
    if (activeTween) {
      activeTween.stop();
      activeTween = null;
    }
  };

  const rebuild = (opts: EventCardOpts) => {
    root.removeAll(true);
    const tone = TONE[opts.tone || 'info'];
    const title = (opts.title || 'ARENA').toUpperCase().slice(0, 22);
    const msg = (opts.message || '').slice(0, 72);

    const g = scene.add.graphics();
    // Outer glow wash
    g.fillStyle(tone.accent, 0.14);
    g.fillRoundedRect(-CARD_W / 2 - 8, -CARD_H / 2 - 8, CARD_W + 16, CARD_H + 16, 22);
    // Glass body
    g.fillStyle(THEME.arenaDark, 0.72);
    g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    g.fillStyle(tone.fill, 0.55);
    g.fillRoundedRect(-CARD_W / 2 + 2, -CARD_H / 2 + 2, CARD_W - 4, CARD_H - 4, 16);
    // Border
    g.lineStyle(2, tone.accent, 0.85);
    g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    g.lineStyle(1, THEME.light, 0.18);
    g.strokeRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 3, CARD_W - 6, CARD_H - 6, 15);
    // Left accent bar
    g.fillStyle(tone.accent, 0.95);
    g.fillRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 14, 5, CARD_H - 28, 3);
    // Top sheen
    g.fillStyle(THEME.light, 0.07);
    g.fillRoundedRect(-CARD_W / 2 + 14, -CARD_H / 2 + 6, CARD_W - 28, CARD_H * 0.34, 12);
    // Tiny corner gems
    g.fillStyle(tone.accent, 0.7);
    g.fillCircle(-CARD_W / 2 + 22, -CARD_H / 2 + 18, 2.5);
    g.fillCircle(CARD_W / 2 - 22, -CARD_H / 2 + 18, 2.5);

    const titleText = scene.add
      .text(0, -22, `${tone.icon}  ${title}`, {
        fontFamily: FONT_ACCENT,
        fontSize: '42px',
        color: tone.title,
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5);
    try {
      (titleText as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(4);
    } catch {
      /* ignore */
    }

    const bodyText = scene.add
      .text(0, 26, msg, {
        fontFamily: FONT,
        fontSize: '22px',
        color: THEME_HEX.light,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: { width: CARD_W - 56 },
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    root.add([g, titleText, bodyText]);

    if (opts.glow !== false) {
      const flare = scene.add
        .rectangle(0, 0, CARD_W - 20, CARD_H - 16, tone.accent, 0.22)
        .setOrigin(0.5);
      root.add(flare);
      scene.tweens.add({
        targets: flare,
        alpha: 0,
        scaleX: 1.04,
        scaleY: 1.12,
        duration: 520,
        ease: 'Cubic.Out',
        onComplete: () => flare.destroy(),
      });
    }
  };

  const show = (opts: EventCardOpts) => {
    clearTimers();
    rebuild(opts);
    root.setVisible(true);
    root.setAlpha(0);
    root.setScale(0.86);
    root.setRotation(anchorRotation);
    root.setPosition(anchorX, anchorY - 28);
    activeTween = scene.tweens.add({
      targets: root,
      alpha: 1,
      scale: 1,
      y: anchorY,
      duration: 340,
      ease: 'Back.Out',
    });
    const ttl = opts.ttl ?? 3200;
    hideTimer = scene.time.delayedCall(ttl, () => {
      scene.tweens.add({
        targets: root,
        alpha: 0,
        scale: 0.94,
        y: anchorY - 16,
        duration: 280,
        ease: 'Cubic.In',
        onComplete: () => {
          root.setVisible(false);
          root.removeAll(true);
        },
      });
    });
  };

  const hide = () => {
    clearTimers();
    root.setVisible(false);
    root.setAlpha(0);
    root.removeAll(true);
  };

  return {
    root,
    setPresentation(x: number, nextY: number, rotation = 0) {
      anchorX = x;
      anchorY = nextY;
      anchorRotation = rotation;
      root.setPosition(anchorX, anchorY);
      root.setRotation(anchorRotation);
    },
    show,
    hide,
    destroy() {
      clearTimers();
      root.destroy(true);
    },
  };
}
