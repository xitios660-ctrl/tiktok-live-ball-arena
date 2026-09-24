import { Router } from 'express';
import type { GameLoop } from '../game/GameLoop';
import type { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { DEMO_GIFT_PRESETS } from '../demo/DemoEventSimulator';

/**
 * Admin REST API for DEMO playtesting.
 * Only active / meaningful when connector is DemoEventSimulator.
 */
export function adminApiRouter(deps: {
  game: GameLoop;
  getDemo: () => DemoEventSimulator | null;
  mode: string;
}): Router {
  const router = Router();

  const requireDemo = (
    _req: unknown,
    res: { status: (n: number) => { json: (b: unknown) => void } },
    next: () => void
  ) => {
    const demo = deps.getDemo();
    if (!demo) {
      res.status(400).json({
        ok: false,
        error: 'Admin simulate endpoints only work in TIKTOK_MODE=demo',
      });
      return;
    }
    next();
  };

  router.get('/admin/status', (_req, res) => {
    const demo = deps.getDemo();
    res.json({
      ok: true,
      mode: deps.mode,
      round: deps.game.getState(),
      recentEvents: deps.game.getRecentEvents().slice(-20),
      demo: demo?.getStatus() ?? null,
      gifts: DEMO_GIFT_PRESETS,
    });
  });

  router.post('/admin/round/start', (_req, res) => {
    res.json({ ok: true, round: deps.game.startRound() });
  });

  router.post('/admin/round/end', (_req, res) => {
    res.json({ ok: true, round: deps.game.endRound() });
  });

  router.post('/admin/round/reset', (_req, res) => {
    res.json({ ok: true, round: deps.game.resetToWaiting() });
  });

  router.post('/admin/sim/comment', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectComment(req.body?.comment, req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/gift', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const giftId = (req.body?.giftId as string) || 'rosa';
    const event = demo.injectGift(giftId, {
      repeatCount: req.body?.repeatCount,
      user: req.body?.user,
    });
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/like', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectLike(Number(req.body?.likeCount) || 5, req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/share', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectShare(req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/join', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectJoin(req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/follow', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectFollow(req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/bots', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const count = Number(req.body?.count) || 5;
    const withGift = Boolean(req.body?.withGift);
    const events = demo.spawnBots(count, withGift);
    res.json({ ok: true, count: events.filter((e) => e.type === 'join').length, events });
  });

  router.post('/admin/sim/disconnect', requireDemo, async (_req, res) => {
    const demo = deps.getDemo()!;
    await demo.disconnect();
    res.json({ ok: true, status: demo.getStatus() });
  });

  router.post('/admin/sim/reconnect', requireDemo, async (_req, res) => {
    const demo = deps.getDemo()!;
    await demo.reconnect();
    res.json({ ok: true, status: demo.getStatus() });
  });

  router.post('/admin/sim/auto', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const enabled = req.body?.enabled !== false && req.body?.enabled !== 'false';
    demo.setAutoEnabled(Boolean(enabled));
    res.json({ ok: true, status: demo.getStatus() });
  });

  return router;
}
