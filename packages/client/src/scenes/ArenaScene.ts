import Phaser from 'phaser';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SOCKET_EVENTS,
  type RoundState,
  type ArenaLiveEvent,
  type GameSnapshot,
  type BallState,
  type CombatEvent,
  type PlayerStats,
  type WinnerInfo,
} from '@arena/shared';
import { audio } from '../audio/AudioManager';
import { getOverlayOptions, SAFE } from '../overlayConfig';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT } from '../theme';
import {
  playAbilityFx,
  spawnStrengthSparkles,
  spawnFreezeBurst,
  spawnDashBurst,
  spawnReflectActivate,
  tickBuffParticles,
} from '../fx/AbilityFx';
import { playKillImpact } from '../fx/KillImpactFx';
import { paintArenaFloor, paintArenaRim } from '../fx/ArenaFloor';
import {
  createGlossParts,
  syncGlossParts,
  skinFromBall,
  type GlossSkin,
} from '../fx/GlossBall';
import {
  createCinematicTitle,
  setPhaseChrome,
  tickCinematicHud,
  createAmbientTwinkles,
  createAoVivoPill,
  createBottomCtaStrip,
  type CinematicHudHandles,
} from '../ui/CinematicHud';
import { fxScaleFromBudget, qualityFromBudget, type QualityTier } from '../fx/QualityTier';
import { createGiftLegend, tickGiftLegend, type GiftLegendHandles } from '../ui/GiftLegend';
import {
  createPremiumTop5,
  updatePremiumTop5,
  tickPremiumTop5,
  type PremiumTop5Handles,
} from '../ui/PremiumTop5';
import { PickupsLayer } from '../ui/PickupsLayer';
import {
  pushNeonKillFeed,
  tickNeonKillFeed,
  toneFromColors,
  type NeonFeedItem,
} from '../ui/NeonKillFeed';
import { createEventCard, cardFromKind, type EventCardHandles } from '../ui/EventCard';

interface BallView {
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  aura: Phaser.GameObjects.Arc;
  shieldRing: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  gloss: Phaser.GameObjects.Image;
  crownGfx: Phaser.GameObjects.Graphics;
  glossKey: string;
  skin: GlossSkin;
  avatar?: Phaser.GameObjects.Image;
  /** Soft rim glow behind circular avatar */
  avatarGlow?: Phaser.GameObjects.Arc;
  /** Premium ring stroked around avatar */
  avatarRing?: Phaser.GameObjects.Graphics;
  /** Source texture key before circular bake */
  avatarSrcKey?: string;
  initials: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  /** Glass pill behind name */
  namePlate: Phaser.GameObjects.Graphics;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  shieldFg: Phaser.GameObjects.Rectangle;
  revengeMark: Phaser.GameObjects.Text;
  buffIcon: Phaser.GameObjects.Text;
  strengthMark: Phaser.GameObjects.Text;
  lastHp: number;
  lastHealFlash: boolean;
  lastStrengthTier: number;
  prevX: number;
  prevY: number;
  lastBuffFxAt: number;
  hadFreeze: boolean;
  hadReflect: boolean;
  hadDash: boolean;
}

export class ArenaScene extends Phaser.Scene {
  private timerText!: Phaser.GameObjects.Text;
  private timerGlow!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private premiumTop5!: PremiumTop5Handles;
  private titleText!: Phaser.GameObjects.Text;
  private cinematicHud!: CinematicHudHandles;
  private giftLegend!: GiftLegendHandles;
  private giftLegendBaseY = 0;
  private top5BaseY = 0;
  private pickupsLayer!: PickupsLayer;
  private ambientTwinkles: { tick: (t: number) => void; destroy: () => void } | null = null;
  private feedText!: Phaser.GameObjects.Text;
  private feedCard!: Phaser.GameObjects.Graphics;
  private winnerFrame!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private bigCountdown!: Phaser.GameObjects.Text;
  private winnerPanel!: Phaser.GameObjects.Container;
  private winnerTitle!: Phaser.GameObjects.Text;
  private winnerBody!: Phaser.GameObjects.Text;
  private resultsHint!: Phaser.GameObjects.Text;
  private border!: Phaser.GameObjects.Rectangle;
  private arenaFloor!: Phaser.GameObjects.Graphics;
  private arenaRim!: Phaser.GameObjects.Graphics;
  private rimSpin = 0;
  private overlayTransparent = false;
  private feed: string[] = [];
  private ballsLayer!: Phaser.GameObjects.Container;
  private killFeedLayer!: Phaser.GameObjects.Container;
  private views = new Map<string, BallView>();
  private pendingAvatars = new Set<string>();
  private killFeed: NeonFeedItem[] = [];
  private toastUntil = 0;
  private eventCard: EventCardHandles | null = null;
  private intensity = false;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private particleBudget = 1;
  private qualityTier: QualityTier = 'high';
  private aoVivoPill: Phaser.GameObjects.Container | null = null;
  private bottomCta: { root: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics; setVisible: (v: boolean) => void } | null = null;
  private muteBtn!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private likesText!: Phaser.GameObjects.Text;
  private lastRemaining = 300;
  private lastPhase = 'waiting';

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    const top = SAFE.top;
    const side = SAFE.side;
    const bottom = SAFE.bottom;

