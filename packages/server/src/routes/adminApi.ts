import { Router } from 'express';
import type { GameLoop } from '../game/GameLoop';
import type { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { DEMO_GIFT_PRESETS } from '../demo/DemoEventSimulator';

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
    const snap = deps.game.getSnapshot();
    res.json({
      ok: true,
      mode: deps.mode,
      round: deps.game.getState(),
      stats: snap.stats,
      top5: snap.top5,
      winner: snap.winner,
      kingUserId: snap.kingUserId,
      historical: deps.game.getHistorical().slice(0, 10),
      dead: deps.game.getDeadPlayers(),
      balls: snap.balls.map((b) => ({
        userId: b.userId,
        username: b.username,
        hp: b.hp,
        maxHp: b.maxHp,
        spawnProtected: b.spawnProtected,
        revengeMarked: b.revengeMarked,
        shieldHp: b.shieldHp ?? 0,
        buffs: b.buffs ?? [],
        isGalaxy: !!b.isGalaxy,
        sizeScale: b.sizeScale ?? 1,
      })),
      recentCombat: deps.game.getRecentCombat().slice(-20),
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

  router.post('/admin/round/set-time', (req, res) => {
    const sec = Number(req.body?.seconds ?? req.body?.sec ?? 15);
    res.json({ ok: true, round: deps.game.setRemainingSec(sec) });
  });

  router.post('/admin/round/force-end', (_req, res) => {
    res.json({ ok: true, round: deps.game.forceEndRound(), winner: deps.game.getSnapshot().winner });
  });

  router.post('/admin/round/next', (_req, res) => {
    res.json({ ok: true, round: deps.game.forceNextRound() });
  });



  router.post('/admin/sim/comment', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectComment(req.body?.comment, req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/gift', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const giftId = (req.body?.giftId as string) || 'rosa';
    const repeatCount = Number(req.body?.repeatCount) || 1;
    // Target: explicit userId → last spawned / first alive ball
    let user = req.body?.user as { userId?: string; username?: string; nickname?: string } | undefined;
    const targetId =
      (req.body?.userId as string) ||
      user?.userId ||
      deps.game.resolveGiftTargetUserId(null);
    if (targetId) {
      const ball = deps.game.getSnapshot().balls.find((b) => b.userId === targetId);
      const stats = deps.game.getStats().find((s) => s.userId === targetId);
      user = {
        userId: targetId,
        username: ball?.username || stats?.username || user?.username || targetId,
        nickname: ball?.nickname || stats?.nickname || user?.nickname,
      };
    }
    const event = demo.injectGift(giftId, { repeatCount, user });
    const snap = deps.game.getSnapshot();
    const targetBall = snap.balls.find((b) => b.userId === event.user.userId);
    res.json({
      ok: true,
      event,
      target: targetBall
        ? {
            userId: targetBall.userId,
            username: targetBall.username,
            hp: targetBall.hp,
            maxHp: targetBall.maxHp,
            shieldHp: targetBall.shieldHp,
            buffs: targetBall.buffs,
            isGalaxy: targetBall.isGalaxy,
            sizeScale: targetBall.sizeScale,
          }
        : null,
    });
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

  /** Force damage on a living ball (by userId or first ball) */
  router.post('/admin/combat/damage', (req, res) => {
    const snap = deps.game.getSnapshot();
    const victimId =
      (req.body?.victimId as string) ||
      snap.balls[0]?.userId;
    if (!victimId) {
      res.status(400).json({ ok: false, error: 'No living balls' });
      return;
    }
    const damage = Number(req.body?.damage) || 25;
    const attackerId = req.body?.attackerId as string | undefined;
    const events = deps.game.adminDamage(victimId, damage, attackerId);
    res.json({ ok: true, victimId, damage, events, stats: deps.game.getStats() });
  });

  /** Instantly kill a ball */
  router.post('/admin/combat/kill', (req, res) => {
    const snap = deps.game.getSnapshot();
    const victimId =
      (req.body?.victimId as string) ||
      snap.balls[0]?.userId;
    if (!victimId) {
      res.status(400).json({ ok: false, error: 'No living balls' });
      return;
    }
    const attackerId = req.body?.attackerId as string | undefined;
    const events = deps.game.adminKill(victimId, attackerId);
    res.json({ ok: true, victimId, events, stats: deps.game.getStats() });
  });


  /** List dead + respawn via simulated comment */
  router.get('/admin/dead', (_req, res) => {
    res.json({ ok: true, dead: deps.game.getDeadPlayers() });
  });

  router.post('/admin/combat/respawn', (req, res) => {
    const userId = req.body?.userId as string;
    if (!userId) {
      const dead = deps.game.getDeadPlayers();
      if (!dead.length) {
        res.status(400).json({ ok: false, error: 'No dead players / missing userId' });
        return;
      }
      const events = deps.game.adminRespawnComment(dead[0].userId);
      res.json({ ok: true, userId: dead[0].userId, events, stats: deps.game.getStats() });
      return;
    }
    const events = deps.game.adminRespawnComment(userId);
    if (!events.length) {
      res.status(400).json({ ok: false, error: 'Player not dead or unknown' });
      return;
    }
    res.json({ ok: true, userId, events, stats: deps.game.getStats() });
  });

  /** Simulate comment from a specific userId (respawns if dead) */
  router.post('/admin/sim/comment-as', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const userId = req.body?.userId as string;
    if (!userId) {
      res.status(400).json({ ok: false, error: 'userId required' });
      return;
    }
    const stats = deps.game.getStats().find((s) => s.userId === userId);
    const event = demo.injectComment(req.body?.comment || 'volto!', {
      userId,
      username: stats?.username || req.body?.username || userId,
      nickname: stats?.nickname,
    });
    res.json({ ok: true, event, stats: deps.game.getStats() });
  });

  return router;
}
