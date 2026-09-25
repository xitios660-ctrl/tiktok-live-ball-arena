import { Router } from 'express';
import type { GameLoop } from '../game/GameLoop';
import type { DemoEventSimulator } from '../demo/DemoEventSimulator';
import { DEMO_GIFT_PRESETS, DEMO_PICKUP_PRESETS } from '../demo/DemoEventSimulator';
import { PICKUP_META, isBotUser } from '@arena/shared';
import { pickupAbilityFromGiftId } from '../game/PickupSystem';

export function adminApiRouter(deps: {
  game: GameLoop;
  getDemo: () => DemoEventSimulator | null;
  mode: string;
  connector: import('../tiktok/ITikTokConnector').ITikTokConnector;
}): Router {
  const router = Router();


  /** Build gift event and push through the same GameLoop path (works in DEMO + PRODUCTION). */
  const injectGiftDirect = (giftId: string, opts: { repeatCount?: number; user?: { userId?: string; username?: string; nickname?: string } }) => {
    const presets = DEMO_GIFT_PRESETS;
    const preset = presets.find((g) => g.giftId === giftId) || presets[0];
    let user = opts.user;
    const targetId =
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
    const event = {
      type: 'gift' as const,
      user: {
        userId: user?.userId || `admin-${Date.now()}`,
        username: user?.username || 'admin_gifter',
        nickname: user?.nickname,
      },
      giftId: preset.giftId,
      giftName: preset.giftName,
      repeatCount: Math.max(1, Number(opts.repeatCount) || 1),
      repeatEnd: true,
      coinValue: preset.coinValue,
      timestamp: Date.now(),
    };
    deps.game.handleLiveEvent(event);
    return event;
  };

  /** Spawn bots via GameLoop joins (works in DEMO + PRODUCTION). Bots never receive paid gifts. */
  const spawnBotsDirect = (count: number) => {
    const n = Math.max(1, Math.min(150, Math.floor(count)));
    const events: Array<{ type: string; [k: string]: unknown }> = [];
    const seq = Date.now();
    for (let i = 0; i < n; i++) {
      const user = {
        userId: `bot-${seq}-${i}`,
        username: `bot_${i + 1}_${String(seq).slice(-4)}`,
        nickname: `Bot ${i + 1}`,
      };
      const join = { type: 'join' as const, user, timestamp: Date.now() };
      deps.game.handleLiveEvent(join);
      events.push(join);
    }
    return events;
  };

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
        isKing: !!b.isKing,
        kills: b.kills ?? 0,
        hitPower: b.hitPower ?? 0,
        strengthMult: b.strengthMult ?? 1,
      })),
      recentCombat: deps.game.getRecentCombat().slice(-20),
      recentEvents: deps.game.getRecentEvents().slice(-20),
      demo: demo?.getStatus() ?? null,
      tiktok: deps.connector.getStatus(),
      global: deps.game.getGlobalState(),
      gifts: DEMO_GIFT_PRESETS,
      pickupPresets: DEMO_PICKUP_PRESETS,
      pickups: snap.pickups || [],
    });
  });

  /**
   * Runtime TikTok switch. Accepts either @username or a full
   * https://www.tiktok.com/@username/live URL. This lets production recover
   * immediately when the broadcaster account changes without waiting for a deploy.
   */
  router.post('/admin/tiktok/connect', async (req, res) => {
    const raw = String(req.body?.username || req.body?.url || '').trim();
    const fromUrl = raw.match(/tiktok\.com\/@([^/?#]+)/i)?.[1];
    const username = decodeURIComponent(fromUrl || raw)
      .replace(/^@/, '')
      .replace(/\?.*$/, '')
      .replace(/\/$/, '')
      .trim();

    if (!username) {
      res.status(400).json({
        ok: false,
        error: 'Informe o @username ou cole o link da LIVE do TikTok.',
      });
      return;
    }

    try {
      await deps.connector.connect(username);
      res.json({
        ok: true,
        username,
        status: deps.connector.getStatus(),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        username,
        error: err instanceof Error ? err.message : String(err),
        status: deps.connector.getStatus(),
      });
    }
  });

  router.post('/admin/tiktok/reconnect', async (_req, res) => {
    const username = deps.connector.getStatus().username;
    if (!username) {
      res.status(400).json({ ok: false, error: 'Nenhum @username configurado.' });
      return;
    }
    try {
      await deps.connector.connect(username);
      res.json({ ok: true, username, status: deps.connector.getStatus() });
    } catch (err) {
      res.status(502).json({
        ok: false,
        username,
        error: err instanceof Error ? err.message : String(err),
        status: deps.connector.getStatus(),
      });
    }
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



  router.post('/admin/sim/comment', (req, res) => {
    const bodyUser = req.body?.user as { userId?: string; username?: string; nickname?: string } | undefined;
    const user = {
      userId: bodyUser?.userId || `admin-comment-${Date.now()}`,
      username: bodyUser?.username || 'admin_commenter',
      nickname: bodyUser?.nickname || 'Admin',
    };
    const event = {
      type: 'comment' as const,
      user,
      comment: (req.body?.comment as string) || 'bora!',
      timestamp: Date.now(),
    };
    deps.game.handleLiveEvent(event);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/gift', (req, res) => {
    const giftId = (req.body?.giftId as string) || 'rosa';
    // Floor powers: redirect to pickup spawn (do not apply to a selected ball)
    const pickupAbility = pickupAbilityFromGiftId(giftId);
    if (pickupAbility) {
      const result = deps.game.adminSpawnPickup(pickupAbility);
      if (!result.ok) {
        res.status(400).json(result);
        return;
      }
      res.json({
        ok: true,
        diverted: 'pickup',
        ability: pickupAbility,
        pickup: result.pickup,
        pickups: deps.game.getSnapshot().pickups,
      });
      return;
    }
    const repeatCount = Number(req.body?.repeatCount) || 1;
    const user = req.body?.user as { userId?: string; username?: string; nickname?: string } | undefined;
    const userId = (req.body?.userId as string) || user?.userId;
    const event = injectGiftDirect(giftId, { repeatCount, user: { ...user, userId } });
    const snap = deps.game.getSnapshot();
    const targetBall = snap.balls.find((b) => b.userId === event.user.userId);
    res.json({
      ok: true,
      event,
      mode: deps.mode,
      target: targetBall
        ? {
            userId: targetBall.userId,
            username: targetBall.username,
            hp: targetBall.hp,
            maxHp: targetBall.maxHp,
            shieldHp: targetBall.shieldHp ?? 0,
            buffs: targetBall.buffs ?? [],
            isGalaxy: !!targetBall.isGalaxy,
            sizeScale: targetBall.sizeScale ?? 1,
          }
        : null,
    });
  });

  router.post('/admin/sim/like', (req, res) => {
    const likeCount = Math.max(1, Number(req.body?.likeCount) || 100);
    const demo = deps.getDemo();

    let user = req.body?.user as
      | { userId?: string; username?: string; nickname?: string }
      | undefined;
    const targetId =
      (req.body?.userId as string | undefined) ||
      user?.userId ||
      deps.game.resolveGiftTargetUserId(null);

    if (targetId) {
      const ball = deps.game.getSnapshot().balls.find((b) => b.userId === targetId);
      const stats = deps.game.getStats().find((st) => st.userId === targetId);
      user = {
        userId: targetId,
        username: ball?.username || stats?.username || user?.username || targetId,
        nickname: ball?.nickname || stats?.nickname || user?.nickname,
      };
    }

    if (!user?.userId) {
      res.status(400).json({
        ok: false,
        error: 'No active player to receive likes. Comment/spawn a player first or pass userId.',
      });
      return;
    }

    if (demo) {
      demo.injectLike(likeCount, user);
    } else {
      deps.game.handleLiveEvent({
        type: 'like',
        user: {
          userId: user.userId,
          username: user.username || user.userId,
          nickname: user.nickname,
        },
        likeCount,
        timestamp: Date.now(),
      });
    }

    const target = deps.game
      .getSnapshot()
      .balls.find((b) => b.userId === user!.userId);

    res.json({
      ok: true,
      likeCount,
      user,
      target: target
        ? {
            userId: target.userId,
            hp: target.hp,
            maxHp: target.maxHp,
            hitPower: target.hitPower ?? 0,
            strengthMult: target.strengthMult ?? 1,
            titanStacks: target.titanStacks ?? 0,
            buffs: target.buffs ?? [],
          }
        : null,
      global: deps.game.getGlobalState(),
    });
  });

  router.post('/admin/sim/share', (req, res) => {
    const demo = deps.getDemo();
    let user = req.body?.user;
    const targetId = req.body?.userId || user?.userId || deps.game.resolveGiftTargetUserId(null);
    if (targetId) {
      const ball = deps.game.getSnapshot().balls.find((b) => b.userId === targetId);
      const stats = deps.game.getStats().find((s) => s.userId === targetId);
      user = {
        userId: targetId,
        username: ball?.username || stats?.username || user?.username || targetId,
        nickname: ball?.nickname || stats?.nickname || user?.nickname,
      };
    }
    if (demo && user) {
      demo.injectShare(user);
    } else if (user) {
      deps.game.handleShare(user);
    } else if (demo) {
      demo.injectShare();
    }
    res.json({ ok: true, user, global: deps.game.getGlobalState() });
  });

  router.post('/admin/sim/join', (req, res) => {
    const bodyUser = req.body?.user as { userId?: string; username?: string; nickname?: string } | undefined;
    const seq = Date.now();
    const user = {
      userId: bodyUser?.userId || `admin-join-${seq}`,
      username: bodyUser?.username || `joiner_${String(seq).slice(-4)}`,
      nickname: bodyUser?.nickname || 'Joiner',
    };
    const event = { type: 'join' as const, user, timestamp: Date.now() };
    deps.game.handleLiveEvent(event);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/follow', requireDemo, (req, res) => {
    const demo = deps.getDemo()!;
    const event = demo.injectFollow(req.body?.user);
    res.json({ ok: true, event });
  });

  router.post('/admin/sim/bots', (req, res) => {
    const count = Number(req.body?.count) || 5;
    const events = spawnBotsDirect(count);
    res.json({
      ok: true,
      count: events.filter((e) => e.type === 'join').length,
      events,
      mode: deps.mode,
      players: deps.game.getState().playerCount,
    });
  });

  router.post('/admin/sim/loadtest', (req, res) => {
    const count = Math.min(150, Math.max(1, Number(req.body?.count) || 50));
    const giftSpam = Boolean(req.body?.giftSpam);
    const events = spawnBotsDirect(count);
    let gifts = 0;
    if (giftSpam) {
      const balls = deps.game.getSnapshot().balls;
      for (const b of balls.slice(0, Math.min(20, balls.length))) {
        if (isBotUser(b)) continue;
        injectGiftDirect('rosa', {
          user: { userId: b.userId, username: b.username, nickname: b.nickname },
        });
        gifts += 1;
      }
    }
    res.json({
      ok: true,
      spawned: events.filter((e) => e.type === 'join').length,
      gifts,
      players: deps.game.getState().playerCount,
      mode: deps.mode,
    });
  });

  router.post('/admin/events/random', (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled === 'boolean') deps.game.setRandomEventsEnabled(enabled);
    res.json({ ok: true, global: deps.game.getGlobalState() });
  });

  router.post('/admin/events/force', (req, res) => {
    const kind = (req.body?.kind as string) || 'heal_rain';
    if (kind !== 'heal_rain' && kind !== 'speed_storm' && kind !== 'double_damage') {
      res.status(400).json({ ok: false, error: 'kind must be heal_rain|speed_storm|double_damage' });
      return;
    }
    deps.game.forceArenaEvent(kind);
    res.json({ ok: true, kind, global: deps.game.getGlobalState() });
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

  /** Force-spawn a floor pickup near center (testing). */
  router.post('/admin/sim/pickup', (req, res) => {
    const raw = (req.body?.ability as string) || (req.body?.giftId as string) || 'raio';
    const result = deps.game.adminSpawnPickup(raw);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json({
      ok: true,
      ability: result.pickup?.ability,
      pickup: result.pickup,
      pickups: deps.game.getSnapshot().pickups,
      meta: result.pickup ? PICKUP_META[result.pickup.ability] : undefined,
    });
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
  router.post('/admin/sim/comment-as', (req, res) => {
    const userId = req.body?.userId as string;
    if (!userId) {
      res.status(400).json({ ok: false, error: 'userId required' });
      return;
    }
    const stats = deps.game.getStats().find((s) => s.userId === userId);
    const event = {
      type: 'comment' as const,
      user: {
        userId,
        username: stats?.username || (req.body?.username as string) || userId,
        nickname: stats?.nickname,
      },
      comment: (req.body?.comment as string) || 'volto!',
      timestamp: Date.now(),
    };
    deps.game.handleLiveEvent(event);
    res.json({ ok: true, event, stats: deps.game.getStats() });
  });

  return router;
}
