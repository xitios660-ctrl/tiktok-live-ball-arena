import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EconomyStore, STORE_CATALOG } from './economy/EconomyStore';
import { GameLoop } from './game/GameLoop';
import { PhysicsWorld } from './game/PhysicsWorld';
import { CHATGPT_BOSS_REWARD_STRENGTH, CHATGPT_BOSS_USER_ID } from './game/ChatGPTBoss';
import type { ArenaUser } from '@arena/shared';

const assert: (v: unknown, m: string) => asserts v = (v, m) => { if (!v) throw new Error('[WEAPON SELFTEST] ' + m); };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const user = (id: string, username: string): ArenaUser => ({ userId: id, username });

async function main() {
  const file = path.join(os.tmpdir(), `arena-weapons-${Date.now()}.json`);
  const store = new EconomyStore(file); await store.init();
  const slugs = ['vida-tripla','pistola','metralhadora','12-escopeta','sniper','bazuca','mina-terrestre'];
  const catalog = await store.getCatalog();
  assert(slugs.every(s => catalog.some(i => i.slug === s)), 'catalog missing requested item');
  assert(!catalog.some(i => i.slug === 'iron-guard' || i.slug === 'marksman-rifle'), 'legacy weapon/guard still active');
  await store.recordKill('@Test.User', 'tt-1', 'k1'); await store.recordKill('test.user', 'tt-1', 'k2');
  assert((await store.getPlayer('test.user')).kills === 2, 'username normalization/dedupe failed');
  await store.adminAdjust('test.user', 2000, 'weapon test seed', 'weapon-seed');
  const life = await store.purchase('@test.user', 'vida-tripla', 'life-op');
  assert(life.item?.status === 'pending_entry', 'Vida Tripla not pending entry');
  assert(await store.consumeNextEntry('TEST.USER', 'entry-test'), 'Vida Tripla did not consume');
  assert(!(await store.consumeNextEntry('test.user', 'entry-test-2')), 'Vida Tripla accumulated/reused');

  const game = new GameLoop('demo', 300, store);
  const attacker = user('attacker', 'test.user'); const target = user('target', 'target_user');
  game.handleLiveEvent({ type:'comment', user:attacker, comment:'entrar', timestamp:Date.now() });
  game.handleLiveEvent({ type:'comment', user:target, comment:'entrar', timestamp:Date.now() });
  await wait(40);
  const physics = (game as any).physics as PhysicsWorld;
  const a = physics.getBall('attacker')!; const t = physics.getBall('target')!;
  const autoBuy = await store.purchase('test.user', 'pistola', 'live-auto-buy');
  assert(autoBuy.ok && autoBuy.item, 'live purchase fixture failed');
  await game.syncPurchasedItem('test.user', autoBuy.item!);
  assert(game.getSnapshot().balls.find((b) => b.userId === 'attacker')?.equippedItem?.slug === 'pistola', 'live purchase was not equipped immediately');
  a.x=300; a.y=300; t.x=350; t.y=300;
  const weaponSlugs = ['pistola','metralhadora','12-escopeta','sniper','bazuca','mina-terrestre'];
  for (const slug of weaponSlugs) {
    const item = slug === 'pistola' ? autoBuy : await store.purchase('test.user', slug, `buy-${slug}`);
    assert(item.ok && item.item, `purchase failed ${slug}`);
    if (slug !== 'pistola') {
      game.handleLiveEvent({ type:'comment', user:attacker, comment:`!usar ${slug}`, timestamp:Date.now() });
    }
    await wait(35);
    const before = t.hp;
    const cache = (game as any).catalogCache as Map<string, unknown>;
    assert(cache.has(slug), `equip cache missing ${slug}`);
    const states = (game as any).weaponStates as Map<string, {lastUseAt:number; ammo:number; reloadAt:number}>;
    const st = states.get(item.item!.id); if (st) { st.lastUseAt = 0; st.reloadAt = 0; st.ammo = catalog.find(i => i.slug === slug)!.ammo; }
    if (slug === 'mina-terrestre') {
      (game as any).processAutoWeapons();
      (game as any).processLandMines();
      t.x = a.x; t.y = a.y;
      (game as any).processLandMines();
    } else {
      (game as any).processAutoWeapons();
    }
    assert(t.hp < before, `${slug} auto-fire/area did not damage target`);
    t.hp = t.maxHp;
  }
  game.destroy();

  const pw = new PhysicsWorld();
  pw.spawnOrNudge(user(CHATGPT_BOSS_USER_ID, 'boss')); pw.spawnOrNudge(user('foe', 'foe')); pw.spawnOrNudge(user('foe-2', 'foe_2'));
  const boss = pw.getBall(CHATGPT_BOSS_USER_ID)!; const foe = pw.getBall('foe')!; const foe2 = pw.getBall('foe-2')!;
  boss.x=100;boss.y=100;foe.x=140;foe.y=100;foe2.x=180;foe2.y=100;
  boss.spawnProtectedUntil = 0; foe.spawnProtectedUntil = 0; foe2.spawnProtectedUntil = 0;
  const hp = foe.hp; const hp2 = foe2.hp; const zaps = pw.applyBossLightning(CHATGPT_BOSS_USER_ID);
  assert(zaps.length === 2 && foe.hp === hp - 10 && foe2.hp === hp2 - 10, 'boss global lightning did not deal 10 damage to every player');
  assert(foe.slowUntil > Date.now() && foe2.slowUntil > Date.now(), 'boss lightning slow missing');

  const forceWorld = new PhysicsWorld();
  forceWorld.spawnOrNudge(user('force-a', 'force_a')); forceWorld.spawnOrNudge(user('force-b', 'force_b'));
  const strong = forceWorld.getBall('force-a')!; const victim = forceWorld.getBall('force-b')!;
  strong.hitPower = 50; strong.x = 100; strong.y = 100; strong.vx = 200; strong.vy = 0;
  victim.x = 160; victim.y = 100; victim.vx = -200; victim.vy = 0;
  strong.spawnProtectedUntil = 0; victim.spawnProtectedUntil = 0;
  const forceResult = forceWorld.step(1 / 30);
  assert(forceResult.damages.some((d) => d.attackerId === 'force-a' && d.damage === 50), '50 force did not produce 50 collision damage');
  assert(victim.hp === 150, '50 force should remove exactly 50 from 200 HP');

  const rewardGame = new GameLoop('demo', 60);
  rewardGame.setRandomEventsEnabled(false);
  rewardGame.handleLiveEvent({ type: 'comment', user: user('reward-attacker', 'reward_attacker'), comment: 'entrar', timestamp: Date.now() });
  await wait(2_100);
  const bossState = rewardGame.getSnapshot().balls.find((b) => b.userId === CHATGPT_BOSS_USER_ID);
  assert(bossState && bossState.maxHp === 5_000 && bossState.radius >= 150, 'Boss did not spawn giant with high HP');
  const rewardAttacker = rewardGame.getSnapshot().balls.find((b) => b.userId === 'reward-attacker');
  assert(rewardAttacker, 'Boss reward attacker did not spawn');
  (rewardGame as any).physics.getBall('reward-attacker').spawnProtectedUntil = 0;
  (rewardGame as any).physics.getBall(CHATGPT_BOSS_USER_ID).spawnProtectedUntil = 0;
  const rewardBeforePower = (rewardGame as any).physics.getBall('reward-attacker').hitPower;
  (rewardGame as any).hitPowerCooldown.set(`reward-attacker:${CHATGPT_BOSS_USER_ID}`, Date.now());
  rewardGame.adminKill(CHATGPT_BOSS_USER_ID, 'reward-attacker');
  const attackerState = rewardGame.getSnapshot().balls.find((b) => b.userId === 'reward-attacker');
  const internalRewardPower = (rewardGame as any).physics.getBall('reward-attacker')?.hitPower;
  const statsReward = rewardGame.getStats().find((s) => s.userId === 'reward-attacker');
  assert(attackerState?.hitPower === rewardBeforePower + CHATGPT_BOSS_REWARD_STRENGTH, `Boss defeat did not grant +15 strength (before=${rewardBeforePower}, snapshot=${attackerState?.hitPower}, internal=${internalRewardPower}, stats=${JSON.stringify(statsReward)})`);
  assert(!rewardGame.getSnapshot().balls.some((b) => b.userId === CHATGPT_BOSS_USER_ID), 'defeated Boss remained in arena');
  rewardGame.destroy();

  fs.rmSync(file, { force:true });
  console.log('[WEAPON SELFTEST] PASS username normalization + Vida Tripla one-shot + live auto-equip purchase + all weapons auto-target/area/mine + Boss spawn/reward/global lightning + direct force damage');
}
main().catch(e => { console.error(e); process.exit(1); });
