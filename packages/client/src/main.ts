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
// Phone screen-share: lower ambient ceiling immediately (mute still wins).
if (opts.phoneLite) audio.setPhoneLite(true);

/** Unlock Web Audio on first user gesture (required on iOS/Android). */
function bindAudioUnlock(): void {
  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}
bindAudioUnlock();

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
