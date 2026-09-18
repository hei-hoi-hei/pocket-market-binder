import type { Card, CardCategory, Rarity } from '@/types';
import type { PriceObservation, PricingProviderName } from './pricingProvider';

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

  const card: Card = {
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

  card.identity = {
    tcgdexId: card.id,
    setId: card.setCode,
    setName: card.setName,
    cardNumber: card.setNumber,
    name: card.name,
    rarity: card.rarity,
    imageUrl: card.imageUrlHigh || card.imageUrlLow,
    providerIds: {}, // To be populated by secondary sources
  };

  return card;
}

export function extractTCGdexObservations(cardId: string, data: any): PriceObservation[] {
  if (!data || !data.prices) return [];
  const obs: PriceObservation[] = [];
  const fetchedAt = Date.now();

  const pricesObj = data.prices;

  // 1. TCGplayer
  if (pricesObj.tcgplayer && typeof pricesObj.tcgplayer === 'object') {
    const tcg = pricesObj.tcgplayer;
    const observedAt = parseTCGdexDate(tcg.updatedAt) ?? fetchedAt;
    const currency = 'USD';

    if (typeof tcg.market === 'number' && tcg.market > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'tcgplayer',
        price: tcg.market,
        currency,
        priceType: 'market',
        observedAt,
        fetchedAt,
        metadata: { field: 'market' },
      });
    }
    if (typeof tcg.low === 'number' && tcg.low > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'tcgplayer',
        price: tcg.low,
        currency,
        priceType: 'low',
        observedAt,
        fetchedAt,
        metadata: { field: 'low' },
      });
    }
    if (typeof tcg.mid === 'number' && tcg.mid > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'tcgplayer',
        price: tcg.mid,
        currency,
        priceType: 'average',
        observedAt,
        fetchedAt,
        metadata: { field: 'mid' },
      });
    }
    if (typeof tcg.high === 'number' && tcg.high > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'tcgplayer',
        price: tcg.high,
        currency,
        priceType: 'high',
        observedAt,
        fetchedAt,
        metadata: { field: 'high' },
      });
    }
  }

  // 2. Cardmarket
  if (pricesObj.cardmarket && typeof pricesObj.cardmarket === 'object') {
    const cm = pricesObj.cardmarket;
    const observedAt = parseTCGdexDate(cm.updatedAt) ?? fetchedAt;
    const currency = 'EUR';

    if (typeof cm.trend === 'number' && cm.trend > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'cardmarket',
        price: cm.trend,
        currency,
        priceType: 'trend',
        observedAt,
        fetchedAt,
        metadata: { field: 'trend' },
      });
    }
    if (typeof cm.avg === 'number' && cm.avg > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'cardmarket',
        price: cm.avg,
        currency,
        priceType: 'average',
        observedAt,
        fetchedAt,
        metadata: { field: 'avg' },
      });
    }
    if (typeof cm.low === 'number' && cm.low > 0) {
      obs.push({
        cardId,
        source: 'tcgdex',
        market: 'cardmarket',
        price: cm.low,
        currency,
        priceType: 'low',
        observedAt,
        fetchedAt,
        metadata: { field: 'low' },
      });
    }
    if (typeof cm.reverseHoloAvg === 'number' && cm.reverseHoloAvg > 0) {
      obs.push({
        cardId,
        variant: 'reverse',
        source: 'tcgdex',
        market: 'cardmarket',
        price: cm.reverseHoloAvg,
        currency,
        priceType: 'average',
        observedAt,
        fetchedAt,
        metadata: { field: 'reverseHoloAvg' },
      });
    }
  }

  // 3. Generic handler for other markets
  Object.entries(pricesObj).forEach(([marketKey, marketVal]: [string, any]) => {
    if (marketKey === 'tcgplayer' || marketKey === 'cardmarket') return;
    if (marketVal && typeof marketVal === 'object') {
      const observedAt = parseTCGdexDate(marketVal.updatedAt) ?? fetchedAt;
      const currency = marketVal.unit === '€' ? 'EUR' : 'USD';
      if (typeof marketVal.market === 'number' && marketVal.market > 0) {
        obs.push({
          cardId,
          source: 'tcgdex',
          market: marketKey,
          price: marketVal.market,
          currency,
          priceType: 'market',
          observedAt,
          fetchedAt,
        });
      }
    }
  });

  return obs;
}

function parseTCGdexDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

export class TCGdexProvider implements CatalogProvider {
  name: PricingProviderName = 'tcgdex';
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

  async fetchPrices(card: Card): Promise<PriceObservation[]> {
    try {
      const res = await fetch(`${this.baseUrl}/cards/${encodeURIComponent(card.id)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return extractTCGdexObservations(card.id, data);
    } catch {
      return [];
    }
  }
}



export const tcgdexProvider = new TCGdexProvider();
