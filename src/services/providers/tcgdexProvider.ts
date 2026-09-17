import type { Card, CardCategory, Rarity } from '@/types';

export interface CatalogProvider {
  searchCards(query: string): Promise<Card[]>;
  getCardById(id: string): Promise<Card | null>;
}

function normalizeRarity(rawRarity?: string): Rarity {
  if (!rawRarity) return 'other';
  const r = rawRarity.toLowerCase();
  if (r.includes('common') && !r.includes('uncommon')) return 'common';
  if (r.includes('uncommon')) return 'uncommon';
  if (r.includes('holo') || r.includes('foil')) return 'holo';
  if (r.includes('ultra') || r.includes('secret') || r.includes('v') || r.includes('ex') || r.includes('star')) return 'ultra';
  if (r.includes('rare')) return 'rare';
  return 'other';
}

function normalizeCategory(category?: string): CardCategory {
  if (!category) return 'pokemon';
  const c = category.toLowerCase();
  if (c.includes('trainer') || c.includes('item') || c.includes('supporter') || c.includes('stadium')) return 'trainer';
  if (c.includes('energy')) return 'energy';
  return 'pokemon';
}

export function mapTCGdexToCard(raw: any): Card {
  const lowImg = raw.image ? `${raw.image}/low.webp` : undefined;
  const highImg = raw.image ? `${raw.image}/high.webp` : undefined;

  return {
    id: raw.id,
    name: raw.name,
    category: normalizeCategory(raw.category || raw.stage),
    types: Array.isArray(raw.types) ? raw.types : undefined,
    rarity: normalizeRarity(raw.rarity),
    setCode: raw.set?.id || (typeof raw.id === 'string' ? raw.id.split('-')[0] : ''),
    setName: raw.set?.name,
    setNumber: String(raw.localId || ''),
    imageUrlLow: lowImg,
    imageUrlHigh: highImg,
    hp: typeof raw.hp === 'number' ? raw.hp : undefined,
    genus: raw.category || raw.stage || undefined,
    evolvesFrom: raw.evolvesFrom || null,
    attacks: Array.isArray(raw.attacks)
      ? raw.attacks.map((a: any) => ({
          name: a.name,
          damage: a.damage,
          energyCost: Array.isArray(a.cost) ? a.cost : [],
          text: a.effect,
        }))
      : undefined,
    flavor: raw.description,
    variants: raw.variants
      ? {
          normal: Boolean(raw.variants.normal),
          reverse: Boolean(raw.variants.reverse),
          holo: Boolean(raw.variants.holo),
          firstEdition: Boolean(raw.variants.firstEdition),
        }
      : undefined,
  };
}

export class TCGdexProvider implements CatalogProvider {
  private baseUrl = 'https://api.tcgdex.net/v2/en';

  async searchCards(query: string): Promise<Card[]> {
    const trimmed = query.trim();
    try {
      const url = trimmed
        ? `${this.baseUrl}/cards?name=${encodeURIComponent(trimmed)}`
        : `${this.baseUrl}/cards`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];

      return list.slice(0, 30).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: 'pokemon' as CardCategory,
        rarity: 'other' as Rarity,
        setCode: item.id.split('-')[0] || '',
        setNumber: String(item.localId || ''),
        imageUrlLow: item.image ? `${item.image}/low.webp` : undefined,
        imageUrlHigh: item.image ? `${item.image}/high.webp` : undefined,
      }));
    } catch {
      return [];
    }
  }

  async getCardById(id: string): Promise<Card | null> {
    try {
      const res = await fetch(`${this.baseUrl}/cards/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return mapTCGdexToCard(data);
    } catch {
      return null;
    }
  }
}

export const tcgdexProvider = new TCGdexProvider();
