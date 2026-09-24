import fs from 'fs';
import path from 'path';

type GiftRow = {
  id: string;
  tiktokGiftNames?: string[];
  name: string;
  coinValue: number;
};

let cache: GiftRow[] | null = null;

function loadGifts(): GiftRow[] {
  if (cache) return cache;
  const candidates = [
    path.resolve(process.cwd(), 'gifts/gift-config.json'),
    path.resolve(process.cwd(), '../../gifts/gift-config.json'),
    path.resolve(__dirname, '../../../../gifts/gift-config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        cache = (raw.gifts || []) as GiftRow[];
        console.log(`[TIKTOK] Loaded gift-config from ${p} (${cache.length} gifts)`);
        return cache;
      }
    } catch {
      /* try next */
    }
  }
  cache = [
    { id: 'rosa', tiktokGiftNames: ['Rose', 'Rosa'], name: 'Rosa', coinValue: 1 },
    { id: 'mini_dino', tiktokGiftNames: ['Mini Dino', 'Dinosaur'], name: 'Mini Dino', coinValue: 10 },
    { id: 'rosquinha', tiktokGiftNames: ['Doughnut', 'Donut', 'Rosquinha'], name: 'Rosquinha', coinValue: 30 },
    { id: 'capivara', tiktokGiftNames: ['Capybara', 'Capivara'], name: 'Capivara', coinValue: 100 },
    { id: 'galaxia', tiktokGiftNames: ['Galaxy', 'Galaxy Gift', 'Galáxia', 'Galaxia'], name: 'Galaxia', coinValue: 1000 },
  ];
  console.warn('[TIKTOK] gift-config.json not found — using built-in gift map');
  return cache;
}

/** Map TikTok gift id/name → our config gift id (ability lookup). */
export function mapTikTokGiftToArenaId(
  giftId: string | number | undefined,
  giftName: string | undefined,
  coinValue?: number
): { arenaGiftId: string; giftName: string; coinValue: number } {
  const gifts = loadGifts();
  const name = (giftName || '').trim();
  const lower = name.toLowerCase();

  for (const g of gifts) {
    const aliases = [g.name, ...(g.tiktokGiftNames || [])].map((s) => s.toLowerCase());
    if (aliases.includes(lower)) {
      return { arenaGiftId: g.id, giftName: g.name, coinValue: coinValue ?? g.coinValue };
    }
  }

  if (coinValue != null) {
    const byCoin = [...gifts].sort(
      (a, b) => Math.abs(a.coinValue - coinValue) - Math.abs(b.coinValue - coinValue)
    )[0];
    if (byCoin && Math.abs(byCoin.coinValue - coinValue) <= Math.max(2, byCoin.coinValue * 0.15)) {
      return { arenaGiftId: byCoin.id, giftName: name || byCoin.name, coinValue };
    }
  }

  return {
    arenaGiftId: String(giftId ?? (name || 'unknown')),
    giftName: name || String(giftId ?? 'unknown'),
    coinValue: coinValue ?? 0,
  };
}
