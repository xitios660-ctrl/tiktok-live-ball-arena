import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EconomyStore, STORE_CATALOG } from './economy/EconomyStore';
import { GameLoop } from './game/GameLoop';
import { PhysicsWorld } from './game/PhysicsWorld';
import { CHATGPT_BOSS_USER_ID } from './game/ChatGPTBoss';
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
  a.x=300; a.y=300; t.x=350; t.y=300;
  const weaponSlugs = ['pistola','metralhadora','12-escopeta','sniper','bazuca','mina-terrestre'];
  for (const slug of weaponSlugs) {
    const item = await store.purchase('test.user', slug, `buy-${slug}`);
    assert(item.ok && item.item, `purchase failed ${slug}`);
    game.handleLiveEvent({ type:'comment', user:attacker, comment:`!usar ${slug}`, timestamp:Date.now() });
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
  pw.spawnOrNudge(user(CHATGPT_BOSS_USER_ID, 'boss')); pw.spawnOrNudge(user('foe', 'foe'));
  const boss = pw.getBall(CHATGPT_BOSS_USER_ID)!; const foe = pw.getBall('foe')!; boss.x=100;boss.y=100;foe.x=140;foe.y=100;
  const hp = foe.hp; const zap = pw.applyLightningZap(CHATGPT_BOSS_USER_ID);
  assert(zap.targetId === 'foe' && zap.application && foe.hp < hp, 'boss lightning damage missing');
  assert(foe.slowUntil > Date.now(), 'boss lightning slow missing');
  fs.rmSync(file, { force:true });
  console.log('[WEAPON SELFTEST] PASS username normalization + Vida Tripla one-shot + all weapons auto-target/area/mine + Boss lightning damage/slow');
}
main().catch(e => { console.error(e); process.exit(1); });
