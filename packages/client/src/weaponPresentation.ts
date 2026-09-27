export interface EquippedItemVisual {
  slug: string;
  icon: string;
  name: string;
  category?: 'weapon' | 'consumable';
}

export interface WeaponArt {
  texture: string;
  url: string;
  width: number;
  fallback: string;
}

/** Small, alpha-trimmed game sprites: barrel points to the right. */
export const WEAPON_ART: Record<string, WeaponArt> = {
  pistola: {
    texture: 'weapon-pistola',
    url: '/assets/weapons/pistola.png',
    width: 54,
    fallback: '🔫',
  },
  metralhadora: {
    texture: 'weapon-metralhadora',
    url: '/assets/weapons/metralhadora.png',
    width: 64,
    fallback: '🔫',
  },
  '12-escopeta': {
    texture: 'weapon-escopeta',
    url: '/assets/weapons/escopeta.png',
    width: 66,
    fallback: '💥',
  },
  sniper: {
    texture: 'weapon-sniper',
    url: '/assets/weapons/sniper.png',
    width: 74,
    fallback: '🎯',
  },
  bazuca: {
    texture: 'weapon-bazuka',
    url: '/assets/weapons/bazuka.png',
    width: 70,
    fallback: '🚀',
  },
};

export const MINE_TEXTURE = 'weapon-mina-terrestre';
export const MINE_URL = '/assets/weapons/mina-terrestre.png';

export function primaryVisibleWeapon(items: readonly EquippedItemVisual[]): EquippedItemVisual | null {
  return items.find((item) => item.category !== 'consumable' && item.slug !== 'mina-terrestre') ?? null;
}

export function getWeaponArt(slug: string): WeaponArt | null {
  return WEAPON_ART[slug] ?? null;
}
