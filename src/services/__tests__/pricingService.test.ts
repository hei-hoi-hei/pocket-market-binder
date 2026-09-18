import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingService } from '../pricingService';
import type { Card } from '@/types';
import type { PriceObservation, PriceReference } from '../providers/pricingProvider';

// Mock storage
const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../storage', () => ({
  storage: {
    get: (key: string) => mockGet(key),
    set: (key: string, val: any) => mockSet(key, val),
  },
}));

// Mock Navigator
const originalOnline = globalThis.navigator?.onLine ?? true;
function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: online,
    configurable: true,
  });
}

describe('PricingService', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    vi.resetAllMocks();
    setOnline(true);
    pricingService = new PricingService();
  });

  const baseCard: Card = {
    id: 'sv3pt5-1',
    name: 'Bulbasaur',
    category: 'pokemon',
    rarity: 'common',
    setCode: 'sv3pt5',
    setName: '151',
    setNumber: '1',
    imageUrlLow: 'https://images.tcgdex.net/en/sv/sv3pt5/1/low.webp',
    imageUrlHigh: 'https://images.tcgdex.net/en/sv/sv3pt5/1/high.webp',
  };

  const now = Date.now();

  it('handles multiple comparable observations', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 9.50,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'scrydex',
        market: 'cardmarket',
        price: 10.50,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref).not.toBeNull();
    expect(ref?.referencePrice).toBe(10.00); // Median of 9.5, 10.0, 10.5 is 10.0
    expect(ref?.analysis?.status).toBe('normal');
  });

  it('handles single source observation', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref).not.toBeNull();
    expect(ref?.referencePrice).toBe(10.00);
    expect(ref?.sourceCount).toBe(1);
    expect(ref?.analysis?.status).toBe('normal');
  });
  it('detects normal spread divergence', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 9.80,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'scrydex',
        market: 'cardmarket',
        price: 10.20,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.analysis?.status).toBe('normal');
    expect(ref?.analysis?.requiresVerification).toBe(false);
  });

  it('detects review-level divergence', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'scrydex',
        market: 'cardmarket',
        price: 14.00, // Median is 10.00, deviation is 4 / 10 = 40% (within 30-60%)
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.analysis?.status).toBe('review');
    expect(ref?.analysis?.requiresVerification).toBe(true);
    expect(ref?.analysis?.reason).toContain('spread');
  });

  it('detects high-level divergence', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'scrydex',
        market: 'cardmarket',
        price: 17.00, // Median is 10.00, deviation is 7 / 10 = 70% (above 60%)
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.analysis?.status).toBe('high_divergence');
    expect(ref?.analysis?.requiresVerification).toBe(true);
    expect(ref?.analysis?.reason).toContain('outlier');
  });

  it('resists outliers using median calculation when N >= 4', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 10.50,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'scrydex',
        market: 'cardtrader',
        price: 9.50,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'tickermint',
        market: 'tcgplayer',
        price: 50.00, // Outlier
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.referencePrice).toBe(10.25); // Median of [9.5, 10.0, 10.5, 50.0] is 10.25
    expect(ref?.sourceCount).toBe(4);
    expect(ref?.analysis?.status).toBe('high_divergence');
  });

  it('converts currencies correctly using static rates', () => {
    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 10.00,
        currency: 'EUR', // 10 EUR = 10 * 1.08 = 10.8 USD
        priceType: 'market',
        observedAt: now,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.referencePrice).toBe(10.40); // (10.00 + 10.80) / 2 = 10.40
  });

  it('filters out stale observations if freshness criteria met', () => {
    const freshObsTime = now - 1 * 60 * 60 * 1000; // 1 hour ago
    const staleObsTime = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago (max age is 7 days)

    const observations: PriceObservation[] = [
      {
        cardId: 'sv3pt5-1',
        source: 'justtcg',
        market: 'tcgplayer',
        price: 10.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: freshObsTime,
        fetchedAt: now,
      },
      {
        cardId: 'sv3pt5-1',
        source: 'pkmnprices',
        market: 'cardmarket',
        price: 15.00,
        currency: 'USD',
        priceType: 'market',
        observedAt: staleObsTime,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.referencePrice).toBe(10.00); // Stale should be filtered out
    expect(ref?.sourceCount).toBe(1);
  });

});
