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
    set: (key: string, val: unknown) => mockSet(key, val),
  },
}));

// Mock Navigator
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
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
        transactionType: 'price-guide',
        observedAt: staleObsTime,
        fetchedAt: now,
      },
    ];

    const ref = pricingService.aggregateObservations('sv3pt5-1', observations);
    expect(ref?.referencePrice).toBe(10.00); // Stale should be filtered out
    expect(ref?.sourceCount).toBe(1);
  });

  it('applies identity, price-type, and freshness comparability on the displayed price path', async () => {
    const observedAt = Date.now();
    const cardmarket = {
      cardId: baseCard.id,
      source: 'tcgdex',
      market: 'cardmarket',
      price: 10,
      currency: 'EUR',
      priceType: 'trend',
      transactionType: 'price-guide',
      observedAt,
      fetchedAt: observedAt,
      metadata: { field: 'trend', providerListingId: 'cm-1' },
    } satisfies PriceObservation;
    const tcgplayer = {
      cardId: baseCard.id,
      variant: 'normal',
      source: 'tcgdex',
      market: 'tcgplayer',
      price: 10,
      currency: 'USD',
      priceType: 'market',
      transactionType: 'price-guide',
      observedAt,
      fetchedAt: observedAt,
      metadata: { field: 'marketPrice', providerListingId: 'tp-1' },
    } satisfies PriceObservation;
    const stale = { ...tcgplayer, price: 100, observedAt: observedAt - 10 * 24 * 60 * 60 * 1000 };
    const low = { ...tcgplayer, price: 200, priceType: 'low' as const, metadata: { field: 'lowPrice' } };
    const otherCard = { ...tcgplayer, cardId: 'another-card', price: 300 };
    pricingService.clearProviders();
    pricingService.registerProvider({
      name: 'tcgdex',
      fetchPrices: vi.fn().mockResolvedValue([cardmarket, tcgplayer, stale, low, otherCard]),
    });

    const result = await pricingService.getConsolidatedPrice(baseCard);

    expect(result.value).toBe(10.4);
    expect(result.comparableObservations).toEqual([cardmarket, tcgplayer]);
    expect(result.observations).toHaveLength(5);
    expect(result.excludedObservations.map(({ reason }) => reason)).toEqual([
      'stale',
      'price-type',
      'card-identity',
    ]);
    expect(result.explanation.comparableObservationCount).toBe(2);
    expect(result.explanation.marketplaces).toEqual(['cardmarket', 'tcgplayer']);
    expect(result.explanation.providers).toEqual(['tcgdex']);
    expect(result.comparableObservations[0]).toMatchObject({
      source: 'tcgdex',
      market: 'cardmarket',
      priceType: 'trend',
      transactionType: 'price-guide',
      currency: 'EUR',
      observedAt,
      fetchedAt: observedAt,
      metadata: { providerListingId: 'cm-1' },
    });
  });

  it('requires the known printing variant on the displayed price path', async () => {
    const holoCard: Card = {
      ...baseCard,
      identity: { providerIds: { tcgdex: [baseCard.id] }, variant: 'holo' },
    };
    const observations: PriceObservation[] = [
      {
        cardId: baseCard.id,
        variant: 'normal',
        source: 'tcgdex',
        market: 'tcgplayer',
        price: 10,
        currency: 'USD',
        priceType: 'market',
        transactionType: 'price-guide',
        observedAt: Date.now(),
        fetchedAt: Date.now(),
        metadata: { field: 'marketPrice' },
      },
      {
        cardId: baseCard.id,
        variant: 'holo',
        source: 'tcgdex',
        market: 'tcgplayer',
        price: 20,
        currency: 'USD',
        priceType: 'market',
        transactionType: 'price-guide',
        observedAt: Date.now(),
        fetchedAt: Date.now(),
        metadata: { field: 'marketPrice' },
      },
    ];
    pricingService.clearProviders();
    pricingService.registerProvider({
      name: 'tcgdex',
      fetchPrices: vi.fn().mockResolvedValue(observations),
    });

    const result = await pricingService.getConsolidatedPrice(holoCard);

    expect(result.value).toBe(20);
    expect(result.comparableObservations.map(({ variant }) => variant)).toEqual(['holo']);
    expect(result.excludedObservations).toEqual([
      { observation: observations[0], reason: 'variant' },
    ]);
  });

  it('preserves source-neutral transaction metadata and isolates other provider failures', async () => {
    const observation: PriceObservation = {
      cardId: baseCard.id,
      source: 'regional-pricing-adapter',
      sourceType: 'marketplace',
      market: 'regional-market',
      marketCountry: 'PH',
      marketRegion: 'Central Visayas',
      language: 'ja',
      variant: 'firstEdition',
      condition: 'near_mint',
      transactionType: 'active-listing',
      listingStatus: 'active',
      price: 120,
      currency: 'PHP',
      priceType: 'market',
      observedAt: Date.now(),
      fetchedAt: Date.now(),
      sourceConfidence: 'medium',
      confidenceEvidence: 'Listing printing is matched to set and collector number.',
      provenance: {
        sourceUrl: 'https://market.example/listings/record-1',
        sourceRecordId: 'record-1',
        sourceRelationship: 'direct',
      },
    };
    pricingService.clearProviders();
    pricingService.registerProvider({
      name: 'regional-pricing-adapter',
      fetchPrices: vi.fn().mockResolvedValue([observation]),
    });
    pricingService.registerProvider({
      name: 'offline-adapter',
      fetchPrices: vi.fn().mockRejectedValue(new Error('Provider offline.')),
    });

    const result = await pricingService.getConsolidatedPrice(baseCard, {
      normalization: { variant: 'firstEdition', transactionType: 'active-listing' },
    });

    expect(result.comparableObservations).toEqual([observation]);
    expect(result.comparableObservations[0]).toMatchObject({
      sourceType: 'marketplace',
      transactionType: 'active-listing',
      listingStatus: 'active',
      marketCountry: 'PH',
      marketRegion: 'Central Visayas',
      language: 'ja',
      variant: 'firstEdition',
      condition: 'near_mint',
      provenance: {
        sourceUrl: 'https://market.example/listings/record-1',
        sourceRecordId: 'record-1',
        sourceRelationship: 'direct',
      },
      sourceConfidence: 'medium',
      confidenceEvidence: 'Listing printing is matched to set and collector number.',
    });
  });

  it('does not display an all-stale cached observation as a current reference', async () => {
    const staleObservation: PriceObservation = {
      cardId: baseCard.id,
      source: 'tcgdex',
      market: 'tcgplayer',
      price: 12,
      currency: 'USD',
      priceType: 'market',
      transactionType: 'price-guide',
      observedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      fetchedAt: Date.now(),
      metadata: { field: 'marketPrice' },
    };
    setOnline(false);
    mockGet.mockResolvedValue([staleObservation]);

    const result = await pricingService.getConsolidatedPrice(baseCard);

    expect(result.value).toBeNull();
    expect(result.explanation.freshness).toBe('stale');
    expect(result.excludedObservations).toEqual([
      { observation: staleObservation, reason: 'stale' },
    ]);
  });

  it('returns a fresh cached reference while offline without requesting providers', async () => {
    const cachedReference: PriceReference = {
      cardId: baseCard.id,
      referencePrice: 12.5,
      currency: 'USD',
      methodologyVersion: 'v1-median',
      confidence: 'low',
      sourceCount: 1,
      activeProviders: ['tcgdex'],
      activeMarketplaces: ['tcgplayer'],
      updatedAt: Date.now(),
    };
    setOnline(false);
    mockGet.mockResolvedValue(cachedReference);

    await expect(pricingService.getPriceReference(baseCard)).resolves.toEqual(cachedReference);
    expect(mockGet).toHaveBeenCalledWith(`cached_prices_store:${baseCard.id}`);
  });

  it('falls back to a stale cached reference when online providers return no prices', async () => {
    const staleReference: PriceReference = {
      cardId: baseCard.id,
      referencePrice: 9.75,
      currency: 'USD',
      methodologyVersion: 'v1-median',
      confidence: 'low',
      sourceCount: 1,
      activeProviders: ['tcgdex'],
      activeMarketplaces: ['tcgplayer'],
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    };
    pricingService.clearProviders();
    pricingService.registerProvider({
      name: 'tcgdex',
      fetchPrices: vi.fn().mockResolvedValue([]),
    });
    mockGet.mockResolvedValue(staleReference);

    await expect(pricingService.getPriceReference(baseCard)).resolves.toEqual(staleReference);
    expect(mockGet).toHaveBeenCalledWith(`cached_prices_store:${baseCard.id}`);
  });
});
