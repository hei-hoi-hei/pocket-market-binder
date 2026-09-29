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

type TCGdexPriceType = PriceObservation['priceType'];
type TCGdexVariant = NonNullable<PriceObservation['variant']>;

interface TCGdexMarketData {
  updatedAt: number;
  currency: 'USD' | 'EUR';
}

const CARDMARKET_FIELDS: Array<{
  field: string;
  priceType: TCGdexPriceType;
  variant?: TCGdexVariant;
}> = [
  { field: 'avg', priceType: 'average' },
  { field: 'low', priceType: 'low' },
  { field: 'trend', priceType: 'trend' },
  { field: 'avg-holo', priceType: 'average', variant: 'holo' },
  { field: 'low-holo', priceType: 'low', variant: 'holo' },
  { field: 'trend-holo', priceType: 'trend', variant: 'holo' },
];

const TCGPLAYER_VARIANTS: Record<string, TCGdexVariant> = {
  normal: 'normal',
  reverse: 'reverse',
  holo: 'holo',
  holofoil: 'holo',
};

const TCGPLAYER_FIELDS: Array<{
  field: string;
  priceType: TCGdexPriceType;
}> = [
  { field: 'lowPrice', priceType: 'low' },
  { field: 'midPrice', priceType: 'average' },
  { field: 'highPrice', priceType: 'high' },
  { field: 'marketPrice', priceType: 'market' },
  { field: 'directLowPrice', priceType: 'low' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTCGdexDate(dateStr: unknown): number | null {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const parsed = Date.parse(dateStr);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMarketData(value: unknown): TCGdexMarketData | undefined {
  if (!isRecord(value)) return undefined;

  const updatedAt = parseTCGdexDate(value.updated);
  const currency = value.unit;
  if (updatedAt === null || (currency !== 'USD' && currency !== 'EUR')) return undefined;

  return { updatedAt, currency };
}

export function extractTCGdexObservations(cardId: string, data: unknown): PriceObservation[] {
  if (typeof cardId !== 'string' || !cardId.trim() ||
    !isRecord(data) || data.id !== cardId || !isRecord(data.pricing)) return [];

  const observations: PriceObservation[] = [];
  const fetchedAt = Date.now();

  const append = (
    market: 'cardmarket' | 'tcgplayer',
    marketData: TCGdexMarketData,
    values: Record<string, unknown>,
    field: string,
    priceType: TCGdexPriceType,
    variant?: TCGdexVariant,
  ) => {
    const price = values[field];
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return;

    observations.push({
      cardId,
      ...(variant ? { variant } : {}),
      source: 'tcgdex',
      market,
      price,
      currency: marketData.currency,
      priceType,
      observedAt: marketData.updatedAt,
      fetchedAt,
      metadata: {
        field,
        ...(validListingId(values.productId ?? values.idProduct)
          ? { providerListingId: values.productId ?? values.idProduct }
          : {}),
      },
    });
  };

  const cardmarket = data.pricing.cardmarket;
  const cardmarketData = readMarketData(cardmarket);
  if (cardmarketData && isRecord(cardmarket)) {
    for (const { field, priceType, variant } of CARDMARKET_FIELDS) {
      append('cardmarket', cardmarketData, cardmarket, field, priceType, variant);
    }
  }

  const tcgplayer = data.pricing.tcgplayer;
  const tcgplayerData = readMarketData(tcgplayer);
  if (tcgplayerData && isRecord(tcgplayer)) {
    for (const [variantKey, variantPrices] of Object.entries(tcgplayer)) {
      const variant = TCGPLAYER_VARIANTS[variantKey];
      if (!variant || !isRecord(variantPrices)) continue;

      for (const { field, priceType } of TCGPLAYER_FIELDS) {
        append('tcgplayer', tcgplayerData, variantPrices, field, priceType, variant);
      }
    }
  }

  return observations;
}

function validListingId(value: unknown): boolean {
  return (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
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
