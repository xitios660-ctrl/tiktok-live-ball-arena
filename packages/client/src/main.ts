import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { WaitingScene } from './scenes/WaitingScene';
import { ArenaScene } from './scenes/ArenaScene';
import { connectSocket } from './socket';
import { applyOverlayDom, getOverlayOptions } from './overlayConfig';
import { audio } from './audio/AudioManager';
import { THEME_HEX } from './theme';

const opts = getOverlayOptions();
applyOverlayDom(opts);
// Phone screen-share: mild BGM trim immediately (mute still wins).
if (opts.phoneLite) audio.setPhoneLite(true);

/** Session flag — don't re-show unlock banner after first successful unlock. */
let audioUnlockedThisSession = false;

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

  if (opts.startMuted) {
    audio.setMuted(true);
    gate?.classList.add('hidden');
    audioUnlockedThisSession = true; // suppress banner for silent OBS
    return;
  }

  if (!gate) {
    // Fallback: invisible gesture unlock if DOM banner missing
    const unlock = async () => {
      if (audioUnlockedThisSession) return;
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

setupAudioUnlockGate();

function boot(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: 'game-container',
    backgroundColor: opts.transparent ? undefined : THEME_HEX.charcoal,
    transparent: opts.transparent,
    scene: [WaitingScene, ArenaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    input: {
      activePointers: 2,
    },
  };

  const game = new Phaser.Game(config);
  connectSocket(game);

  function refreshScale(): void {
    try {
      game.scale.refresh();
    } catch {
      /* game may not be ready */
    }
  }
  window.addEventListener('resize', refreshScale);
  window.addEventListener('orientationchange', () => {
    setTimeout(refreshScale, 120);
    setTimeout(refreshScale, 400);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', refreshScale);
  }

  (window as unknown as { __arenaGame?: Phaser.Game }).__arenaGame = game;
}

/** Prefer Nunito for Phaser text; fall back quickly if fonts API unavailable. */
const fontsReady =
  typeof document !== 'undefined' && document.fonts?.ready
    ? document.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve();
void fontsReady.then(() => boot());

export default null;
