import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { WaitingScene } from './scenes/WaitingScene';
import { ArenaScene } from './scenes/ArenaScene';
import { connectSocket } from './socket';
import { applyOverlayDom, getOverlayOptions } from './overlayConfig';
import { audio } from './audio/AudioManager';

const opts = getOverlayOptions();
applyOverlayDom(opts);

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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game-container',
  backgroundColor: opts.transparent ? undefined : '#050508',
  transparent: opts.transparent,
  scene: [WaitingScene, ArenaScene],
  scale: {
    // Keep logical arena 1080×1920; FIT letterboxes on any phone/tablet.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  // Reduce scroll/zoom jank on mobile
  input: {
    activePointers: 2,
  },
};

const game = new Phaser.Game(config);
connectSocket(game);

/** Re-FIT on orientation / visual viewport changes (phones). */
function refreshScale(): void {
  try {
    game.scale.refresh();
  } catch {
    /* game may not be ready */
  }
}
window.addEventListener('resize', refreshScale);
window.addEventListener('orientationchange', () => {
  // Delay so browsers settle layout after rotate
  setTimeout(refreshScale, 120);
  setTimeout(refreshScale, 400);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', refreshScale);
}

export default game;