    // Glossy arena floor (skip opaque fills in OBS transparent mode)
    this.overlayTransparent = !!opts.transparent;
    this.arenaFloor = this.add.graphics().setDepth(0);
    paintArenaFloor(this.arenaFloor, CANVAS_WIDTH, CANVAS_HEIGHT, this.overlayTransparent);
    this.ambientTwinkles = createAmbientTwinkles(this, 16, 1);
    // Legacy border rect kept for layout hooks; stroke owned by arenaRim Graphics
    this.border = this.add
      .rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 16, THEME.card, 0)
      .setStrokeStyle(0)
      .setDepth(2);
    this.arenaRim = this.add.graphics().setDepth(3);
    this.rimSpin = 0;
    paintArenaRim(this.arenaRim, CANVAS_WIDTH, CANVAS_HEIGHT, this.rimSpin, false);

    // Cinematic title treatment (BallArenaLogo crown+stars+rings)
    this.cinematicHud = createCinematicTitle(this, CANVAS_WIDTH / 2, top + 28, 100);
    this.titleText = this.cinematicHud.titleMain;
    setPhaseChrome(this.cinematicHud, data?.round?.phase ?? 'waiting', data?.round?.remainingSec, this);
    this.syncBottomCta(data?.round?.phase ?? 'waiting');

    // Red AO VIVO pill — top-left chrome
    this.aoVivoPill = createAoVivoPill(this, side + 56, top + 20, 110);
    this.cinematicHud.livePill = this.aoVivoPill;

    // Timer glow (behind) + main timer
    this.timerGlow = this.add
      .text(CANVAS_WIDTH / 2, top + 118, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: FONT_ACCENT,
        fontSize: '72px',
        color: THEME_HEX.electricCyan,
      })
      .setOrigin(0.5)
      .setDepth(99)
      .setAlpha(0.28);
    this.timerText = this.add
      .text(CANVAS_WIDTH / 2, top + 118, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: FONT_ACCENT,
        fontSize: '66px',
        color: THEME_HEX.electricCyan,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.playersText = this.add
      .text(CANVAS_WIDTH / 2, top + 178, `PLAYERS NA ARENA: ${data?.round?.playerCount ?? 0}`, {
        fontFamily: FONT_ACCENT,
        fontSize: '26px',
        color: THEME_HEX.electricCyan,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Bottom CTA strip — waiting/countdown only (hidden while running)
    this.bottomCta = createBottomCtaStrip(this, CANVAS_HEIGHT - SAFE.bottom + 36, 105);
    const initPhase = data?.round?.phase ?? 'waiting';
    this.bottomCta.setVisible(initPhase === 'waiting' || initPhase === 'countdown');

    // Likes meter — pill
    this.likesText = this.add
      .text(side, top + 16, '❤️  0 / 100', {
        fontFamily: FONT_ACCENT,
        fontSize: '24px',
        color: THEME_HEX.arenaRed,
        backgroundColor: '#1E1A16aa',
        padding: { x: 12, y: 6 },
      })
      .setDepth(200)
      .setScrollFactor(0);

    // Premium TOP 5 leaderboard (left)
    this.top5BaseY = top + 200;
    this.premiumTop5 = createPremiumTop5(this, side, this.top5BaseY, 100);

    // Gift gabarito — right side (opposite TOP5; kill feed stays bottom-right)
    const legendW = 318;
    this.giftLegendBaseY = top + 200;
    this.giftLegend = createGiftLegend(this, CANVAS_WIDTH - side - legendW, this.giftLegendBaseY, {
      compact: true,
      maxWidth: legendW,
      depth: 95,
    });

    // Floor pickups layer (under balls)
    this.pickupsLayer = new PickupsLayer(this, 8);

    this.toastText = this.add
      .text(CANVAS_WIDTH / 2, top + 250, '', {
        fontFamily: FONT_ACCENT,
        fontSize: '36px',
        color: THEME_HEX.gold,
        backgroundColor: '#1E1A16dd',
        padding: { x: 24, y: 14 },
        align: 'center',
        stroke: THEME_HEX.arenaRed,
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    // Cinematic glass event cards (gifts / duel / round / big moments)
    this.eventCard = createEventCard(this, top + 248, 305);

    this.bigCountdown = this.add
      .text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '', {
        fontFamily: FONT_ACCENT,
        fontSize: '280px',
        color: THEME_HEX.arenaRed,
        stroke: THEME_HEX.light,
        strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setDepth(250)
      .setAlpha(0);

    this.ballsLayer = this.add.container(0, 0).setDepth(10);
    this.killFeedLayer = this.add.container(0, 0).setDepth(200);

    // Event feed — glass card matching TOP5 language
    this.feedCard = this.add.graphics().setDepth(99);
    this.feedText = this.add
      .text(side + 12, CANVAS_HEIGHT - bottom - 118, '', {
        fontFamily: FONT,
        fontSize: '17px',
        color: THEME_HEX.cream,
        padding: { x: 4, y: 4 },
        wordWrap: { width: CANVAS_WIDTH - side * 2 - 56 },
        lineSpacing: 4,
      })
      .setDepth(100);
    this.redrawFeedCard();

    // Winner panel (hidden) — premium gold-framed glass card
    this.winnerPanel = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).setDepth(400).setAlpha(0);
    this.winnerFrame = this.add.graphics();
    this.drawWinnerFrame(this.winnerFrame, 860, 700);
    this.winnerTitle = this.add
      .text(0, -268, '★ REI DA ARENA ★', {
        fontFamily: FONT_ACCENT,
        fontSize: '58px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.winnerBody = this.add
      .text(0, -10, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: THEME_HEX.cream,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);
    this.resultsHint = this.add
      .text(0, 292, 'Próxima rodada em …', {
        fontFamily: FONT_BLACK,
        fontSize: '26px',
        color: THEME_HEX.teal,
      })
      .setOrigin(0.5);
    this.winnerPanel.add([this.winnerFrame, this.winnerTitle, this.winnerBody, this.resultsHint]);

    // FPS only in ?debug=1
    this.fpsText = this.add
      .text(CANVAS_WIDTH - side, top, '60 fps', {
        fontFamily: FONT,
        fontSize: '18px',
        color: THEME_HEX.muted,
      })
      .setOrigin(1, 0)
      .setDepth(200)
      .setVisible(opts.debug);

    // Mute — smaller / less prominent in clean (non-debug) mode
    const muteSize = opts.debug ? '36px' : '26px';
    this.muteBtn = this.add
      .text(CANVAS_WIDTH - side, top + (opts.debug ? 32 : 8), '🔊', {
        fontFamily: FONT,
        fontSize: muteSize,
      })
      .setOrigin(1, 0)
      .setDepth(200)
      .setAlpha(opts.debug ? 1 : 0.7)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      const m = audio.toggleMute();
      this.muteBtn.setText(m ? '🔇' : '🔊');
      audio.ensure();
    });

    if (opts.demoBadge) {
      this.add
        .text(CANVAS_WIDTH - side, top + (opts.debug ? 72 : 48), 'DEMO', {
          fontFamily: FONT_BLACK,
          fontSize: '14px',
          color: THEME_HEX.coral,
          backgroundColor: '#1E1E1Eaa',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(1, 0)
        .setDepth(200)
        .setAlpha(0.85);
    }

    // Soft safe-area guides only in debug
    if (opts.debug) {
      const g = this.add.graphics().setDepth(5).setAlpha(0.35);
      g.lineStyle(2, THEME.teal, 1);
      g.strokeRect(side, top, CANVAS_WIDTH - side * 2, CANVAS_HEIGHT - top - bottom);
      this.add
        .text(side + 4, top + 4, 'safe', {
          fontFamily: FONT,
          fontSize: '14px',
          color: THEME_HEX.teal,
        })
        .setDepth(6)
        .setAlpha(0.6);
    }

    // Unlock audio on first tap anywhere
    this.input.once('pointerdown', () => audio.ensure());

    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.game.events.on(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    this.game.events.on(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
    this.game.events.on(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.game.events.off(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
      this.game.events.off(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
      this.game.events.off(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);
      this.views.clear();
      this.pickupsLayer?.clear();
      this.ambientTwinkles?.destroy();
      this.ambientTwinkles = null;
    });
  }

  update(_time: number, delta: number): void {
    this.trackFps(delta);
    const now = Date.now();
    const t = this.time.now;
    if (this.cinematicHud) tickCinematicHud(this.cinematicHud, t);
    if (this.bottomCta && this.bottomCta.root.visible) {
      const pulse = 0.5 + Math.sin(t / 350) * 0.5;
      this.bottomCta.root.setScale(1 + pulse * 0.02);
      this.bottomCta.glow.setAlpha(0.35 + pulse * 0.4);
    }
    if (this.ambientTwinkles && (this.particleBudget ?? 1) > 0.2) this.ambientTwinkles.tick(t);
    this.pickupsLayer?.tick(t);
    if (this.giftLegend) {
      tickGiftLegend(this.giftLegend, t);
      const bob = Math.sin(t / 900) * 3;
      this.giftLegend.root.y = this.giftLegendBaseY + bob;
    }
    if (this.premiumTop5) {
      const bob = Math.sin(t / 1100 + 1.2) * 2.5;
      this.premiumTop5.root.y = this.top5BaseY + bob;
      tickPremiumTop5(this.premiumTop5, t);
    }
    this.killFeed = tickNeonKillFeed(this.killFeed, now);

    if (this.toastUntil && now > this.toastUntil) {
      this.toastText.setAlpha(0);
      this.toastUntil = 0;
    }
    // EventCard manages its own fade timer

    this.rimSpin += delta * 0.04;
    const urgent = this.lastPhase === 'running' && this.lastRemaining <= 30;
    if (this.arenaRim) {
      paintArenaRim(this.arenaRim, CANVAS_WIDTH, CANVAS_HEIGHT, this.rimSpin, urgent);
    }
  }

  private onRound = (state: RoundState) => {
    this.applyTimerVisuals(state.remainingSec, state.phase);
    this.playersText.setText(`PLAYERS NA ARENA: ${state.playerCount ?? 0}`);
    if (state.phase === 'results') {
      this.resultsHint.setText(`Próxima rodada em ${state.resultsRemainingSec ?? 0}s`);
    }
  };

  private onLive = (event: ArenaLiveEvent) => {
    let line = `${event.type}`;
    if (event.type === 'gift') line = `🎁 ${event.user.username} → ${event.giftName}`;
    else if (event.type === 'comment') line = `💬 ${event.user.username}: ${event.comment}`;
    else if (event.type === 'join') line = `👋 ${event.user.username}`;
    this.feed.unshift(line);
    this.feed = this.feed.slice(0, 5);
    this.feedText.setText(this.feed.join('\n'));
    this.redrawFeedCard();
  };

  private onSnapshot = (snap: GameSnapshot) => {
    this.applyTimerVisuals(snap.remainingSec, snap.phase);
    this.playersText.setText(`PLAYERS NA ARENA: ${snap.playerCount}`);
    this.syncBalls(snap.balls);
    this.pickupsLayer?.sync(snap.pickups);
    if (snap.global && this.likesText) {
      const g = snap.global;
      this.likesText.setText(`❤️  ${g.likesAccumulated} / ${g.likesThreshold}` + (g.activeEffect ? `  ·  ${g.activeEffect}` : ''));
    }
    updatePremiumTop5(this, this.premiumTop5, snap.top5 || snap.stats.slice(0, 5));

    if (snap.phase === 'results') {
      this.showWinner(snap.winner, snap.resultsRemainingSec ?? 0, snap.top5);
    } else {
      this.hideWinner();
    }
  };

  private onCombat = (event: CombatEvent) => {
    if (event.type === 'ability_fx') {
      playAbilityFx(this, event, this.particleBudget ?? 1);
      return;
    }
    if (event.type === 'hit') {
      this.spawnHitSparks(event.x, event.y, THEME.cream);
      audio.play('collision', { intensity: Math.min(1, (event.damage || 8) / 28) });
    } else if (event.type === 'kill') {
      const revenge = !!event.isRevenge;
      this.pushKillFeed(event.message, revenge ? THEME_HEX.gold : THEME_HEX.cream, revenge ? '#5c2020ee' : '#FF6B6Bcc');
      // Lighter hit sparks — KillImpactFx adds smoke/rings/callout + modest embers
      this.spawnHitSparks(event.x, event.y, revenge ? THEME.gold : THEME.coral, 10);
      this.spawnDeathFlash(event.x, event.y, revenge);
      audio.play(revenge ? 'revenge' : 'death');
      if (revenge) this.showToast(event.message, 'revenge_respawn');
    } else if (event.type === 'announce') {
      if (event.kind === 'countdown' && event.value != null) {
        this.showBigCountdown(event.value);
        audio.play('countdown');
      } else if (event.kind === 'last_minute') {
        this.showToast('ÚLTIMO MINUTO!', 'last_minute');
        this.pushKillFeed(event.message, THEME_HEX.coral, '#1E1E1Ecc');
      } else if (event.kind === 'new_king') {
        this.showToast(event.message, event.kind);
        this.pushKillFeed(event.message, THEME_HEX.gold, '#3d2e10ee');
      } else if (event.kind === 'winner' || event.kind === 'next_round') {
        this.showToast(event.message, event.kind);
        this.pushKillFeed(event.message, THEME_HEX.gold, '#1E1E1Ecc');
        if (event.kind === 'winner') audio.play('victory');
      } else if (event.kind === 'pickup') {
        this.showToast(event.message, event.kind);
        this.pushKillFeed(event.message, THEME_HEX.teal, '#1a3040ee');
        audio.play('gift');
      } else if (
        event.kind === 'gift' ||
        event.kind === 'galaxy' ||
        event.kind === 'cosmic_duel' ||
        event.kind === 'sugar_burst' ||
        event.kind === 'stomp' ||
        event.kind === 'shield_expire'
      ) {
        this.showToast(event.message, event.kind);
        const feedColor =
          event.kind === 'cosmic_duel'
            ? THEME_HEX.gold
            : event.kind === 'shield_expire'
              ? THEME_HEX.muted
              : THEME_HEX.lavender;
        this.pushKillFeed(event.message, feedColor, '#2a2040ee');
        if (event.kind !== 'shield_expire') audio.play('gift');
      } else if (
        event.kind === 'heal_rain' ||
        event.kind === 'speed_storm' ||
        event.kind === 'double_damage' ||
        event.kind === 'likes_threshold' ||
        event.kind === 'share_boost'
      ) {
        this.showToast(event.message, event.kind);
        this.pushKillFeed(event.message, THEME_HEX.sage, '#1a3d2aee');
        if (event.kind === 'speed_storm') audio.play('speed_storm');
        else if (event.kind === 'share_boost') audio.play('share');
        else audio.play('heal_rain');
      } else if (event.kind === 'strength_up') {
        this.showToast(event.message, event.kind);
        this.pushKillFeed(event.message, THEME_HEX.gold, '#3d2e10ee');
        if (event.userId) {
          const view = this.views.get(event.userId);
          if (view) {
            spawnStrengthSparkles(this, view.container.x, view.container.y, this.particleBudget ?? 1);
          }
        }
      } else {
        this.pushKillFeed(event.message, THEME_HEX.gold, '#1E1E1Ecc');
        if (event.kind === 'respawn' || event.kind === 'revenge_respawn' || event.kind === 'eliminated') {
          this.showToast(event.message, event.kind);
          if (event.kind === 'respawn' || event.kind === 'revenge_respawn') audio.play('respawn');
          if (event.kind === 'revenge_respawn') audio.play('revenge');
        }
      }
    }
  };

  private applyTimerVisuals(remaining: number, phase: string): void {
    const label = this.formatTime(remaining);
    this.timerText.setText(label);
    if (this.timerGlow) this.timerGlow.setText(label);
    this.lastPhase = phase;
    if (this.cinematicHud) setPhaseChrome(this.cinematicHud, phase, remaining, this);
    this.syncBottomCta(phase);
    if (phase === 'results') {
      this.timerText.setColor(THEME_HEX.gold).setFontSize('68px');
      this.timerText.setText('RESULTADOS');
      if (this.timerGlow) {
        this.timerGlow.setText('RESULTADOS').setColor(THEME_HEX.gold).setFontSize('74px');
      }
      this.intensity = false;
      return;
    }
    if (remaining <= 30) {
      this.intensity = true;
      const size = remaining <= 10 ? '88px' : '72px';
      this.timerText.setColor(THEME_HEX.arenaRed).setFontSize(size);
      if (this.timerGlow) this.timerGlow.setColor(THEME_HEX.arenaRed).setFontSize(size).setAlpha(0.45);
      if (remaining <= 10 && this.titleText) this.titleText.setColor(THEME_HEX.arenaRed);
    } else if (remaining <= 60) {
      this.intensity = false;
      this.timerText.setColor(THEME_HEX.gold).setFontSize('68px');
      if (this.timerGlow) this.timerGlow.setColor(THEME_HEX.gold).setFontSize('74px').setAlpha(0.3);
      if (this.titleText) this.titleText.setColor(THEME_HEX.light);
    } else {
      this.intensity = false;
      this.timerText.setColor(THEME_HEX.electricCyan).setFontSize('66px');
      if (this.timerGlow) this.timerGlow.setColor(THEME_HEX.electricCyan).setFontSize('72px').setAlpha(0.25);
      if (this.border) this.border.setStrokeStyle(0);
      if (this.titleText) this.titleText.setColor(THEME_HEX.light);
    }
    this.lastRemaining = remaining;
  }

  private showBigCountdown(n: number): void {
    this.bigCountdown.setText(String(n));
    this.bigCountdown.setColor(n <= 3 ? THEME_HEX.arenaRed : THEME_HEX.light);
    this.bigCountdown.setStroke(n <= 3 ? THEME_HEX.gold : THEME_HEX.light, n <= 3 ? 18 : 14);
    this.bigCountdown.setAlpha(1).setScale(0.28);
    this.tweens.add({
      targets: this.bigCountdown,
      scale: n <= 3 ? 1.55 : 1.35,
      alpha: 0,
      duration: n <= 3 ? 1000 : 900,
      ease: 'Cubic.easeOut',
    });
  }

  private redrawFeedCard(): void {
    if (!this.feedCard || !this.feedText) return;
    const pad = 10;
    const tw = Math.max(180, this.feedText.width + pad * 2);
    const th = Math.max(28, this.feedText.height + pad * 2);
    const x = this.feedText.x - 8;
    const y = this.feedText.y - 8;
    const g = this.feedCard;
    g.clear();
    if (!this.feed.length) return;
    g.fillStyle(THEME.stone, 0.55);
    g.fillRoundedRect(x, y, tw, th, 12);
    g.lineStyle(1.5, THEME.light, 0.2);
    g.strokeRoundedRect(x, y, tw, th, 12);
    g.lineStyle(2.5, THEME.electricCyan, 0.55);
    g.lineBetween(x, y + 8, x, y + th - 8);
    g.lineStyle(1, THEME.emberOrange, 0.3);
    g.strokeRoundedRect(x + 2, y + 2, tw - 4, th - 4, 10);
  }

  private drawWinnerFrame(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    g.clear();
    const hw = w / 2;
    const hh = h / 2;
    // Deep glass fill
    g.fillStyle(THEME.ink, 0.96);
    g.fillRoundedRect(-hw, -hh, w, h, 28);
    g.fillStyle(THEME.card, 0.35);
    g.fillRoundedRect(-hw + 8, -hh + 8, w - 16, 90, 20);
    // Gold outer frame (layered)
    g.lineStyle(8, THEME.gold, 0.95);
    g.strokeRoundedRect(-hw, -hh, w, h, 28);
    g.lineStyle(3, THEME.light, 0.45);
    g.strokeRoundedRect(-hw + 8, -hh + 8, w - 16, h - 16, 22);
    g.lineStyle(2, THEME.electricCyan, 0.35);
    g.strokeRoundedRect(-hw + 14, -hh + 14, w - 28, h - 28, 18);
    // Arena Red / Cyan accent rails
    g.fillStyle(THEME.arenaRed, 1);
    g.fillRoundedRect(-hw + 24, -hh + 4, w - 48, 10, 4);
    g.fillStyle(THEME.electricCyan, 1);
    g.fillRoundedRect(-hw + 24, hh - 14, w - 48, 10, 4);
    // Corner jewels
    for (const [cx, cy] of [
      [-hw + 28, -hh + 28],
      [hw - 28, -hh + 28],
      [-hw + 28, hh - 28],
      [hw - 28, hh - 28],
    ] as const) {
      g.fillStyle(THEME.gold, 0.95);
      g.fillCircle(cx, cy, 6);
      g.fillStyle(THEME.light, 0.7);
      g.fillCircle(cx, cy, 2.5);
    }
  }

  private showWinner(winner: WinnerInfo | null, resultsLeft: number, top5: PlayerStats[]): void {
    this.winnerPanel.setAlpha(1);
    if (winner) {
      this.winnerTitle.setText('🏆 REI DA ARENA');
      this.winnerBody.setText(
        [
          `@${winner.nickname || winner.username}`,
          '',
          `☠  ${winner.kills} kills`,
          `💀  ${winner.deaths} deaths`,
          `💥  ${winner.damageDealt} dano`,
          `⚡  vel ${Math.round(winner.highestSpeed)}`,
          '',
          '— RANKING —',
          ...top5.slice(0, 5).map((s, i) =>
            `${i === 0 ? '👑' : '#' + (i + 1)}  ${s.username}   ☠${s.kills}  💀${s.deaths}`
          ),
        ].join('\n')
      );
    } else {
      this.winnerTitle.setText('FIM DA RODADA');
      this.winnerBody.setText('Nenhum vencedor');
    }
    this.resultsHint.setText(`▶  Próxima rodada em ${resultsLeft}s`);
  }

  private hideWinner(): void {
    this.winnerPanel.setAlpha(0);
  }

  private showToast(msg: string, kind?: string): void {
    if (this.eventCard) {
      this.eventCard.show(cardFromKind(kind, msg));
      return;
    }
    this.toastText.setText(msg);
    this.toastText.setAlpha(1).setScale(0.85);
    this.toastUntil = Date.now() + 3400;
    this.tweens.add({
      targets: this.toastText,
      scale: 1,
      duration: 280,
      ease: 'Back.Out',
    });
  }

  private pushKillFeed(message: string, color: string = THEME_HEX.cream, bg: string = '#ff5a36cc'): void {
    pushNeonKillFeed(this, this.killFeedLayer, this.killFeed, message, toneFromColors(color, bg));
  }

  private spawnHitSparks(x: number, y: number, color: number, n = 8): void {
    const scale = fxScaleFromBudget(this.particleBudget ?? 1);
    n = Math.max(1, Math.floor(n * scale.sparks));
    // Brighter ember/gold impacto burst (style-guide) — core flash + sparks
    const flash = this.add.circle(x, y, 10 * scale.sparkSize, THEME.light, 0.7).setDepth(51);
    this.tweens.add({
      targets: flash,
      scale: 2.4,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy(),
    });
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const dist = 24 + Math.random() * 52;
      const c =
        i % 3 === 0 ? THEME.gold : i % 3 === 1 ? THEME.emberOrange : color;
      const dot = this.add
        .circle(x, y, (3.5 + Math.random() * 5) * scale.sparkSize, c, 1)
        .setDepth(50);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 300 + Math.random() * 220,
        onComplete: () => dot.destroy(),
      });
    }
    // Short impact lines
    if (scale.sparks > 0.4) {
      const lines = this.add.graphics().setDepth(50);
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.2;
        lines.lineStyle(2, THEME.gold, 0.85);
        lines.lineBetween(
          x + Math.cos(a) * 8,
          y + Math.sin(a) * 8,
          x + Math.cos(a) * 28,
          y + Math.sin(a) * 28
        );
      }
      this.tweens.add({
        targets: lines,
        alpha: 0,
        duration: 200,
        onComplete: () => lines.destroy(),
      });
    }
  }

  private spawnDeathFlash(x: number, y: number, revenge = false): void {
    playKillImpact(this, x, y, {
      revenge,
      budget: this.particleBudget ?? 1,
    });
  }

  private syncBalls(balls: BallState[]): void {
    const seen = new Set<string>();
    for (const b of balls) {
      seen.add(b.id);
      let view = this.views.get(b.id);
      if (!view) {
        view = this.createBallView(b);
        this.views.set(b.id, view);
        this.ballsLayer.add(view.container);
      }
      this.updateBallView(view, b);
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.container.destroy(true);
        this.views.delete(id);
      }
    }
  }

  private createBallView(b: BallState): BallView {
    const container = this.add.container(b.x, b.y);
    const glossParts = createGlossParts(this, b);
    const aura = this.add.circle(0, 0, b.radius + 14, 0x7cfc00, 0).setStrokeStyle(5, 0x7cfc00, 0);
    const shieldRing = this.add.circle(0, 0, b.radius + 8, 0xff9f1c, 0).setStrokeStyle(3, 0xff9f1c, 0);
    const ring = this.add.circle(0, 0, b.radius + 3, THEME.cream, 0).setStrokeStyle(4, THEME.cream, 0.55);
    // Arc keeps stroke/outline only — fill comes from glossy texture
    const circle = this.add.circle(0, 0, b.radius, b.color, 0);
    circle.setStrokeStyle(3, THEME.cream, 0.9);

    const initials = this.add
      .text(0, 0, this.getInitials(b.label), {
        fontFamily: FONT_BLACK,
        fontSize: `${Math.floor(b.radius * 0.72)}px`,
        color: THEME_HEX.cream,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const namePlate = this.add.graphics();
    const label = this.add
      .text(0, b.radius + 18, this.truncate(b.label, 14), {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: '700',
        color: THEME_HEX.light,
        stroke: '#0B0B0F',
        strokeThickness: 4,
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 0);

    const barW = Math.max(48, b.radius * 2.25);
    const hpY = -b.radius - 18;
    const hpBg = this.add
      .rectangle(0, hpY, barW, 16, THEME.ink, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(2, THEME.gold, 0.35);
    const hpFg = this.add.rectangle(-barW / 2, hpY, barW, 12, THEME.sage).setOrigin(0, 0.5);
    const shieldFg = this.add.rectangle(-barW / 2, hpY - 14, 0, 6, 0xff9f1c).setOrigin(0, 0.5);

    const revengeMark = this.add
      .text(b.radius * 0.65, -b.radius - 8, '🎯', { fontSize: '26px' })
      .setOrigin(0.5)
      .setVisible(false);

    const buffIcon = this.add
      .text(0, b.radius + 40, '', { fontSize: '20px' })
      .setOrigin(0.5, 0);

    const strengthMark = this.add
      .text(0, -b.radius - 28, '', {
        fontFamily: FONT_BLACK,
        fontSize: '14px',
        color: THEME_HEX.gold,
        backgroundColor: '#14110ecc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    // Order: shadow → aura/shield/ring → circle → gloss → avatar chrome → initials → HUD → crown
    container.add([
      glossParts.shadow,
      aura,
      shieldRing,
      ring,
      circle,
      glossParts.gloss,
      initials,
      hpBg,
      hpFg,
      shieldFg,
      namePlate,
      label,
      revengeMark,
      buffIcon,
      strengthMark,
      glossParts.crownGfx,
    ]);
    this.drawNamePlate(namePlate, label, b.radius);

    const view: BallView = {
      container,
      circle,
      ring,
      aura,
      shieldRing,
      shadow: glossParts.shadow,
      gloss: glossParts.gloss,
      crownGfx: glossParts.crownGfx,
      glossKey: glossParts.glossKey,
      skin: glossParts.skin,
      initials,
      label,
      namePlate,
      hpBg,
      hpFg,
      shieldFg,
      revengeMark,
      buffIcon,
      strengthMark,
      lastHp: b.hp,
      lastHealFlash: false,
      lastStrengthTier: 0,
      prevX: b.x,
      prevY: b.y,
      lastBuffFxAt: 0,
      hadFreeze: false,
      hadReflect: false,
      hadDash: false,
    };
    if (b.avatarUrl) this.tryLoadAvatar(b, view);
    return view;
  }

  private updateBallView(view: BallView, b: BallState): void {
    // Speed trails (rastro) — stronger when particleBudget / quality tier high
    const dx = b.x - view.prevX;
    const dy = b.y - view.prevY;
    const dist2 = dx * dx + dy * dy;
    const trailScale = fxScaleFromBudget(this.particleBudget ?? 1);
    if (dist2 > 18 * 18 && trailScale.trails > 0.15) {
      const ghosts = 1 + trailScale.trailGhosts;
      for (let g = 0; g < ghosts; g++) {
        const t = (g + 1) / (ghosts + 1);
        const gx = view.prevX + dx * (1 - t);
        const gy = view.prevY + dy * (1 - t);
        const ghost = this.add
          .circle(gx, gy, b.radius * (0.9 - g * 0.12), b.color, trailScale.trailAlpha * (1 - g * 0.25))
          .setDepth(9);
        // Ember streak accent on very fast balls
        if (dist2 > 40 * 40 && g === 0) {
          const streak = this.add
            .circle(gx, gy, b.radius * 0.35, THEME.emberOrange, trailScale.trailAlpha * 0.7)
            .setDepth(9);
          this.tweens.add({
            targets: streak,
            alpha: 0,
            scale: 0.4,
            duration: 120,
            onComplete: () => streak.destroy(),
          });
        }
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          scale: 0.55,
          duration: 130 + g * 40,
          onComplete: () => ghost.destroy(),
        });
      }
    }
    view.container.setPosition(b.x, b.y);
    view.circle.setRadius(b.radius);
    view.ring.setRadius(b.radius + 3);
    view.aura.setRadius(b.radius + 14);
    view.shieldRing.setRadius(b.radius + 8);

    const protected_ = !!b.spawnProtected;
    const flash = !!b.hitFlash;
    const buffs = b.buffs || [];
    const isGalaxy = !!b.isGalaxy || buffs.includes('galaxy_god');
    const isDino = buffs.includes('dino_rage');
    const isDonut = buffs.includes('donut_overdrive');
    const isTitan = buffs.includes('capybara_titan');
    const isSugar = buffs.includes('sugar_burst');
    const isFreeze = buffs.includes('freeze_aura');
    const isReflect = buffs.includes('reflect_shield');
    const isSlowed = buffs.includes('slowed');
    const isMagnet = buffs.includes('magnet_pulse');
    const isDash = buffs.includes('dash_burst');

    // Fill owned by gloss texture; Arc is stroke-only
    view.circle.setFillStyle(b.color, 0);
    let stroke = THEME.cream;
    let strokeW = b.isKing ? 7 : 3;
    if (isGalaxy) { stroke = THEME.lavender; strokeW = 6; }
    else if (b.isKing) stroke = THEME.gold;
    else if (protected_) stroke = THEME.teal;
    else if (flash) stroke = THEME.coral;
    else if (isDino) stroke = 0x7cfc00;
    else if (isTitan) stroke = 0xc4a484;
    else if (isDonut) stroke = 0xff9f1c;
    view.circle.setStrokeStyle(strokeW, stroke, protected_ ? 0.5 : 0.95);
    // Outer rim light — king gets thick gold double-ring glow
    if (b.isKing && !isGalaxy) {
      view.ring.setRadius(b.radius + 7);
      view.ring.setStrokeStyle(6, THEME.gold, protected_ ? 0.4 : 0.72);
    } else {
      view.ring.setRadius(b.radius + 3);
      view.ring.setStrokeStyle(3, stroke, protected_ ? 0.35 : 0.5);
    }
    view.container.setAlpha(protected_ ? 0.55 : 1);

    // Aura — floor-pickup buffs get a cheap sin pulse on width/alpha
    const canAuraPulse =
      (isFreeze || isMagnet || isDash || isReflect) && (this.particleBudget ?? 1) >= 0.2;
    const pulse = canAuraPulse ? Math.sin(this.time.now / 280) : 0;
    const pW = pulse * 0.85;
    const pA = pulse * 0.12;
    if (isDino) view.aura.setStrokeStyle(5, 0x7cfc00, 0.7);
    else if (isGalaxy) view.aura.setStrokeStyle(6, THEME.lavender, 0.85);
    else if (isTitan) view.aura.setStrokeStyle(5, 0xc4a484, 0.55);
    else if (isFreeze) view.aura.setStrokeStyle(5 + pW, 0x7dd3fc, 0.8 + pA);
    else if (isReflect) view.aura.setStrokeStyle(5 + pW, 0xe0e7ff, 0.85 + pA);
    else if (isMagnet) view.aura.setStrokeStyle(6 + pW, THEME.electricCyan, 0.75 + pA);
    else if (isDash) view.aura.setStrokeStyle(4 + pW, THEME.emberOrange, 0.7 + pA);
    else if (isSugar) view.aura.setStrokeStyle(4, THEME.arenaRed, 0.7);
    else if (isSlowed) view.aura.setStrokeStyle(3, 0x38bdf8, 0.45);
    else if (b.isKing) view.aura.setStrokeStyle(7, THEME.gold, 0.35);
    else view.aura.setStrokeStyle(0, 0x000000, 0);

    // Shield / reflect ring (donut orange wins over reflect silver)
    const sh = b.shieldHp || 0;
    if (sh > 0 || isDonut) {
      view.shieldRing.setStrokeStyle(4, 0xff9f1c, 0.85);
      view.shieldRing.setRadius(b.radius + 8);
      view.shieldRing.rotation += 0.04;
    } else if (isReflect) {
      view.shieldRing.setStrokeStyle(5, 0xe0e7ff, 0.9);
      view.shieldRing.setRadius(b.radius + 12);
      view.shieldRing.rotation += 0.07;
    } else {
      view.shieldRing.setStrokeStyle(0, 0x000000, 0);
      view.shieldRing.setRadius(b.radius + 8);
    }

    view.revengeMark.setVisible(!!b.revengeMarked);
    syncGlossParts(
      this,
      {
        shadow: view.shadow,
        gloss: view.gloss,
        crownGfx: view.crownGfx,
        glossKey: view.glossKey,
        skin: view.skin,
      },
      b,
      { hitFlash: flash, spawnProtected: protected_ }
    );
    view.glossKey = view.gloss.texture.key;
    view.skin = skinFromBall(b);
    if (view.avatar) {
      const avSize = b.radius * 1.9;
      view.avatar.setDisplaySize(avSize, avSize);
      view.avatar.setAlpha(protected_ ? 0.55 : 1);
      this.syncAvatarChrome(view, b.radius, stroke, !!b.isKing, isGalaxy, protected_);
    }

    // Kill-strength cue (tier = floor(bonus% / 24) roughly every 3 kills)
    const sm = b.strengthMult ?? 1;
    const kills = b.kills ?? 0;
    const tier = Math.floor(Math.max(0, sm - 1) / 0.24); // 0..4
    if (kills >= 3 && sm > 1.01) {
      view.strengthMark.setVisible(true);
      view.strengthMark.setText(`💪×${sm.toFixed(2)}`);
      view.strengthMark.setY(b.isKing ? -b.radius - 58 : -b.radius - 30);
      if (tier > view.lastStrengthTier) {
        view.lastStrengthTier = tier;
        this.tweens.add({
          targets: view.container,
          scaleX: 1.25,
          scaleY: 1.25,
          duration: 120,
          yoyo: true,
        });
      }
    } else {
      view.strengthMark.setVisible(false);
      view.lastStrengthTier = tier;
    }

    const icons: string[] = [];
    const stackLabel = (emoji: string, n: number | undefined) =>
      n && n > 1 ? `${emoji}×${n}` : emoji;
    if (isGalaxy) icons.push('🌌');
    if (isTitan) icons.push(stackLabel('🦫', b.titanStacks));
    if (isDino) icons.push(stackLabel('🦖', b.dinoStacks));
    if (isDonut || sh > 0) icons.push(stackLabel('🍩', b.donutStacks));
    if (isSugar) icons.push('💥');
    if (isFreeze) icons.push('❄️');
    if (isReflect) icons.push('🪞');
    if (isMagnet) icons.push('🧲');
    if (isDash) icons.push('🚀');
    if (isSlowed) icons.push('🥶');
    view.buffIcon.setText(icons.join(''));
    view.buffIcon.setY(b.radius + 46);

    view.label.setText(this.truncate(b.label, 14));
    view.label.setY(b.radius + 18);
    this.drawNamePlate(view.namePlate, view.label, b.radius);
    const barW = Math.max(48, b.radius * 2.25);
    const hpY = -b.radius - 18;
    view.hpBg.setPosition(0, hpY);
    view.hpBg.setSize(barW, 16);
    // Solo galaxy = immortal ∞ bar; Cosmic Duel uses real cosmic HP (lavender)
    const galaxyImmortal = isGalaxy && (b.maxHp ?? 0) >= 9000;
    const galaxyDuel = isGalaxy && !galaxyImmortal;
    if (galaxyImmortal) {
      view.hpFg.setPosition(-barW / 2, hpY);
      view.hpFg.setSize(barW, 12);
      view.hpFg.setFillStyle(THEME.lavender);
      view.label.setText(this.truncate(b.label, 10) + ' ∞');
      this.drawNamePlate(view.namePlate, view.label, b.radius);
    } else if (galaxyDuel) {
      const ratio = b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 0;
      view.hpFg.setPosition(-barW / 2, hpY);
      view.hpFg.setSize(barW * ratio, 12);
      view.hpFg.setFillStyle(THEME.lavender);
      view.label.setText(this.truncate(b.label, 10) + ' ⚔️');
      this.drawNamePlate(view.namePlate, view.label, b.radius);
    } else {
      const ratio = b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 0;
      view.hpFg.setPosition(-barW / 2, hpY);
      view.hpFg.setSize(barW * ratio, 12);
      view.hpFg.setFillStyle(ratio > 0.55 ? THEME.sage : ratio > 0.25 ? THEME.gold : THEME.coral);
    }
    const shieldRatio = Math.min(1, sh / 300);
    view.shieldFg.setPosition(-barW / 2, hpY - 14);
    view.shieldFg.setSize(barW * shieldRatio, 6);
    view.shieldFg.setVisible(sh > 0);

    if (b.healFlash && !view.lastHealFlash) {
      this.spawnHeartBurst(b.x, b.y);
    }
    view.lastHealFlash = !!b.healFlash;
    if (b.sugarBurstFlash || b.stompFlash || b.galaxyImpactFlash) {
      this.tweens.add({
        targets: view.aura,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0.2,
        duration: 200,
        yoyo: true,
      });
    }

    if (b.hp < view.lastHp && !galaxyImmortal) {
      this.tweens.add({
        targets: view.container,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 60,
        yoyo: true,
      });
    }

    // Activate bursts once when buff appears (server also emits ability_fx; this covers late join)
    if (isFreeze && !view.hadFreeze) {
      spawnFreezeBurst(this, b.x, b.y, this.particleBudget ?? 1);
    }
    if (isReflect && !view.hadReflect) {
      spawnReflectActivate(this, b.x, b.y);
    }
    if (isDash && !view.hadDash) {
      spawnDashBurst(
        this,
        b.x,
        b.y,
        b.x + (b.x - view.prevX) * 4,
        b.y + (b.y - view.prevY) * 4,
        this.particleBudget ?? 1
      );
    }
    view.lastBuffFxAt = tickBuffParticles(this, {
      x: b.x,
      y: b.y,
      prevX: view.prevX,
      prevY: view.prevY,
      radius: b.radius,
      isFreeze,
      isDash,
      isMagnet,
      isReflect,
      isStrong: kills >= 3 && sm > 1.01,
      lastBuffFxAt: view.lastBuffFxAt,
      budget: this.particleBudget ?? 1,
    });
    view.hadFreeze = isFreeze;
    view.hadReflect = isReflect;
    view.hadDash = isDash;
    view.prevX = b.x;
    view.prevY = b.y;
    view.lastHp = b.hp;
  }

  private spawnHeartBurst(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const heart = this.add.text(x, y, '💖', { fontSize: '20px' }).setDepth(250);
      const ang = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: heart,
        x: x + Math.cos(ang) * (40 + Math.random() * 50),
        y: y + Math.sin(ang) * (40 + Math.random() * 50) - 30,
        alpha: 0,
        duration: 500 + Math.random() * 300,
        onComplete: () => heart.destroy(),
      });
    }
  }

  private tryLoadAvatar(b: BallState, view: BallView): void {
    if (!b.avatarUrl || this.pendingAvatars.has(b.id)) return;
    this.pendingAvatars.add(b.id);
    const key = `avatar-${b.id}`;
    if (this.textures.exists(key)) {
      this.applyAvatar(key, b.radius, view);
      return;
    }
    this.load.image(key, b.avatarUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.textures.exists(key)) return;
      // View may have been destroyed while loading
      if (!this.views.has(b.id)) return;
      this.applyAvatar(key, b.radius, this.views.get(b.id)!);
    });
    this.load.start();
  }

  private applyAvatar(key: string, radius: number, view: BallView): void {
    view.initials.setVisible(false);
    view.avatarSrcKey = key;
    const roundKey = this.ensureRoundAvatar(key);
    const avSize = radius * 1.9;
    if (view.avatar) {
      view.avatar.setTexture(roundKey);
      view.avatar.setDisplaySize(avSize, avSize);
      // Resize glow only — updateBallView owns king/galaxy/stroke chrome each tick
      if (view.avatarGlow) view.avatarGlow.setRadius(avSize * 0.5 + 5);
      return;
    }
    const img = this.add.image(0, 0, roundKey);
    img.setDisplaySize(avSize, avSize);
    const glossIdx = view.container.getIndex(view.gloss);
    const insertAt = glossIdx >= 0 ? glossIdx + 1 : 6;
    // Glow under avatar, then photo, then premium ring
    const glow = this.add.circle(0, 0, avSize * 0.58, THEME.gold, 0.22);
    const ringGfx = this.add.graphics();
    view.container.addAt(glow, insertAt);
    view.container.addAt(img, insertAt + 1);
    view.container.addAt(ringGfx, insertAt + 2);
    view.avatarGlow = glow;
    view.avatar = img;
    view.avatarRing = ringGfx;
    view.circle.setFillStyle(view.circle.fillColor, 0);
    // Placeholder chrome until next updateBallView sync with real king/galaxy/stroke
    this.syncAvatarChrome(view, radius, THEME.cream, false, false, false);
  }

  /** Bake a circular clipped avatar texture (cached) with soft edge. */
  private ensureRoundAvatar(srcKey: string, size = 128): string {
    const destKey = `${srcKey}-round`;
    if (this.textures.exists(destKey)) return destKey;
    if (!this.textures.exists(srcKey)) return srcKey;
    const canvasTex = this.textures.createCanvas(destKey, size, size);
    if (!canvasTex) return srcKey;
    const ctx = canvasTex.getContext();
    const src = this.textures.get(srcKey).getSourceImage() as CanvasImageSource;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(src as CanvasImageSource, 0, 0, size, size);
    // Soft inner vignette so photo sits on the ball
    const vig = ctx.createRadialGradient(r, r, r * 0.55, r, r, r);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    canvasTex.refresh();
    return destKey;
  }

  private syncAvatarChrome(
    view: BallView,
    radius: number,
    stroke: number,
    isKing: boolean,
    isGalaxy: boolean,
    protected_: boolean
  ): void {
    const avSize = radius * 1.9;
    const rr = avSize * 0.5;
    if (view.avatarGlow) {
      view.avatarGlow.setRadius(rr + 5);
      let glowColor = stroke;
      if (isGalaxy) glowColor = THEME.lavender;
      else if (isKing) glowColor = THEME.gold;
      let glowA = protected_ ? 0.12 : 0.28;
      // Gentle alpha pulse for king/galaxy only — skip on low quality
      const canPulse =
        (isKing || isGalaxy) &&
        !protected_ &&
        this.qualityTier !== 'low' &&
        (this.particleBudget ?? 1) >= 0.35;
      if (canPulse) {
        glowA = 0.2 + Math.sin(this.time.now / 480) * 0.1;
      }
      view.avatarGlow.setFillStyle(glowColor, glowA);
    }
    if (view.avatarRing) {
      const g = view.avatarRing;
      g.clear();
      const ringColor = isGalaxy ? THEME.lavender : isKing ? THEME.gold : stroke;
      g.lineStyle(4.5, ringColor, protected_ ? 0.45 : 0.95);
      g.strokeCircle(0, 0, rr + 1);
      g.lineStyle(1.5, THEME.light, protected_ ? 0.2 : 0.45);
      g.strokeCircle(0, 0, rr - 2);
      // Outer soft halo
      g.lineStyle(6, ringColor, protected_ ? 0.08 : 0.18);
      g.strokeCircle(0, 0, rr + 5);
    }
  }

  private drawNamePlate(
    g: Phaser.GameObjects.Graphics,
    label: Phaser.GameObjects.Text,
    radius: number
  ): void {
    g.clear();
    const tw = Math.max(36, label.width + 18);
    const th = Math.max(18, label.height + 6);
    const y = radius + 16;
    const x = -tw / 2;
    g.fillStyle(THEME.ink, 0.78);
    g.fillRoundedRect(x, y, tw, th, 10);
    g.lineStyle(1.5, THEME.gold, 0.4);
    g.strokeRoundedRect(x, y, tw, th, 10);
    g.lineStyle(1, THEME.electricCyan, 0.22);
    g.strokeRoundedRect(x + 1, y + 1, tw - 2, th - 2, 9);
    label.setY(y + (th - label.height) / 2);
  }

  private getInitials(label: string): string {
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return label.slice(0, 2).toUpperCase() || '?';
  }

  private trackFps(delta: number): void {
    this.fpsFrames += 1;
    this.fpsAcc += delta;
    if (this.fpsAcc >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsAcc);
      this.fpsFrames = 0;
      this.fpsAcc = 0;
      if (this.fpsText) this.fpsText.setText(`${this.fps} fps`);
      // Adaptive quality tiers: high|medium|low from FPS → particleBudget → FX scales
      // (see fx/QualityTier.ts). Physics stays server-side.
      if (this.fps < 28) this.particleBudget = 0.25;
      else if (this.fps < 40) this.particleBudget = 0.5;
      else this.particleBudget = 1;
      this.qualityTier = qualityFromBudget(this.particleBudget);
      audio.setQuality(this.particleBudget);
      this.pickupsLayer?.setBudget(this.particleBudget);
    }
  }


  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  private syncBottomCta(phase: string): void {
    if (!this.bottomCta) return;
    const show = phase === 'waiting' || phase === 'countdown';
    this.bottomCta.setVisible(show);
    if (show) this.bottomCta.root.setAlpha(0.95);
  }

  private formatTime(sec: number): string {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.floor(Math.max(0, sec) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
