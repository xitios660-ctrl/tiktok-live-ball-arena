import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EconomyStore } from './economy/EconomyStore';

async function main() {
  const file = path.join(os.tmpdir(), `arena-economy-${Date.now()}.json`);
  const store = new EconomyStore(file);
  await store.init();
  await store.recordKill('@Player.One', 'tiktok-1', 'round-kill-1');
  await store.recordKill('player.one', 'tiktok-1', 'round-kill-1');
  await store.recordKill('player.one', 'tiktok-1', 'round-kill-2');
  let p = await store.getPlayer('PLAYER.ONE');
  if (p.kills !== 2 || p.available !== 2) throw new Error(`kill dedupe failed: ${JSON.stringify(p)}`);
  const poor = await store.purchase('player.one', 'marksman-rifle', 'op-poor');
  if (poor.ok) throw new Error('insufficient purchase unexpectedly succeeded');
  const topup = await store.adminAdjust('player.one', 200, 'seed test', 'admin-seed-1');
  if (!topup.ok) throw new Error('admin adjustment failed');
  const first = await store.purchase('player.one', 'marksman-rifle', 'op-buy-1');
  const second = await store.purchase('PLAYER.ONE', 'marksman-rifle', 'op-buy-1');
  if (!first.ok || !second.ok || first.item?.id !== second.item?.id) throw new Error('purchase idempotency failed');
  p = await store.getPlayer('player.one');
  if (p.available !== 82) throw new Error(`balance failed: ${JSON.stringify(p)}`);
  const ledger = await store.ledger('player.one', 20);
  if (ledger.length !== 4 || !ledger.some(x => x.kind === 'purchase')) throw new Error('ledger failed');
  fs.rmSync(file, { force: true });
  console.log('[ECONOMY SELFTEST] PASS normalize + kill dedupe + server balance + idempotent purchase + ledger');
}
main().catch((e) => { console.error('[ECONOMY SELFTEST] FAIL', e); process.exit(1); });
