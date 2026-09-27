import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { EconomyStore, STORE_CATALOG } from './economy/EconomyStore';
import { GameLoop } from './game/GameLoop';
import { PhysicsWorld } from './game/PhysicsWorld';
import { shopApiRouter } from './routes/shopApi';
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
  await store.recordKill('Iamara C.O.M', 'shared-tiktok-id', 'alias-kill');
  await store.adminAdjust('iamara c.o.m', 200, 'stable identity test seed', 'stable-id-seed');
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
  clearInterval((game as any).physicsTimer); (game as any).physicsTimer = null;
  a.x=300; a.y=300; t.x=350; t.y=300;
  const weaponSlugs = ['pistola','metralhadora','12-escopeta','sniper','bazuca','mina-terrestre'];
  const purchased = [] as Array<{slug:string;item:NonNullable<Awaited<ReturnType<typeof store.purchase>>['item']>}>;
  const app = express(); app.use(express.json()); app.use(shopApiRouter(store));
  const apiServer = app.listen(0);
  await new Promise<void>((resolve) => apiServer.once('listening', resolve));
  const address = apiServer.address();
  assert(address && typeof address === 'object', 'shop API did not bind a local test port');
  const buyThroughApi = async (slug:string, operationKey:string, username='test.user') => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/shop/purchase`, {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({username,slug,operationKey}),
    });
    return await response.json() as {ok:boolean;item?:NonNullable<Awaited<ReturnType<typeof store.purchase>>['item']>};
  };
  for (const slug of [...weaponSlugs, 'dash-charge']) {
    const result = await buyThroughApi(slug, `buy-${slug}`);
    assert(result.ok && result.item, `purchase failed ${slug}`);
    purchased.push({slug,item:result.item});
  }
  const lifeBuy = await buyThroughApi('vida-tripla', 'buy-life-for-next-entry');
  assert(lifeBuy.ok && lifeBuy.item?.status === 'pending_entry', 'shop API did not retain Vida Tripla for the next entry');
  const transferBuy = await buyThroughApi('pistola', 'buy-transfer-pistol');
  assert(transferBuy.ok && transferBuy.item, 'shop API failed to create a transferable item');
  await store.markDropped(transferBuy.item.id, 350, 300);
  (game as any).shopDrops.set(transferBuy.item.id, { id:transferBuy.item.id, slug:'pistola', name:'Pistola', icon:'🔫', x:350, y:300 });
  assert((game as any).equipped.get('attacker') === undefined, 'purchase activated equipment without /compra');
  game.handleLiveEvent({ type:'comment', user:attacker, comment:'!usar pistola', timestamp:Date.now() });
  assert((game as any).equipped.get('attacker') === undefined, 'legacy !usar bypassed the required /compra command');
  a.x=100; a.y=300; t.x=350; t.y=300;
  await (game as any).processShopDrops();
  a.x=300; a.y=300;
  const targetEquipment = game.getSnapshot().balls.find((b) => b.userId === 'target')?.equippedItems || [];
  assert(targetEquipment.length === 1 && targetEquipment[0].slug === 'pistola', 'collected weapon was not activated immediately without a comment');
  const transferState = (game as any).weaponStates.get(transferBuy.item.id) as {ammo:number;lastUseAt:number;reloadAt:number};
  assert(transferState.ammo === catalog.find(i => i.slug === 'pistola')!.ammo && transferState.lastUseAt === 0 && transferState.reloadAt === 0, 'collected weapon was not made ready immediately');
  const attackerHpBeforePickupShot = a.hp;
  (game as any).processAutoWeapons();
  assert(a.hp < attackerHpBeforePickupShot, 'collected weapon did not fire at an enemy immediately');
  const bot = physics.spawnOrNudge(user('bot_auto_test', 'bot_auto_test'));
  bot.x=500; bot.y=300;
  const botDropBuy = await buyThroughApi('pistola', 'buy-pistol-bot-safety');
  assert(botDropBuy.ok && botDropBuy.item, 'shop API failed bot-collection fixture');
  await store.markDropped(botDropBuy.item.id, bot.x, bot.y);
  (game as any).shopDrops.set(botDropBuy.item.id, { id:botDropBuy.item.id, slug:'pistola', name:'Pistola', icon:'🔫', x:bot.x, y:bot.y });
  await (game as any).processShopDrops();
  assert((game as any).shopDrops.has(botDropBuy.item.id), 'bot collected a paid weapon drop');
  assert((game as any).equipped.get(bot.userId) === undefined, 'bot received a paid weapon');
  game.handleLiveEvent({ type:'comment', user:attacker, comment:'/compra', timestamp:Date.now() });
  await wait(50);
  const activated = game.getSnapshot().balls.find((b) => b.userId === 'attacker')?.equippedItems || [];
  assert(activated.length === weaponSlugs.length, `/compra did not activate every purchased weapon (${activated.length}/${weaponSlugs.length})`);
  assert(physics.getBall('attacker')!.dashUntil > Date.now(), '/compra did not activate the purchased dash consumable');
  assert((await store.inventory('test.user')).some((item) => item.id === lifeBuy.item!.id && item.status === 'pending_entry'), '/compra consumed Vida Tripla before the next entry');
  game.handleLiveEvent({ type:'comment', user:attacker, comment:'/compra', timestamp:Date.now() });
  await wait(20);
  assert(game.getSnapshot().balls.find((b) => b.userId === 'attacker')?.equippedItems?.length === weaponSlugs.length, 'repeating /compra duplicated already active weapons');

  const aliasPurchase = await buyThroughApi('pistola', 'buy-display-name-alias', 'iamara c.o.m');
  assert(aliasPurchase.ok && aliasPurchase.item, 'shop API purchase under display-name account failed');
  const currentIamaraUser = user('shared-tiktok-id', 'iamaracardoso991475');
  game.handleLiveEvent({ type:'comment', user:currentIamaraUser, comment:'/compra', timestamp:Date.now() });
  await wait(40);
  const aliasEquipment = game.getSnapshot().balls.find((b) => b.userId === 'shared-tiktok-id')?.equippedItems || [];
  const aliasActiveItems = (game as any).equipped.get('shared-tiktok-id') || [];
  assert(aliasEquipment.length === 1 && aliasEquipment[0].slug === 'pistola' && aliasActiveItems.some((item: {id:string}) => item.id === aliasPurchase.item!.id), '/compra did not find the purchase saved under another username with the same TikTok ID');
  const states = (game as any).weaponStates as Map<string, {lastUseAt:number; ammo:number; reloadAt:number}>;
  for (const {slug,item} of purchased.filter((row) => weaponSlugs.includes(row.slug))) {
    const catalogItem = catalog.find(i => i.slug === slug)!;
    for (const other of purchased.filter((row) => weaponSlugs.includes(row.slug))) {
      const st = states.get(other.item.id)!;
      st.lastUseAt = Date.now() + catalogItem.cooldownMs + 1;
      st.reloadAt = 0;
      st.ammo = catalog.find(i => i.slug === other.slug)!.ammo;
    }
    const state = states.get(item.id)!;
    state.lastUseAt = 0; state.reloadAt = 0; state.ammo = catalogItem.ammo;
    t.hp = t.maxHp;
    const before = t.hp;
    state.lastUseAt = 0;
    if (slug === 'mina-terrestre') {
      (game as any).processAutoWeapons();
      (game as any).processLandMines();
      t.x = a.x; t.y = a.y;
      (game as any).processLandMines();
      t.x = a.x + 50; t.y = a.y;
    } else {
      (game as any).processAutoWeapons();
    }
    assert(t.hp < before, `${slug} activated weapon did not damage target`);
  }
  game.destroy();
  await new Promise<void>((resolve, reject) => apiServer.close((error) => error ? reject(error) : resolve()));

  const pw = new PhysicsWorld();
  pw.spawnOrNudge(user(CHATGPT_BOSS_USER_ID, 'boss')); pw.spawnOrNudge(user('foe', 'foe')); pw.spawnOrNudge(user('foe-2', 'foe_2'));
  const boss = pw.getBall(CHATGPT_BOSS_USER_ID)!; const foe = pw.getBall('foe')!; const foe2 = pw.getBall('foe-2')!;
  boss.x=100;boss.y=100;foe.x=140;foe.y=100;foe2.x=180;foe2.y=100;
  boss.spawnProtectedUntil = 0; foe.spawnProtectedUntil = 0; foe2.spawnProtectedUntil = 0;
  foe.vx=120;foe.vy=40;foe2.vx=-80;foe2.vy=60;
  const foeVelocity = [foe.vx, foe.vy]; const foe2Velocity = [foe2.vx, foe2.vy];
  const hp = foe.hp; const hp2 = foe2.hp; const zaps = pw.applyBossLightning(CHATGPT_BOSS_USER_ID);
  assert(zaps.length === 2 && foe.hp === hp - 10 && foe2.hp === hp2 - 10, 'boss global lightning did not deal 10 damage to every player');
  assert(foe.slowUntil === 0 && foe2.slowUntil === 0, 'boss lightning applied a slow effect');
  assert(foe.vx === foeVelocity[0] && foe.vy === foeVelocity[1] && foe2.vx === foe2Velocity[0] && foe2.vy === foe2Velocity[1], 'boss lightning changed player velocity');

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
  console.log('[WEAPON SELFTEST] PASS username normalization + Vida Tripla one-shot + no auto-use on purchase + /compra multi-item activation + all weapons auto-target/area/mine + Boss spawn/reward/damage-only lightning + direct force damage');
}
main().catch(e => { console.error(e); process.exit(1); });
