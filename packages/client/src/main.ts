import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@arena/shared';
import { WaitingScene } from './scenes/WaitingScene';
import { ArenaScene } from './scenes/ArenaScene';
import { connectSocket } from './socket';
import { applyOverlayDom, getOverlayOptions } from './overlayConfig';

const opts = getOverlayOptions();
applyOverlayDom(opts);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game-container',
  backgroundColor: opts.transparent ? undefined : '#050508',
  transparent: opts.transparent,
  scene: [WaitingScene, ArenaScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
connectSocket(game);

export default game;
