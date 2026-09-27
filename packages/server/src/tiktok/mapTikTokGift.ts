import fs from 'fs';
import path from 'path';

type GiftRow = {
  id: string;
  tiktokGiftNames?: string[];
  name: string;
  coinValue: number;
  weaponBonus?: { name: string; icon: string; damage: number; range: number; area: number };
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
    { id: 'rosa', tiktokGiftNames: ['Rose', 'Rosa'], name: 'Rosa', coinValue: 1, weaponBonus: { name: 'Espinho', icon: '🌹', damage: 1, range: 280, area: 0 } },
    { id: 'mini_dino', tiktokGiftNames: ['Mini Dino', 'Dinosaur'], name: 'Mini Dino', coinValue: 10, weaponBonus: { name: 'Mordida Dino', icon: '🦖', damage: 5, range: 380, area: 0 } },
    { id: 'raio', tiktokGiftNames: ['GG', 'Lightning', 'Raio', 'Thunder'], name: 'Raio', coinValue: 15, weaponBonus: { name: 'Raio de Choque', icon: '⚡', damage: 7, range: 520, area: 0 } },
    { id: 'foguete', tiktokGiftNames: ['Rocket', 'Foguete', 'Perfume'], name: 'Foguete', coinValue: 15, weaponBonus: { name: 'Mini Foguete', icon: '🚀', damage: 8, range: 500, area: 0 } },
    { id: 'ima', tiktokGiftNames: ['Finger Heart', 'Magnet', 'Ímã', 'Ima'], name: 'Ímã', coinValue: 20, weaponBonus: { name: 'Pulso Magnético', icon: '🧲', damage: 9, range: 440, area: 70 } },
    { id: 'gelo', tiktokGiftNames: ['Ice Cream Cone', 'Freeze', 'Gelo', 'Snow'], name: 'Gelo', coinValue: 25, weaponBonus: { name: 'Estilhaço de Gelo', icon: '❄️', damage: 10, range: 500, area: 60 } },
    { id: 'rosquinha', tiktokGiftNames: ['Doughnut', 'Donut', 'Rosquinha'], name: 'Rosquinha', coinValue: 30, weaponBonus: { name: 'Donut Explosivo', icon: '🍩', damage: 12, range: 540, area: 65 } },
    { id: 'espelho', tiktokGiftNames: ['Mirror', 'Espelho', 'Hand Hearts'], name: 'Espelho', coinValue: 35, weaponBonus: { name: 'Lâmina Refletida', icon: '🪞', damage: 14, range: 640, area: 0 } },
    { id: 'capivara', tiktokGiftNames: ['Capybara', 'Capivara'], name: 'Capivara', coinValue: 100, weaponBonus: { name: 'Canhão Capivara', icon: '🦫', damage: 20, range: 720, area: 0 } },
    { id: 'galaxia', tiktokGiftNames: ['Galaxy', 'Galaxy Gift', 'Galáxia', 'Galaxia'], name: 'Galaxia', coinValue: 1000, weaponBonus: { name: 'Canhão Galáctico', icon: '🌌', damage: 35, range: 900, area: 100 } },
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

/** Return the configured weapon bonus for a canonical arena gift id. */
export function getGiftWeaponBonusById(id: string): GiftRow['weaponBonus'] | null {
  return loadGifts().find((gift) => gift.id === id)?.weaponBonus ?? null;
}
