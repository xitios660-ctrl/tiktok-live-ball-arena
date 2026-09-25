import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { WaitingScene } from './scenes/WaitingScene';
import { ArenaScene } from './scenes/ArenaScene';
import { PhoneLandscapeWaitingScene } from './scenes/PhoneLandscapeWaitingScene';
import { PhoneLandscapeArenaScene } from './scenes/PhoneLandscapeArenaScene';
import { connectSocket } from './socket';
import { applyOverlayDom, getOverlayOptions } from './overlayConfig';
import { audio } from './audio/AudioManager';
import { THEME_HEX } from './theme';
import { runCinematicIntro, shouldShowCinematicIntro } from './ui/CinematicIntro';
import {
  LANDSCAPE_HEIGHT,
  landscapeGameWidth,
  shouldUsePhoneLandscape,
  viewportSize,
} from './phoneLandscape';

const opts = getOverlayOptions();
applyOverlayDom(opts);
const initialPhoneLandscape = shouldUsePhoneLandscape(opts);
document.documentElement.classList.toggle('native-landscape', initialPhoneLandscape);
document.documentElement.classList.remove('spin-landscape');
// Phone screen-share: mild BGM trim immediately (mute still wins).
if (opts.phoneLite) audio.setPhoneLite(true);

/** Session flag — don't re-show unlock banner after first successful unlock. */
let audioUnlockedThisSession = false;

type FullscreenRoot = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

function tryEnterPhoneFullscreen(): void {
  if (!opts.phoneLite || document.fullscreenElement) return;
  const root = document.documentElement as FullscreenRoot;
  try {
    const result =
      typeof root.requestFullscreen === 'function'
        ? root.requestFullscreen()
        : root.webkitRequestFullscreen?.();
    if (result && typeof (result as Promise<void>).catch === 'function') {
      void (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Some iOS/in-app browsers do not expose document fullscreen.
  }
}

/** Brief toast when BGM fails to start — invite another tap. */
function showAudioRetryToast(msg = 'toque de novo'): void {
  const existing = document.getElementById('audio-retry-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'audio-retry-toast';
  el.textContent = msg;
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    zIndex: '100000',
    padding: '10px 18px',
    borderRadius: '12px',
    background: 'rgba(11,11,15,0.92)',
    border: '1px solid rgba(255,209,102,0.65)',
    color: '#FFD166',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '0.03em',
    boxShadow: '0 0 20px rgba(34,211,238,0.35)',
    pointerEvents: 'none',
  });
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2800);
}

/**
 * Visible unlock gate for mobile autoplay policy.
 * ?mute=1 keeps silent (OBS) and skips the banner.
 * Gate stays until BGM actually starts (or toast "toque de novo").
 */
