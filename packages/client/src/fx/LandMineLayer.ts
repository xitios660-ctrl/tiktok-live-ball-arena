import Phaser from 'phaser';
import type { LandMineState } from '@arena/shared';
import { MINE_TEXTURE } from '../weaponPresentation';
import { THEME } from '../theme';

export interface MineDisplayPosition {
  x: number;
  y: number;
  scale?: number;
}

type PositionMapper = (mine: LandMineState) => MineDisplayPosition;

interface MineView {
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
}

/** Keeps armed mines visible to every viewer until the server detonates/removes them. */
export class LandMineLayer {
  private readonly views = new Map<string, MineView>();

  constructor(private readonly scene: Phaser.Scene, private readonly depth = 9) {}

  sync(mines: readonly LandMineState[] | undefined, map: PositionMapper = (mine) => ({ x: mine.x, y: mine.y })): void {
    const list = mines ?? [];
    const seen = new Set<string>();
    for (const mine of list) {
      seen.add(mine.id);
      let view = this.views.get(mine.id);
      if (!view) {
        const root = this.scene.add.container(mine.x, mine.y).setDepth(this.depth);
        const glow = this.scene.add.circle(0, 0, 24, THEME.electricCyan, 0.12);
        const ring = this.scene.add.circle(0, 0, 20, 0x000000, 0).setStrokeStyle(2, THEME.gold, 0.85);
        const sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Text = this.scene.textures.exists(MINE_TEXTURE)
          ? this.scene.add.image(0, 0, MINE_TEXTURE).setDisplaySize(35, 35)
          : this.scene.add.text(0, 0, '💣', { fontSize: '30px' }).setOrigin(0.5);
        const label = this.scene.add
          .text(0, 22, 'MINA ARMADA', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '8px',
            fontStyle: 'bold',
            color: '#75f7ff',
            stroke: '#0b0b0f',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        root.add([glow, ring, sprite, label]);
        view = { root, glow, ring, sprite };
        this.views.set(mine.id, view);
      }
      const position = map(mine);
      const scale = position.scale ?? 1;
      view.root.setPosition(position.x, position.y).setScale(scale);
      view.sprite.setAngle(0);
    }

    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.root.destroy(true);
        this.views.delete(id);
      }
    }
  }

  tick(time: number): void {
    for (const view of this.views.values()) {
      const pulse = (Math.sin(time / 240 + view.root.x * 0.02) + 1) / 2;
      view.root.setAlpha(0.82 + pulse * 0.18);
      view.glow.setScale(0.9 + pulse * 0.25);
      view.ring.setStrokeStyle(2, pulse > 0.55 ? THEME.gold : THEME.electricCyan, 0.68 + pulse * 0.27);
    }
  }

  clear(): void {
    for (const view of this.views.values()) view.root.destroy(true);
    this.views.clear();
  }
}
