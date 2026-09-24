/**
 * Cinematic title / phase chrome for the OBS overlay.
 * Palette + Nunito homage only — no copied logos.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '@arena/shared';
import { THEME, THEME_HEX, FONT_BLACK } from '../theme';

export interface CinematicHudHandles {
  root: Phaser.GameObjects.Container;
  titleMain: Phaser.GameObjects.Text;
  titleGlow: Phaser.GameObjects.Text;
  accentLine: Phaser.GameObjects.Graphics;
  phaseLabel: Phaser.GameObjects.Text;
  starsLeft: Phaser.GameObjects.Text;
  starsRight: Phaser.GameObjects.Text;
}

/** Build weighty “BALL ARENA” header with gold accent + ★ flourishes. */
export function createCinematicTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = 100
): CinematicHudHandles {
  const root = scene.add.container(x, y).setDepth(depth);

  const titleGlow = scene.add
    .text(0, 0, 'BALL ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: '46px',
      color: THEME_HEX.gold,
      stroke: THEME_HEX.coral,
      strokeThickness: 10,
    })
    .setOrigin(0.5)
    .setAlpha(0.35);

  const titleMain = scene.add
    .text(0, 0, 'BALL ARENA', {
      fontFamily: FONT_BLACK,
      fontSize: '44px',
      color: THEME_HEX.cream,
      stroke: THEME_HEX.charcoal,
      strokeThickness: 8,
    })
    .setOrigin(0.5);

  try {
    (titleMain as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(4);
  } catch {
    /* Phaser version without letter-spacing */
  }

  const starsLeft = scene.add
    .text(-210, 0, '★', {
      fontFamily: FONT_BLACK,
      fontSize: '22px',
      color: THEME_HEX.gold,
    })
    .setOrigin(0.5)
    .setAlpha(0.85);

  const starsRight = scene.add
    .text(210, 0, '★', {
      fontFamily: FONT_BLACK,
      fontSize: '22px',
      color: THEME_HEX.gold,
    })
    .setOrigin(0.5)
    .setAlpha(0.85);

  const accentLine = scene.add.graphics();
  drawAccentLine(accentLine, 0, 28, 280);

  const phaseLabel = scene.add
    .text(0, 48, 'RODADA', {
      fontFamily: FONT_BLACK,
      fontSize: '20px',
      color: THEME_HEX.muted,
      stroke: '#000000',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setAlpha(0.9);
  try {
    (phaseLabel as unknown as { setLetterSpacing: (n: number) => void }).setLetterSpacing(5);
  } catch {
    /* ignore */
  }

  root.add([titleGlow, titleMain, starsLeft, starsRight, accentLine, phaseLabel]);
  return { root, titleMain, titleGlow, accentLine, phaseLabel, starsLeft, starsRight };
}

function drawAccentLine(g: Phaser.GameObjects.Graphics, cx: number, cy: number, halfW: number): void {
  g.clear();
  g.lineStyle(2, THEME.gold, 0.55);
  g.lineBetween(cx - halfW, cy, cx - 18, cy);
  g.lineBetween(cx + 18, cy, cx + halfW, cy);
  g.fillStyle(THEME.coral, 0.9);
  g.fillCircle(cx, cy, 4);
  g.fillStyle(THEME.lavender, 0.7);
  g.fillCircle(cx - halfW * 0.55, cy, 2.5);
  g.fillCircle(cx + halfW * 0.55, cy, 2.5);
}

export type PhaseChrome =
  | 'waiting'
  | 'countdown'
  | 'running'
  | 'results'
  | 'ended'
  | 'urgent'
  | 'last_minute';

/** Update phase subtitle under the title. */
export function setPhaseChrome(
  hud: CinematicHudHandles,
  phase: string,
  remainingSec?: number
): void {
  let label = 'RODADA';
  let color = THEME_HEX.muted;

  if (phase === 'waiting') {
    label = 'AGUARDANDO';
    color = THEME_HEX.teal;
  } else if (phase === 'countdown') {
    label = 'PREPARAR';
    color = THEME_HEX.gold;
  } else if (phase === 'results' || phase === 'ended') {
    label = 'RESULTADOS';
    color = THEME_HEX.gold;
  } else if (phase === 'running') {
    if (remainingSec != null && remainingSec <= 10) {
      label = 'FINAL';
      color = THEME_HEX.coral;
    } else if (remainingSec != null && remainingSec <= 60) {
      label = 'ÚLTIMO MINUTO';
      color = THEME_HEX.coral;
    } else {
      label = 'RODADA';
      color = THEME_HEX.sage;
    }
  }

  hud.phaseLabel.setText(label).setColor(color);

  if (remainingSec != null && remainingSec <= 10 && phase === 'running') {
    hud.titleMain.setColor(THEME_HEX.coral);
    hud.starsLeft.setColor(THEME_HEX.coral);
    hud.starsRight.setColor(THEME_HEX.coral);
  } else if (phase === 'results' || phase === 'ended') {
    hud.titleMain.setColor(THEME_HEX.gold);
    hud.starsLeft.setColor(THEME_HEX.gold);
    hud.starsRight.setColor(THEME_HEX.gold);
  } else {
    hud.titleMain.setColor(THEME_HEX.cream);
    hud.starsLeft.setColor(THEME_HEX.gold);
    hud.starsRight.setColor(THEME_HEX.gold);
  }
}

/** Larger cinematic winner card chrome (cream on glass). */
export function styleWinnerPanelDramatic(
  scene: Phaser.Scene,
  panel: Phaser.GameObjects.Container,
  title: Phaser.GameObjects.Text,
  body: Phaser.GameObjects.Text,
  hint: Phaser.GameObjects.Text
): void {
  title.setFontSize('58px').setColor(THEME_HEX.gold);
  body.setFontSize('32px').setColor(THEME_HEX.cream);
  hint.setFontSize('28px').setColor(THEME_HEX.teal);
  void scene;
  void panel;
}

export function canvasCenterX(): number {
  return CANVAS_WIDTH / 2;
}