function setupAudioUnlockGate(): void {
  const gate = document.getElementById('audio-unlock-gate');

  if (audioUnlockedThisSession) {
    gate?.classList.add('hidden');
    return;
  }

  if (opts.startMuted) {
    audio.setMuted(true);
    gate?.classList.add('hidden');
    audioUnlockedThisSession = true; // suppress banner for silent OBS
    return;
  }

  gate?.classList.remove('hidden');

  if (!gate) {
    // Fallback: invisible gesture unlock if DOM banner missing
    const unlock = async () => {
      if (audioUnlockedThisSession) return;
      tryEnterPhoneFullscreen();
      const ok = await audio.unlock();
      if (ok) {
        audioUnlockedThisSession = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      } else {
        showAudioRetryToast('toque de novo');
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return;
  }

  const titleEl = gate.querySelector('.gate-title');
  const subEl = gate.querySelector('.gate-sub');

  const doUnlock = async () => {
    if (audioUnlockedThisSession) return;
    tryEnterPhoneFullscreen();
    const ok = await audio.unlock();
    if (ok) {
      audioUnlockedThisSession = true;
      gate.classList.add('hidden');
      gate.removeEventListener('pointerdown', onGateTap);
      gate.removeEventListener('touchstart', onGateTap);
      window.removeEventListener('keydown', onKey);
      document.getElementById('audio-retry-toast')?.remove();
    } else {
      if (titleEl) titleEl.textContent = '🔊 TOQUE DE NOVO';
      if (subEl) subEl.textContent = 'áudio ainda não iniciou — toque outra vez';
      showAudioRetryToast('toque de novo');
    }
  };

  const onGateTap = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    void doUnlock();
  };
  const onKey = () => {
    void doUnlock();
  };

  gate.addEventListener('pointerdown', onGateTap, { passive: false });
  gate.addEventListener('touchstart', onGateTap, { passive: false });
  window.addEventListener('keydown', onKey);
}

function boot(): void {
  const initialWidth = initialPhoneLandscape ? landscapeGameWidth() : CANVAS_WIDTH;
  const initialHeight = initialPhoneLandscape ? LANDSCAPE_HEIGHT : CANVAS_HEIGHT;
  const scenes = initialPhoneLandscape
    ? [PhoneLandscapeWaitingScene, PhoneLandscapeArenaScene]
    : [WaitingScene, ArenaScene];

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: initialWidth,
    height: initialHeight,
    parent: 'game-container',
    backgroundColor: opts.transparent ? undefined : THEME_HEX.charcoal,
    transparent: opts.transparent,
    scene: scenes,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: initialWidth,
      height: initialHeight,
    },
    input: {
      activePointers: 2,
    },
  };

  const game = new Phaser.Game(config);
  connectSocket(game);

  /** Sync CSS vars to visualViewport and keep the native landscape canvas full-bleed. */
  function syncViewportLayout(): void {
    const vv = window.visualViewport;
    const { width: w, height: h } = viewportSize();
    const left = vv?.offsetLeft ?? 0;
    const top = vv?.offsetTop ?? 0;
    const root = document.documentElement;
    root.style.setProperty('--vvw', `${Math.round(w)}px`);
    root.style.setProperty('--vvh', `${Math.round(h)}px`);
    root.style.setProperty('--vv-left', `${Math.round(left)}px`);
    root.style.setProperty('--vv-top', `${Math.round(top)}px`);
    root.classList.toggle('native-landscape', initialPhoneLandscape);
    root.classList.remove('spin-landscape');

    if (initialPhoneLandscape) {
      const targetWidth = landscapeGameWidth();
      const currentWidth = Number(game.scale.gameSize.width);
      if (Math.abs(currentWidth - targetWidth) > 2) {
        game.scale.setGameSize(targetWidth, LANDSCAPE_HEIGHT);
      }
    }

    void document.body.offsetHeight;
  }

  function refreshScale(): void {
    syncViewportLayout();
    try {
      game.scale.refresh();
    } catch {
      /* game may not be ready */
    }
  }

  /** Debounced refresh. A real orientation switch reloads only the client renderer;
   * server-authoritative round state is restored immediately by the socket snapshot. */
  const refreshTimers: number[] = [];
  let orientationReloadTimer = 0;
  function scheduleRefresh(): void {
    const wantsLandscape = shouldUsePhoneLandscape(opts);
    if (wantsLandscape !== initialPhoneLandscape) {
      window.clearTimeout(orientationReloadTimer);
      orientationReloadTimer = window.setTimeout(() => window.location.reload(), 320);
      return;
    }

    refreshScale();
    for (const t of refreshTimers) window.clearTimeout(t);
    refreshTimers.length = 0;
    for (const ms of [50, 150, 400]) {
      refreshTimers.push(window.setTimeout(refreshScale, ms));
    }
  }

  syncViewportLayout();
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('orientationchange', scheduleRefresh);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleRefresh);
    window.visualViewport.addEventListener('scroll', scheduleRefresh);
  }
  // Some WebViews fire this after rotate settles.
  window.addEventListener('pageshow', scheduleRefresh);

  (window as unknown as { __arenaGame?: Phaser.Game }).__arenaGame = game;
}

/** Prefer Nunito for Phaser text; fall back quickly if fonts API unavailable. */
const fontsReady =
  typeof document !== 'undefined' && document.fonts?.ready
    ? document.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve();
void fontsReady.then(async () => {
  const wantsCinematicIntro = shouldShowCinematicIntro(opts);
  // Boot the real game behind the cinematic layer so the socket and round
  // state are already warm when the player presses JOGAR.
  boot();

  if (wantsCinematicIntro) {
    // The stock mobile audio gate exists in index.html and is visible by default.
    // Hide it while the cinematic home owns the screen; JOGAR itself is the
    // first user gesture and attempts the audio unlock.
    document.getElementById('audio-unlock-gate')?.classList.add('hidden');
    await runCinematicIntro({
      onPlayGesture: async () => {
        tryEnterPhoneFullscreen();
        try {
          audio.prepare();
          await audio.startBgm(true);
          audioUnlockedThisSession = true;
        } catch {
          // The normal audio gate remains available after the transition.
        }
      },
    });
  }

  setupAudioUnlockGate();
});

export default null;
