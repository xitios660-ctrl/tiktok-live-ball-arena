import { Router } from 'express';
import type { GameLoop } from '../game/GameLoop';
import type { ITikTokConnector } from '../tiktok/ITikTokConnector';

const startedAt = Date.now();

export function healthRouter(deps: {
  game: GameLoop;
  connector: ITikTokConnector;
  mode: string;
}): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    const snap = deps.game.getSnapshot();
    const round = deps.game.getState();
    const tiktok = deps.connector.getStatus();
    res.json({
      ok: true,
      service: 'tiktok-live-ball-arena',
      mode: deps.mode,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      tiktok,
      live: tiktok.live,
      liveStatus: tiktok.label,
      players: round.playerCount,
      round: {
        phase: round.phase,
        remainingSec: round.remainingSec,
        resultsRemainingSec: round.resultsRemainingSec,
        roundId: round.roundId,
      },
      balls: snap.balls.length,
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}
