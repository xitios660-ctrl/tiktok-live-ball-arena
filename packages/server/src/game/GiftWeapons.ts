import type { ArenaGiftEvent } from '@arena/shared';
import { getGiftWeaponBonusById } from '../tiktok/mapTikTokGift';

export interface GiftWeaponProfile {
  id: string;
  name: string;
  icon: string;
  damage: number;
  range: number;
  area: number;
}

/** One bonus shot per gift unit, capped to keep repeat gifts fair and predictable. */
export const MAX_GIFT_WEAPON_SHOTS = 3;
export const GIFT_WEAPON_IDS = [
  'rosa', 'mini_dino', 'raio', 'foguete', 'ima',
  'gelo', 'rosquinha', 'espelho', 'capivara', 'galaxia',
] as const;

const GIFT_WEAPON_ALIASES: Record<string, string> = {
  rose: 'rosa',
  mini_dinosaur: 'mini_dino',
  lightning: 'raio',
  thunder: 'raio',
  rocket: 'foguete',
  magnet: 'ima',
  freeze: 'gelo',
  donut: 'rosquinha',
  mirror: 'espelho',
  capybara: 'capivara',
  galaxy: 'galaxia',
};

export function resolveGiftWeapon(giftId: ArenaGiftEvent['giftId']): GiftWeaponProfile | null {
  const raw = String(giftId).trim().toLowerCase();
  const id = GIFT_WEAPON_ALIASES[raw] || raw;
  const bonus = getGiftWeaponBonusById(id);
  return bonus ? { id, ...bonus } : null;
}

export function giftWeaponShotCount(event: Pick<ArenaGiftEvent, 'repeatCount'>): number {
  return Math.max(1, Math.min(MAX_GIFT_WEAPON_SHOTS, Math.floor(event.repeatCount || 1)));
}
