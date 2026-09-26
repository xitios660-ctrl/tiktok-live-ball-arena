import { Router } from 'express';
import type { EconomyStore } from '../economy/EconomyStore';
import { normalizeTikTokHandle } from '../economy/EconomyStore';

const windows = new Map<string, { at: number; count: number }>();
function rateLimit(req: { ip?: string; method?: string }, res: any, next: () => void): void {
  if (req.method === 'GET') return next();
  const key = String(req.ip || 'unknown'); const now = Date.now(); const old = windows.get(key);
  if (!old || now - old.at > 60_000) windows.set(key, { at: now, count: 1 });
  else { old.count += 1; if (old.count > 20) { res.status(429).json({ ok: false, error: 'Muitas compras em sequência. Aguarde um minuto.' }); return; } }
  next();
}
function publicHandle(raw: unknown): string { return normalizeTikTokHandle(String(raw || '')); }
export function shopApiRouter(store: EconomyStore): Router {
  const r = Router();
  r.get('/api/shop/catalog', async (_req, res) => res.json({ ok: true, catalog: await store.getCatalog(), bindingMinutes: 3 }));
  r.get('/api/shop/player', async (req, res) => { const username = publicHandle(req.query.username); if (!username) return res.status(400).json({ ok:false,error:'Informe seu @ do TikTok.' }); const player = await store.getPlayer(username); return res.json({ ok:true, player, inventory: await store.inventory(username), ledger: await store.ledger(username, 30), limitation:'O @ não autentica titularidade; não compartilhe links de operação e use apenas seu próprio @.' }); });
  r.post('/api/shop/purchase', rateLimit, async (req, res) => { const username = publicHandle(req.body?.username); const slug = String(req.body?.slug || '').trim(); const operationKey = String(req.body?.operationKey || '').trim(); if (!username || !slug || !operationKey) return res.status(400).json({ok:false,error:'@, item e operationKey são obrigatórios.'}); const result = await store.purchase(username, slug, operationKey); return res.status(result.ok ? 200 : 400).json({ ...result, player: result.player || await store.getPlayer(username), inventory: result.ok ? await store.inventory(username) : undefined }); });
  return r;
}
