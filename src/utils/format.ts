import type { Card, Rarity } from '@/types';

export function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function rarityLabel(r: Rarity): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export interface TypeStyle {
  bg: string;
  text: string;
  ring: string;
  glow: string;
  label: string;
}

/** Tailwind text/bg classes per card type, used across card artwork & badges. */
export const ENERGY_STYLES: Record<string, TypeStyle> = {
  fire: { bg: 'bg-fire-500', text: 'text-white', ring: 'ring-fire-400', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.45)]', label: 'Fire' },
  water: { bg: 'bg-water-500', text: 'text-white', ring: 'ring-water-400', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.45)]', label: 'Water' },
  grass: { bg: 'bg-grass-500', text: 'text-white', ring: 'ring-grass-400', glow: 'shadow-[0_0_12px_rgba(34,197,94,0.45)]', label: 'Grass' },
  electric: { bg: 'bg-electric-400', text: 'text-leather-800', ring: 'ring-electric-500', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]', label: 'Electric' },
  psychic: { bg: 'bg-psychic-500', text: 'text-white', ring: 'ring-psychic-400', glow: 'shadow-[0_0_12px_rgba(236,72,153,0.45)]', label: 'Psychic' },
  dark: { bg: 'bg-dark-500', text: 'text-white', ring: 'ring-dark-400', glow: 'shadow-[0_0_12px_rgba(75,85,99,0.5)]', label: 'Dark' },
  steel: { bg: 'bg-steel-500', text: 'text-white', ring: 'ring-steel-400', glow: 'shadow-[0_0_12px_rgba(107,114,128,0.45)]', label: 'Steel' },
  dragon: { bg: 'bg-dragon-500', text: 'text-white', ring: 'ring-dragon-400', glow: 'shadow-[0_0_16px_rgba(139,92,246,0.5)]', label: 'Dragon' },
  colorless: { bg: 'bg-parchment-300', text: 'text-leather-800', ring: 'ring-parchment-400', glow: 'shadow-[0_0_8px_rgba(150,150,150,0.3)]', label: 'Colorless' },
  trainer: { bg: 'bg-leather-600', text: 'text-white', ring: 'ring-leather-400', glow: 'shadow-[0_0_8px_rgba(100,100,100,0.3)]', label: 'Trainer' },
  energy: { bg: 'bg-gold-500', text: 'text-leather-800', ring: 'ring-gold-400', glow: 'shadow-[0_0_8px_rgba(234,179,8,0.4)]', label: 'Energy' },
};

export function getCardTypeStyle(card: Pick<Card, 'category' | 'types'>): TypeStyle {
  if (card.category === 'trainer') return ENERGY_STYLES.trainer;
  if (card.category === 'energy') return ENERGY_STYLES.energy;

  const firstType = (card.types?.[0] ?? 'colorless').toLowerCase();
  const normalizedKey =
    firstType === 'lightning' ? 'electric' :
    firstType === 'fighting' || firstType === 'darkness' ? 'dark' :
    firstType === 'metal' ? 'steel' :
    firstType;

  return ENERGY_STYLES[normalizedKey] ?? ENERGY_STYLES.colorless;
}

export const RARITY_STYLES: Record<Rarity, { badge: string; label: string }> = {
  common: { badge: 'bg-parchment-200 text-leather-700', label: 'Common' },
  uncommon: { badge: 'bg-grass-400 text-leather-800', label: 'Uncommon' },
  rare: { badge: 'bg-water-400 text-white', label: 'Rare' },
  holo: { badge: 'bg-gradient-to-r from-gold-400 to-psychic-400 text-leather-800', label: 'Holo' },
  ultra: { badge: 'bg-gradient-to-r from-dragon-500 to-gold-500 text-white', label: 'Ultra' },
  secret: { badge: 'bg-gradient-to-r from-psychic-500 via-gold-400 to-fire-500 text-white', label: 'Secret' },
  other: { badge: 'bg-parchment-300 text-leather-700', label: 'Other' },
};

/** Generate a deterministic HSL gradient pair from a numeric seed or string ID. */
export function seedGradient(seedOrId: number | string): [string, string] {
  let numSeed = 1;
  if (typeof seedOrId === 'number') {
    numSeed = seedOrId;
  } else {
    for (let i = 0; i < seedOrId.length; i++) {
      numSeed = (numSeed * 31 + seedOrId.charCodeAt(i)) % 100000;
    }
  }
  const h1 = (numSeed * 47) % 360;
  const h2 = (h1 + 60) % 360;
  return [
    `hsl(${h1}, 65%, 62%)`,
    `hsl(${h2}, 70%, 48%)`,
  ];
}

