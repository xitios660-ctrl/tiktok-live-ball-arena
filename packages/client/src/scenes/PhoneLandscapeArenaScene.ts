import Phaser from 'phaser';
import {
  SOCKET_EVENTS,
  PICKUP_META,
  displayStrengthScore,
  type RoundState,
  type ArenaLiveEvent,
  type GameSnapshot,
  type BallState,
  type PickupState,
  type PlayerStats,
  type CombatEvent,
  type WinnerInfo,
} from '@arena/shared';
import { audio } from '../audio/AudioManager';
import { getOverlayOptions } from '../overlayConfig';
import { LANDSCAPE_HEIGHT, makeLandscapeMapper } from '../phoneLandscape';
import { THEME, THEME_HEX, FONT, FONT_BLACK, FONT_ACCENT, RANK_HEX } from '../theme';

interface LandscapeBallView {
  root: Phaser.GameObjects.Container;
  aura: Phaser.GameObjects.Arc;
  body: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  avatar?: Phaser.GameObjects.Image;
  avatarGlow?: Phaser.GameObjects.Arc;
  avatarRing?: Phaser.GameObjects.Graphics;
  avatarSrcKey?: string;
  initials: Phaser.GameObjects.Text;
  crown: Phaser.GameObjects.Text;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  strength: Phaser.GameObjects.Text;
  buffs: Phaser.GameObjects.Text;
  lastHp: number;
}

interface LandscapePickupView {
  root: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  emoji: Phaser.GameObjects.Text;
  sourceX: number;
  sourceY: number;
  sourceRadius: number;
}

const PANEL_W = 320;
const PANEL_TOP = 112;
const PANEL_ROW_H = 42;
const PANEL_CYCLE_MS = 10_000;
const PANEL_VISIBLE_MS = 3_000;

export class PhoneLandscapeArenaScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private field!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private topPanel!: Phaser.GameObjects.Graphics;
  private giftPanel!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private players!: Phaser.GameObjects.Text;
  private likes!: Phaser.GameObjects.Text;
  private topTitle!: Phaser.GameObjects.Text;
  private topRows: Phaser.GameObjects.Text[] = [];
  private giftTitle!: Phaser.GameObjects.Text;
  private giftRows: Phaser.GameObjects.Text[] = [];
  private feed!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private winnerPanel!: Phaser.GameObjects.Container;
  private winnerTitle!: Phaser.GameObjects.Text;
  private winnerBody!: Phaser.GameObjects.Text;
  private ballViews = new Map<string, LandscapeBallView>();
  private pendingAvatars = new Set<string>();
  private pickupViews = new Map<string, LandscapePickupView>();
  private lastTop5: PlayerStats[] = [];
  private lastRemaining = 300;
  private lastPhase = 'waiting';
  private lastPlayerCount = 0;
  private feedLines: string[] = [];
  private toastTween: Phaser.Tweens.Tween | null = null;
  private panelTween: Phaser.Tweens.Tween | null = null;
  private panelsVisible = true;

  constructor() {
    super('ArenaScene');
  }

  create(data?: { round?: RoundState }): void {
    const opts = getOverlayOptions();
    audio.setPhoneLite(true);

    this.bg = this.add.graphics().setDepth(0);
    this.field = this.add.graphics().setDepth(1);
    this.hud = this.add.graphics().setDepth(80);
    this.topPanel = this.add.graphics().setDepth(80);
    this.giftPanel = this.add.graphics().setDepth(80);

    this.title = this.add
      .text(0, 0, 'BALL ARENA', {
        fontFamily: FONT_BLACK,
        fontSize: '54px',
        color: THEME_HEX.light,
        stroke: THEME_HEX.arenaRed,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.timer = this.add
      .text(0, 0, this.formatTime(data?.round?.remainingSec ?? 300), {
        fontFamily: FONT_BLACK,
        fontSize: '44px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.players = this.add
      .text(0, 0, 'PLAYERS: ' + (data?.round?.playerCount ?? 0), {
        fontFamily: FONT_ACCENT,
        fontSize: '24px',
        color: THEME_HEX.electricCyan,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.likes = this.add
      .text(0, 0, '❤️ 0 / 100', {
        fontFamily: FONT_ACCENT,
        fontSize: '22px',
        color: THEME_HEX.arenaRed,
        backgroundColor: '#111217cc',
        padding: { x: 10, y: 6 },
      })
      .setDepth(100);

    this.topTitle = this.add
      .text(0, 0, '👑  TOP 5', {
        fontFamily: FONT_ACCENT,
        fontSize: '30px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setDepth(100);

    for (let i = 0; i < 5; i++) {
      this.topRows.push(
        this.add
          .text(0, 0, '—', {
            fontFamily: FONT,
            fontSize: '19px',
            color: i === 0 ? RANK_HEX.gold : THEME_HEX.light,
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setDepth(100)
      );
    }

    this.giftTitle = this.add
      .text(0, 0, '★ POWER-UPS', {
        fontFamily: FONT_ACCENT,
        fontSize: '30px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setDepth(100);

    const giftLines = [
      '🌹 Rosa · cura',
      '🦖 Dino · força',
      '🍩 Donut · escudo',
      '🦫 Capy · gigante',
      '🌌 Galáxia · cósmico',
      '💬 Comente · entrar',
    ];
    for (const line of giftLines) {
      this.giftRows.push(
        this.add
          .text(0, 0, line, {
            fontFamily: FONT,
            fontSize: '18px',
            color: THEME_HEX.light,
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setDepth(100)
      );
    }

    this.feed = this.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: THEME_HEX.light,
        stroke: '#000000',
        strokeThickness: 3,
        lineSpacing: 3,
      })
      .setDepth(100);

    this.toast = this.add
      .text(0, 0, '', {
        fontFamily: FONT_ACCENT,
        fontSize: '32px',
        color: THEME_HEX.gold,
        backgroundColor: '#0b0b0fe8',
        padding: { x: 18, y: 10 },
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);

    this.countdown = this.add
      .text(0, 0, '', {
        fontFamily: FONT_BLACK,
        fontSize: '190px',
        color: THEME_HEX.arenaRed,
        stroke: THEME_HEX.light,
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(350)
      .setAlpha(0);

    this.footer = this.add
      .text(0, 0, '💬 COMENTE PARA JOGAR   •   ❤️ 10 LIKES = +2 HP   •   100 LIKES = +10 HP PARA TODOS', {
        fontFamily: FONT_ACCENT,
        fontSize: '28px',
        color: THEME_HEX.arenaDark,
        backgroundColor: THEME_HEX.light,
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(110);

    this.winnerPanel = this.add.container(0, 0).setDepth(400).setVisible(false);
    const winnerBg = this.add.graphics();
    winnerBg.fillStyle(THEME.arenaDark, 0.96);
    winnerBg.fillRoundedRect(-390, -270, 780, 540, 28);
    winnerBg.lineStyle(7, THEME.gold, 0.9);
    winnerBg.strokeRoundedRect(-390, -270, 780, 540, 28);
    this.winnerTitle = this.add
      .text(0, -210, '🏆 REI DA ARENA', {
        fontFamily: FONT_ACCENT,
        fontSize: '52px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    this.winnerBody = this.add
      .text(0, 20, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: THEME_HEX.light,
        align: 'center',
        lineSpacing: 7,
      })
      .setOrigin(0.5);
    this.winnerPanel.add([winnerBg, this.winnerTitle, this.winnerBody]);

    this.lastRemaining = data?.round?.remainingSec ?? 300;
    this.lastPhase = data?.round?.phase ?? 'running';
    this.lastPlayerCount = data?.round?.playerCount ?? 0;

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.game.events.on(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
    this.game.events.on(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
    this.game.events.on(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
    this.game.events.on(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(SOCKET_EVENTS.ROUND_STATE, this.onRound, this);
      this.game.events.off(SOCKET_EVENTS.LIVE_EVENT, this.onLive, this);
      this.game.events.off(SOCKET_EVENTS.GAME_SNAPSHOT, this.onSnapshot, this);
      this.game.events.off(SOCKET_EVENTS.COMBAT_EVENT, this.onCombat, this);
      this.toastTween?.stop();
      this.panelTween?.stop();
      this.ballViews.clear();
      this.pickupViews.clear();
    });

    if (opts.debug) {
      this.add
        .text(12, LANDSCAPE_HEIGHT - 28, 'PHONE LANDSCAPE NATIVE', {
          fontFamily: FONT,
          fontSize: '14px',
          color: THEME_HEX.muted,
        })
        .setDepth(500);
    }

    this.layout();
    this.setCornerPanelsVisible(true, false);
  }

  update(time: number): void {
    this.tickCornerPanels(time);
    for (const view of this.pickupViews.values()) {
      const bob = Math.sin(time / 280 + view.sourceX * 0.01) * 4;
      view.emoji.y = bob;
      view.ring.rotation += 0.008;
    }
    for (const view of this.ballViews.values()) {
      view.aura.alpha = 0.16 + (Math.sin(time / 220 + view.root.x * 0.003) + 1) * 0.06;
    }
  }

  private onRound = (state: RoundState): void => {
    this.lastRemaining = state.remainingSec;
    this.lastPhase = state.phase;
    this.lastPlayerCount = state.playerCount ?? this.lastPlayerCount;
    this.timer.setText(this.formatTime(state.remainingSec));
    this.players.setText('PLAYERS: ' + this.lastPlayerCount);
  };

  private onLive = (event: ArenaLiveEvent): void => {
    let line = '';
    if (event.type === 'comment') line = '💬 ' + event.user.username + ': ' + event.comment;
    else if (event.type === 'gift') line = '🎁 ' + event.user.username + ': ' + event.giftName;
    else if (event.type === 'join') line = '👋 ' + event.user.username + ' entrou';
    else if (event.type === 'follow') line = '➕ ' + event.user.username + ' seguiu';
    else if (event.type === 'share') line = '↗ ' + event.user.username + ' compartilhou';
    else if (event.type === 'like') line = '❤️ ' + event.user.username;
    if (!line) return;
    this.feedLines.unshift(line);
    this.feedLines = this.feedLines.slice(0, 4);
    this.feed.setText(this.feedLines.join('\n'));
  };

  private onSnapshot = (snap: GameSnapshot): void => {
    this.lastRemaining = snap.remainingSec;
    this.lastPhase = snap.phase;
    this.lastPlayerCount = snap.playerCount;
    this.timer.setText(this.formatTime(snap.remainingSec));
    this.players.setText('PLAYERS: ' + snap.playerCount);

    if (snap.global) {
      this.likes.setText('❤️ ' + snap.global.likesAccumulated + ' / ' + snap.global.likesThreshold);
    }

    this.syncBalls(snap.balls);
    this.syncPickups(snap.pickups || []);
    this.lastTop5 = snap.top5 || snap.stats.slice(0, 5);
    this.renderTop5();

    if (snap.phase === 'results') {
      this.showWinner(snap.winner, snap.resultsRemainingSec ?? 0, this.lastTop5);
    } else {
      this.winnerPanel.setVisible(false);
    }
  };

  private onCombat = (event: CombatEvent): void => {
    if (event.type === 'hit') {
      this.spawnImpact(event.x, event.y, THEME.light);
      audio.play('collision', { intensity: Math.min(1, (event.damage || 8) / 28) });
      return;
    }

    if (event.type === 'kill') {
      this.spawnImpact(event.x, event.y, event.isRevenge ? THEME.gold : THEME.arenaRed);
      this.showToast(event.message);
      audio.play(event.isRevenge ? 'revenge' : 'death');
      return;
    }

    if (event.type === 'ability_fx') {
      const emoji =
        event.ability === 'heal_pulse' || event.ability === 'heal_orb'
          ? '💚'
          : event.ability === 'freeze_aura'
            ? '❄️'
            : event.ability === 'dash_burst'
              ? '🚀'
              : event.ability === 'reflect_shield'
                ? '🪞'
                : event.ability === 'galaxy_god'
                  ? '🌌'
                  : '⚡';
      this.spawnAbilityEmoji(event.x, event.y, emoji);
      return;
    }

    if (event.type === 'announce') {
      if (event.kind === 'countdown' && event.value != null) {
        this.showCountdown(event.value);
        audio.play('countdown');
      } else {
        this.showToast(event.message);
        if (event.kind === 'winner') audio.play('victory');
        else if (event.kind === 'gift' || event.kind === 'galaxy' || event.kind === 'cosmic_duel') {
          audio.play('gift');
        }
      }
    }
  };

  private layout(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height || LANDSCAPE_HEIGHT;
    const cx = w / 2;

    this.redrawBackground(w, h);

    this.title.setPosition(cx, 45);
    this.timer.setPosition(cx, 108);
    this.players.setPosition(cx, 162);
    this.likes.setPosition(24, 24);

    // Temporary information panels live at the actual outer screen corners,
    // not at the edges of the centered 16:9 gameplay area.
    const left = 18;
    const right = w - PANEL_W - 18;

    this.topTitle.setPosition(left + 18, PANEL_TOP + 16);
    for (let i = 0; i < this.topRows.length; i++) {
      this.topRows[i].setPosition(left + 18, PANEL_TOP + 58 + i * PANEL_ROW_H);
    }

    this.giftTitle.setPosition(right + 18, PANEL_TOP + 16);
    for (let i = 0; i < this.giftRows.length; i++) {
      this.giftRows[i].setPosition(right + 18, PANEL_TOP + 58 + i * 34);
    }

    this.feed.setPosition(left + 12, h - 152);
    this.toast.setPosition(cx, 225);
    this.countdown.setPosition(cx, h / 2);
    this.footer.setPosition(cx, h - 42);
    this.winnerPanel.setPosition(cx, h / 2);

    for (const [id, view] of this.ballViews) {
      const source = (view.root.getData('source') || null) as BallState | null;
      if (source) this.positionBall(id, view, source);
    }
    for (const view of this.pickupViews.values()) {
      this.positionPickup(view);
    }
  }

  private redrawBackground(w: number, h: number): void {
    const mapper = makeLandscapeMapper(w);

    const bg = this.bg;
    bg.clear();
    bg.fillStyle(THEME.arenaDark, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(THEME.emberOrange, 0.08);
    bg.fillEllipse(w / 2, h * 0.5, Math.max(1100, w * 0.58), h * 0.9);
    bg.fillStyle(THEME.electricCyan, 0.035);
    bg.fillEllipse(w * 0.18, h * 0.45, Math.max(500, w * 0.24), h * 0.8);
    bg.fillEllipse(w * 0.82, h * 0.45, Math.max(500, w * 0.24), h * 0.8);

    const field = this.field;
    field.clear();

    // Full-screen stadium floor. The side wings are scenery only; gameplay
    // still maps into the centered, proportion-correct 1920×1080 arena.
    field.fillStyle(THEME.stone, 0.34);
    field.fillRoundedRect(8, 8, w - 16, h - 16, 24);

    const wingW = Math.max(0, mapper.offsetX);
    if (wingW > 8) {
      field.fillStyle(THEME.electricCyan, 0.055);
      field.fillRect(8, 8, wingW, h - 16);
      field.fillStyle(THEME.emberOrange, 0.055);
      field.fillRect(w - wingW - 8, 8, wingW, h - 16);

      field.lineStyle(2, THEME.electricCyan, 0.16);
      field.lineBetween(wingW * 0.28, h * 0.12, wingW * 0.72, h * 0.88);
      field.lineBetween(wingW * 0.72, h * 0.12, wingW * 0.28, h * 0.88);

      field.lineStyle(2, THEME.emberOrange, 0.16);
      field.lineBetween(w - wingW * 0.28, h * 0.12, w - wingW * 0.72, h * 0.88);
      field.lineBetween(w - wingW * 0.72, h * 0.12, w - wingW * 0.28, h * 0.88);

      // Soft crowd / light pools keep the ultra-wide extensions visually alive.
      field.fillStyle(THEME.electricCyan, 0.045);
      field.fillEllipse(wingW * 0.5, h * 0.52, Math.max(180, wingW * 1.35), h * 0.72);
      field.fillStyle(THEME.emberOrange, 0.045);
      field.fillEllipse(w - wingW * 0.5, h * 0.52, Math.max(180, wingW * 1.35), h * 0.72);
    }

    field.lineStyle(2, THEME.light, 0.18);
    field.strokeRoundedRect(12, 12, w - 24, h - 24, 22);

    // Arena markings stay within the undistorted gameplay region.
    const arenaCx = mapper.offsetX + mapper.playWidth / 2;
    const arenaCy = mapper.offsetY + mapper.playHeight * 0.58;
    field.lineStyle(4, THEME.emberOrange, 0.58);
    field.strokeEllipse(arenaCx, arenaCy, mapper.playWidth * 0.56, mapper.playHeight * 0.38);
    field.lineStyle(2, THEME.gold, 0.4);
    field.strokeEllipse(arenaCx, arenaCy, mapper.playWidth * 0.41, mapper.playHeight * 0.27);
    field.lineStyle(2, THEME.electricCyan, 0.32);
    field.strokeEllipse(arenaCx, arenaCy, mapper.playWidth * 0.24, mapper.playHeight * 0.16);

    const left = 18;
    const right = w - PANEL_W - 18;

    this.topPanel.clear();
    this.drawPanel(this.topPanel, left, PANEL_TOP, PANEL_W, 292);

    this.giftPanel.clear();
    this.drawPanel(this.giftPanel, right, PANEL_TOP, PANEL_W, 304);

    const hud = this.hud;
    hud.clear();
    hud.lineStyle(2, THEME.gold, 0.35);
    hud.strokeRoundedRect(w / 2 - 94, 82, 188, 62, 26);
  }

  private cornerPanelTargets(): Phaser.GameObjects.GameObject[] {
    return [
      this.topPanel,
      this.giftPanel,
      this.topTitle,
      ...this.topRows,
      this.giftTitle,
      ...this.giftRows,
    ];
  }

  private tickCornerPanels(time: number): void {
    const phase = time % PANEL_CYCLE_MS;
    const shouldShow = phase < PANEL_VISIBLE_MS;
    if (shouldShow !== this.panelsVisible) {
      this.setCornerPanelsVisible(shouldShow, true);
    }
  }

  private setCornerPanelsVisible(visible: boolean, animate: boolean): void {
    this.panelsVisible = visible;
    const targets = this.cornerPanelTargets();
    this.panelTween?.stop();

    if (!animate) {
      for (const target of targets) {
        (target as unknown as { setAlpha: (value: number) => unknown }).setAlpha(visible ? 1 : 0);
      }
      return;
    }

    if (visible) {
      for (const target of targets) {
        (target as unknown as { setAlpha: (value: number) => unknown }).setAlpha(0);
      }
      this.panelTween = this.tweens.add({
        targets,
        alpha: 1,
        duration: 280,
        ease: 'Cubic.Out',
      });
    } else {
      this.panelTween = this.tweens.add({
        targets,
        alpha: 0,
        duration: 320,
        ease: 'Cubic.In',
      });
    }
  }

  private drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(THEME.arenaDark, 0.78);
    g.fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(2, THEME.gold, 0.36);
    g.strokeRoundedRect(x, y, w, h, 18);
    g.lineStyle(1, THEME.light, 0.14);
    g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 14);
  }

  private syncBalls(balls: BallState[]): void {
    const seen = new Set<string>();
    for (const b of balls) {
      seen.add(b.id);
      let view = this.ballViews.get(b.id);
      if (!view) {
        view = this.createBallView(b);
        this.ballViews.set(b.id, view);
      }
      view.root.setData('source', { ...b });
      this.positionBall(b.id, view, b);
    }

    for (const [id, view] of this.ballViews) {
      if (!seen.has(id)) {
        view.root.destroy(true);
        this.ballViews.delete(id);
      }
    }
  }

  private createBallView(b: BallState): LandscapeBallView {
    const root = this.add.container(0, 0).setDepth(30);
    const aura = this.add.circle(0, 0, b.radius + 16, b.color, 0.18);
    const ring = this.add.circle(0, 0, b.radius + 4, 0x000000, 0);
    ring.setStrokeStyle(4, THEME.light, 0.62);
    const body = this.add.circle(0, 0, b.radius, b.color, 1);
    body.setStrokeStyle(3, THEME.light, 0.9);

    const shine = this.add.ellipse(-b.radius * 0.28, -b.radius * 0.3, b.radius * 0.7, b.radius * 0.38, 0xffffff, 0.2);
    const initials = this.add
      .text(0, 0, this.initials(b.label), {
        fontFamily: FONT_BLACK,
        fontSize: Math.max(16, Math.floor(b.radius * 0.7)) + 'px',
        color: THEME_HEX.light,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const crown = this.add
      .text(0, -b.radius - 42, '♛', {
        fontFamily: FONT_BLACK,
        fontSize: '34px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setVisible(!!b.isKing);

    const initialBarW = Math.max(54, b.radius * 2.1);
    const hpBg = this.add.rectangle(0, -b.radius - 22, initialBarW, 11, THEME.steel, 0.9);
    const hpFg = this.add
      .rectangle(-initialBarW / 2, -b.radius - 22, initialBarW, 8, THEME.sage, 1)
      .setOrigin(0, 0.5);

    const name = this.add
      .text(0, b.radius + 14, this.truncate(b.label, 14), {
        fontFamily: FONT,
        fontSize: '15px',
        color: THEME_HEX.light,
        backgroundColor: '#090a0dcc',
        padding: { x: 6, y: 3 },
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    const strength = this.add
      .text(0, -b.radius - 47, '💪' + displayStrengthScore(b.kills ?? 0, b.hitPower ?? 0), {
        fontFamily: FONT_ACCENT,
        fontSize: '16px',
        color: THEME_HEX.gold,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const buffs = this.add
      .text(0, b.radius + 43, '', { fontSize: '18px' })
      .setOrigin(0.5, 0);

    root.add([aura, ring, body, shine, initials, crown, hpBg, hpFg, name, strength, buffs]);
    root.setScale(0.15);
    this.tweens.add({ targets: root, scale: 1, duration: 260, ease: 'Back.Out' });

    const view: LandscapeBallView = {
      root,
      aura,
      body,
      ring,
      initials,
      crown,
      hpBg,
      hpFg,
      name,
      strength,
      buffs,
      lastHp: b.hp,
    };
    if (b.avatarUrl && !b.isBoss) this.tryLoadAvatar(b, view);
    return view;
  }

  private positionBall(_id: string, view: LandscapeBallView, b: BallState): void {
    if (b.avatarUrl && !b.isBoss && !view.avatar) {
      this.tryLoadAvatar(b, view);
    }

    const mapper = makeLandscapeMapper(this.cameras.main.width);
    const p = mapper.map(b.x, b.y);
    const r = Math.max(10, b.radius * mapper.scale);

    view.root.setPosition(p.x, p.y);
    view.body.setRadius(r);
    view.ring.setRadius(r + 4);
    view.aura.setRadius(r + 16);
    if (view.avatar) {
      const avSize = r * 1.98;
      view.avatar.setDisplaySize(avSize, avSize);
      view.initials.setVisible(false);
      if (view.avatarGlow) view.avatarGlow.setRadius(avSize * 0.5 + 5);
      if (view.avatarRing) this.paintAvatarRing(view.avatarRing, avSize * 0.5, b);
    }

    const barW = Math.max(54, r * 2.1);
    const hpY = -r - 22;
    view.hpBg.setPosition(0, hpY).setSize(barW, 11);
    const ratio = b.maxHp > 0 ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 0;
    view.hpFg.setPosition(-barW / 2, hpY).setSize(barW * ratio, 8);
    view.hpFg.setFillStyle(ratio > 0.55 ? THEME.sage : ratio > 0.25 ? THEME.gold : THEME.arenaRed);

    view.name
      .setPosition(0, r + 14)
      .setText(b.isBoss ? '👑 BOSS · +10☠' : this.truncate(b.label, 14))
      .setColor(b.isBoss ? THEME_HEX.gold : THEME_HEX.light);
    view.initials
      .setFontSize(Math.max(14, Math.floor(r * 0.68)))
      .setText(b.isBoss ? 'AI' : this.initials(b.label));
    view.crown.setPosition(0, -r - 44).setVisible(!!b.isKing);
    view.strength
      .setPosition(0, -r - 48)
      .setText(
        b.isBoss
          ? '👑 BOSS · +' + (b.bossRewardKills ?? 10) + '☠'
          : '💪' + displayStrengthScore(b.kills ?? 0, b.hitPower ?? 0)
      )
      .setColor(b.isBoss ? THEME_HEX.gold : THEME_HEX.gold);

    const icons: string[] = [];
    const buffs = b.buffs || [];
    if (b.isGalaxy || buffs.includes('galaxy_god')) icons.push('🌌');
    if (buffs.includes('capybara_titan')) icons.push('🦫');
    if (buffs.includes('dino_rage')) icons.push('🦖');
    if (buffs.includes('donut_overdrive') || (b.shieldHp ?? 0) > 0) icons.push('🍩');
    if (buffs.includes('freeze_aura')) icons.push('❄️');
    if (buffs.includes('reflect_shield')) icons.push('🪞');
    if (buffs.includes('magnet_pulse')) icons.push('🧲');
    if (buffs.includes('dash_burst')) icons.push('🚀');
    view.buffs.setPosition(0, r + 43).setText(icons.join(''));

    const stroke = b.isBoss
      ? THEME.gold
      : b.isGalaxy
        ? THEME.lavender
      : b.isKing
        ? THEME.gold
        : b.spawnProtected
          ? THEME.electricCyan
          : THEME.light;
    view.body.setFillStyle(b.color, view.avatar ? 0 : 1);
    view.body.setStrokeStyle(b.isBoss ? 8 : b.isKing ? 6 : 3, stroke, b.spawnProtected ? 0.55 : 0.95);
    view.ring.setStrokeStyle(b.isBoss ? 7 : b.isKing ? 5 : 3, stroke, b.isBoss ? 0.85 : b.isKing ? 0.65 : 0.42);
    if (b.isBoss) {
      view.aura.setStrokeStyle(8, THEME.electricCyan, 0.72);
    }
    view.root.setAlpha(b.spawnProtected ? 0.58 : 1);

    if (b.hp < view.lastHp && !b.isGalaxy) {
      this.tweens.add({ targets: view.root, scaleX: 1.12, scaleY: 1.12, duration: 65, yoyo: true });
    }
    view.lastHp = b.hp;
  }

  private tryLoadAvatar(b: BallState, view: LandscapeBallView): void {
    if (!b.avatarUrl || b.isBoss || view.avatar || this.pendingAvatars.has(b.id)) return;
    this.pendingAvatars.add(b.id);
    const key = 'landscape-avatar-' + b.id;

    const apply = () => {
      if (!this.textures.exists(key)) {
        this.pendingAvatars.delete(b.id);
        return;
      }
      const current = this.ballViews.get(b.id);
      if (!current || current.avatar) {
        this.pendingAvatars.delete(b.id);
        return;
      }
      this.applyAvatar(key, b, current);
      this.pendingAvatars.delete(b.id);
    };

    if (this.textures.exists(key)) {
      apply();
      return;
    }

    this.load.image(key, b.avatarUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, apply);
    this.load.once('loaderror', () => {
      this.pendingAvatars.delete(b.id);
    });
    if (!this.load.isLoading()) this.load.start();
  }

  private applyAvatar(srcKey: string, b: BallState, view: LandscapeBallView): void {
    const roundKey = this.ensureRoundAvatar(srcKey);
    const r = Math.max(10, b.radius * makeLandscapeMapper(this.cameras.main.width).scale);
    const avSize = r * 1.98;

    const glow = this.add.circle(0, 0, avSize * 0.5 + 5, THEME.gold, 0.2);
    const img = this.add.image(0, 0, roundKey).setDisplaySize(avSize, avSize);
    const ringGfx = this.add.graphics();

    const initialsIndex = view.root.getIndex(view.initials);
    const insertAt = initialsIndex >= 0 ? initialsIndex : 4;
    view.root.addAt(glow, insertAt);
    view.root.addAt(img, insertAt + 1);
    view.root.addAt(ringGfx, insertAt + 2);

    view.avatarGlow = glow;
    view.avatar = img;
    view.avatarRing = ringGfx;
    view.avatarSrcKey = srcKey;
    view.initials.setVisible(false);
    view.body.setFillStyle(view.body.fillColor, 0);
    this.paintAvatarRing(ringGfx, avSize * 0.5, b);
  }

  private ensureRoundAvatar(srcKey: string, size = 192): string {
    const destKey = srcKey + '-round-cover';
    if (this.textures.exists(destKey)) return destKey;
    if (!this.textures.exists(srcKey)) return srcKey;

    const canvasTex = this.textures.createCanvas(destKey, size, size);
    if (!canvasTex) return srcKey;

    const ctx = canvasTex.getContext();
    const src = this.textures.get(srcKey).getSourceImage() as CanvasImageSource;
    const srcAny = src as unknown as {
      naturalWidth?: number;
      naturalHeight?: number;
      videoWidth?: number;
      videoHeight?: number;
      width?: number;
      height?: number;
    };
    const sw = srcAny.naturalWidth || srcAny.videoWidth || srcAny.width || size;
    const sh = srcAny.naturalHeight || srcAny.videoHeight || srcAny.height || size;
    const scale = Math.max(size / sw, size / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    const radius = size / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(src, dx, dy, dw, dh);

    const vignette = ctx.createRadialGradient(
      radius,
      radius,
      radius * 0.58,
      radius,
      radius,
      radius
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    canvasTex.refresh();
    return destKey;
  }

  private paintAvatarRing(
    g: Phaser.GameObjects.Graphics,
    radius: number,
    b: BallState
  ): void {
    g.clear();
    const stroke = b.isGalaxy
      ? THEME.lavender
      : b.isKing
        ? THEME.gold
        : b.spawnProtected
          ? THEME.electricCyan
          : THEME.light;
    g.lineStyle(b.isKing ? 5 : 4, stroke, b.spawnProtected ? 0.5 : 0.98);
    g.strokeCircle(0, 0, radius + 1);
    g.lineStyle(6, stroke, b.spawnProtected ? 0.08 : 0.16);
    g.strokeCircle(0, 0, radius + 5);
  }

  private syncPickups(pickups: PickupState[]): void {
    const seen = new Set<string>();
    for (const p of pickups) {
      seen.add(p.id);
      let view = this.pickupViews.get(p.id);
      if (!view) {
        const root = this.add.container(0, 0).setDepth(20);
        const glow = this.add.circle(0, 0, p.radius * 1.6, THEME.electricCyan, 0.15);
        const ring = this.add.circle(0, 0, p.radius + 10, THEME.stone, 0.72);
        ring.setStrokeStyle(3, THEME.electricCyan, 0.85);
        const emoji = this.add
          .text(0, 0, PICKUP_META[p.ability]?.emoji || '✦', {
            fontSize: Math.max(20, Math.round(p.radius * 1.15)) + 'px',
          })
          .setOrigin(0.5);
        root.add([glow, ring, emoji]);
        view = { root, ring, emoji, sourceX: p.x, sourceY: p.y, sourceRadius: p.radius };
        this.pickupViews.set(p.id, view);
      }
      view.sourceX = p.x;
      view.sourceY = p.y;
      view.sourceRadius = p.radius;
      this.positionPickup(view);
    }

    for (const [id, view] of this.pickupViews) {
      if (!seen.has(id)) {
        view.root.destroy(true);
        this.pickupViews.delete(id);
      }
    }
  }

  private positionPickup(view: LandscapePickupView): void {
    const mapper = makeLandscapeMapper(this.cameras.main.width);
    const p = mapper.map(view.sourceX, view.sourceY);
    const r = Math.max(10, view.sourceRadius * mapper.scale);
    view.root.setPosition(p.x, p.y);
    view.ring.setRadius(r + 10);
    view.emoji.setFontSize(Math.max(18, Math.round(r * 1.15)));
  }

  private renderTop5(): void {
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    for (let i = 0; i < this.topRows.length; i++) {
      const row = this.lastTop5[i];
      this.topRows[i].setText(
        row
          ? medals[i] + '  ' + this.truncate(row.nickname || row.username, 15) + '   ☠' + row.kills
          : '—'
      );
    }
  }

  private showWinner(winner: WinnerInfo | null, seconds: number, top5: PlayerStats[]): void {
    this.winnerPanel.setVisible(true);
    if (!winner) {
      this.winnerBody.setText('Rodada encerrada\n\nPróxima em ' + seconds + 's');
      return;
    }
    this.winnerBody.setText(
      [
        '@' + (winner.nickname || winner.username),
        '',
        '☠ ' + winner.kills + ' kills   ·   💀 ' + winner.deaths + ' deaths',
        '💥 ' + winner.damageDealt + ' dano   ·   ⚡ ' + Math.round(winner.highestSpeed),
        '',
        ...top5.slice(0, 3).map((s, i) => i + 1 + '. ' + (s.nickname || s.username) + ' · ☠' + s.kills),
        '',
        'Próxima rodada em ' + seconds + 's',
      ].join('\n')
    );
  }

  private showToast(message: string): void {
    this.toastTween?.stop();
    this.toast.setText(this.truncate(message, 58)).setAlpha(1).setScale(0.9);
    this.toastTween = this.tweens.add({
      targets: this.toast,
      alpha: 0,
      scale: 1.04,
      delay: 1900,
      duration: 360,
      ease: 'Cubic.In',
    });
  }

  private showCountdown(value: number): void {
    this.countdown.setText(String(value)).setAlpha(1).setScale(0.35);
    this.tweens.add({
      targets: this.countdown,
      alpha: 0,
      scale: 1.4,
      duration: 900,
      ease: 'Cubic.Out',
    });
  }

  private spawnImpact(x: number, y: number, color: number): void {
    const mapper = makeLandscapeMapper(this.cameras.main.width);
    const p = mapper.map(x, y);
    const ring = this.add.circle(p.x, p.y, 18, color, 0).setStrokeStyle(6, color, 0.9).setDepth(250);
    this.tweens.add({
      targets: ring,
      scale: 3.1,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  private spawnAbilityEmoji(x: number, y: number, emoji: string): void {
    const mapper = makeLandscapeMapper(this.cameras.main.width);
    const p = mapper.map(x, y);
    const icon = this.add.text(p.x, p.y, emoji, { fontSize: '42px' }).setOrigin(0.5).setDepth(260);
    this.tweens.add({
      targets: icon,
      y: p.y - 80,
      alpha: 0,
      scale: 1.5,
      duration: 700,
      onComplete: () => icon.destroy(),
    });
  }

  private initials(label: string): string {
    const cleaned = (label || '?').replace(/^@/, '').trim();
    const parts = cleaned.split(/[\s_.-]+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
  }

  private truncate(value: string, max: number): string {
    if (!value) return '';
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  private formatTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }
}
