import { Router } from 'express';
import type { GameLoop } from '../game/GameLoop';
import type { ITikTokConnector } from '../tiktok/ITikTokConnector';
import type { DemoEventSimulator } from '../demo/DemoEventSimulator';

export function healthRouter(deps: {
  game: GameLoop;
  connector: ITikTokConnector;
  mode: string;
}): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    const demo = deps.connector as DemoEventSimulator;
    res.json({
      ok: true,
      service: 'tiktok-live-ball-arena',
      mode: deps.mode,
      connector: deps.connector.name,
      connected: deps.connector.isConnected(),
      round: deps.game.getState(),
      demo:
        deps.mode === 'demo' && typeof demo.getStatus === 'function'
          ? demo.getStatus()
          : undefined,
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}
