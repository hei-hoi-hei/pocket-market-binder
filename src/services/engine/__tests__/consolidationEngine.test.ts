import { describe, test, expect } from 'vitest';
import { classifyComparableObservations, consolidatePrices } from '../consolidationEngine';
import type {
  ComparableNormalizationOptions,
  PriceObservation,
  PricingProviderName,
} from '../../providers/pricingProvider';

describe('ConsolidationEngine', () => {
  const baseObs: Omit<PriceObservation, 'price' | 'currency' | 'source' | 'market' | 'observedAt' | 'fetchedAt' | 'priceType'> = {
    cardId: 'test-card',
    transactionType: 'price-guide',
  };

  const MOCK_SOURCE: PricingProviderName = 'pkmnprices';
  const currentTime = Date.now();

  function observation(overrides: Partial<PriceObservation> = {}): PriceObservation {
    return {
      cardId: 'test-card',
      source: MOCK_SOURCE,
      market: 'tcgplayer',
      price: 10,
      currency: 'USD',
      priceType: 'market',
      observedAt: currentTime,
      fetchedAt: currentTime,
      transactionType: 'price-guide',
      ...overrides,
    };
  }

  test('Case A: Tight cluster', () => {
    const obs: PriceObservation[] = [
      { ...baseObs, price: 9.5, currency: 'USD', source: MOCK_SOURCE, market: 'tcgplayer', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
      { ...baseObs, price: 10.0, currency: 'USD', source: MOCK_SOURCE, market: 'cardmarket', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
      { ...baseObs, price: 10.5, currency: 'USD', source: MOCK_SOURCE, market: 'cardtrader', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
    ];
    const result = consolidatePrices(obs);
    expect(result.value).toBe(10);
    expect(result.status).toBe('normal');
  });

  test('Case B: One extreme value', () => {
    const obs: PriceObservation[] = [
      { ...baseObs, price: 9.5, currency: 'USD', source: MOCK_SOURCE, market: 'tcgplayer', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
      { ...baseObs, price: 10.0, currency: 'USD', source: MOCK_SOURCE, market: 'cardmarket', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
      { ...baseObs, price: 10.5, currency: 'USD', source: MOCK_SOURCE, market: 'cardtrader', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
      { ...baseObs, price: 85.0, currency: 'USD', source: MOCK_SOURCE, market: 'other', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
    ];
    const result = consolidatePrices(obs);
    expect(result.value).toBe(10.25);
    expect(result.status).toBe('high_divergence');
  });

  test('Case D: Single source', () => {
    const obs: PriceObservation[] = [
      { ...baseObs, price: 10.0, currency: 'USD', source: MOCK_SOURCE, market: 'tcgplayer', observedAt: 0, fetchedAt: 0, priceType: 'market' } as PriceObservation,
    ];
    const result = consolidatePrices(obs);
    expect(result.value).toBe(10);
    expect(result.method).toBe('single_source');
  });

  test('requires the requested card identity and retains mismatched observations for provenance', () => {
    const matching = observation();
    const otherCard = observation({ cardId: 'another-card' });
    const result = consolidatePrices([matching, otherCard], 'USD', { cardId: 'test-card' });

    expect(result.comparableObservations).toEqual([matching]);
    expect(result.observations).toEqual([matching, otherCard]);
    expect(result.excludedObservations).toEqual([{ observation: otherCard, reason: 'card-identity' }]);
  });

  test('keeps transaction classes separate by default and permits an explicitly selected class', () => {
    const guide = observation({ price: 10, transactionType: 'price-guide' });
    const completedSale = observation({
      source: 'sales-source',
      price: 100,
      transactionType: 'completed-sale',
    });
    const activeListing = observation({
      source: 'listing-source',
      price: 200,
      transactionType: 'active-listing',
    });
    const unknownClass = observation({
      source: 'unclassified-source',
      price: 300,
      transactionType: undefined,
    });

    const defaultReference = consolidatePrices([guide, completedSale, activeListing, unknownClass]);
    const requestedSales = consolidatePrices([guide, completedSale, activeListing, unknownClass], 'USD', {
      transactionType: 'completed-sale',
    });

    expect(defaultReference.value).toBe(10);
    expect(defaultReference.comparableObservations).toEqual([guide]);
    expect(defaultReference.excludedObservations).toEqual([
      { observation: completedSale, reason: 'transaction-type' },
      { observation: activeListing, reason: 'transaction-type' },
      { observation: unknownClass, reason: 'transaction-type' },
    ]);
    expect(requestedSales.value).toBe(100);
    expect(requestedSales.comparableObservations).toEqual([completedSale]);
    expect(requestedSales.excludedObservations).toEqual([
      { observation: guide, reason: 'transaction-type' },
      { observation: activeListing, reason: 'transaction-type' },
      { observation: unknownClass, reason: 'transaction-type' },
    ]);
  });

  test('preserves source class, transaction, market, and provenance metadata through normalization', () => {
    const evidence = observation({
      source: 'regional-market-provider',
      sourceType: 'marketplace',
      market: 'regional-card-market',
      marketCountry: 'PH',
      marketRegion: 'Central Visayas',
      language: 'ja',
      variant: 'firstEdition',
      condition: 'near_mint',
      transactionType: 'completed-sale',
      listingStatus: 'sold',
      sourceConfidence: 'medium',
      confidenceEvidence: 'Exact printing inferred from listing title and set metadata.',
      provenance: {
        sourceUrl: 'https://market.example/sales/record-1',
        sourceRecordId: 'record-1',
        sourceRelationship: 'aggregated',
        upstreamSources: ['regional-auction-market'],
      },
    });
    const activeListing = observation({
      ...evidence,
      transactionType: 'active-listing',
      listingStatus: 'active',
    });
    const endedSale = observation({
      ...evidence,
      listingStatus: 'ended',
    });
    expect(classifyComparableObservations(
      [evidence, activeListing, endedSale],
      { variant: 'firstEdition', transactionType: 'completed-sale' },
    ).comparableObservations)
      .toEqual([evidence, endedSale]);
    const result = consolidatePrices([evidence, activeListing, endedSale], 'USD', {
      cardId: 'test-card',
      variant: 'firstEdition',
      transactionType: 'completed-sale',
      listingStatus: 'sold',
      now: currentTime,
      maxObservationAgeMs: 60_000,
    });

    expect(result.comparableObservations).toEqual([evidence]);
    expect(result.excludedObservations).toEqual([
      { observation: activeListing, reason: 'transaction-type' },
      { observation: endedSale, reason: 'listing-status' },
    ]);
    expect(result.comparableObservations[0]).toMatchObject({
      source: 'regional-market-provider',
      sourceType: 'marketplace',
      transactionType: 'completed-sale',
      listingStatus: 'sold',
      marketCountry: 'PH',
      marketRegion: 'Central Visayas',
      language: 'ja',
      variant: 'firstEdition',
      condition: 'near_mint',
      provenance: {
        sourceUrl: 'https://market.example/sales/record-1',
        sourceRecordId: 'record-1',
        sourceRelationship: 'aggregated',
        upstreamSources: ['regional-auction-market'],
      },
      sourceConfidence: 'medium',
      confidenceEvidence: 'Exact printing inferred from listing title and set metadata.',
    });
  });

  test('accepts normal and untagged observations but excludes explicitly different variants by default', () => {
    const normal = observation({ variant: 'normal' });
    const untagged = observation({ market: 'cardmarket' });
    const holo = observation({ variant: 'holo' });
    const result = classifyComparableObservations([normal, untagged, holo]);

    expect(result.comparableObservations).toEqual([normal, untagged]);
    expect(result.excludedObservations).toEqual([{ observation: holo, reason: 'variant' }]);
  });

  test('accepts the requested variant and does not treat unsupported requested variants as a default', () => {
    const holo = observation({ variant: 'holo' });
    const normal = observation({ variant: 'normal' });
    const matched = classifyComparableObservations([holo, normal], { variant: 'holo' });
    const unsupported = classifyComparableObservations([holo, normal], {
      variantSpecified: true,
    });

    expect(matched.comparableObservations).toEqual([holo]);
    expect(matched.excludedObservations).toEqual([{ observation: normal, reason: 'variant' }]);
    expect(unsupported.comparableObservations).toEqual([]);
    expect(unsupported.excludedObservations.every(({ reason }) => reason === 'variant')).toBe(true);
  });

  test('excludes graded and incompatible-condition observations but permits missing condition metadata', () => {
    const raw = observation({ condition: 'near_mint', isGraded: false });
    const missingCondition = observation({ market: 'cardmarket' });
    const graded = observation({ isGraded: true });
    const incompatibleCondition = observation({ condition: 'damaged' });
    const result = classifyComparableObservations([raw, missingCondition, graded, incompatibleCondition], {
      condition: 'near_mint',
      isGraded: false,
    });

    expect(result.comparableObservations).toEqual([raw, missingCondition]);
    expect(result.excludedObservations).toEqual([
      { observation: graded, reason: 'graded' },
      { observation: incompatibleCondition, reason: 'condition' },
    ]);
  });

  test('uses the designated TCGdex reference fields and retains excluded price metrics', () => {
    const cardmarketTrend = observation({
      source: 'tcgdex',
      market: 'cardmarket',
      priceType: 'trend',
      metadata: { field: 'trend' },
    });
    const tcgplayerMarket = observation({
      source: 'tcgdex',
      market: 'tcgplayer',
      priceType: 'market',
      variant: 'normal',
      metadata: { field: 'marketPrice' },
    });
    const low = observation({
      source: 'tcgdex',
      market: 'tcgplayer',
      priceType: 'low',
      variant: 'normal',
      metadata: { field: 'lowPrice' },
    });
    const result = consolidatePrices([cardmarketTrend, tcgplayerMarket, low], 'USD', {
      cardId: 'test-card',
    });

    expect(result.value).toBe(10);
    expect(result.comparableObservations).toEqual([cardmarketTrend, tcgplayerMarket]);
    expect(result.observations).toHaveLength(3);
    expect(result.excludedObservations).toEqual([{ observation: low, reason: 'price-type' }]);
  });

  test('deduplicates exact observations without collapsing distinct listing observations', () => {
    const duplicate = observation({ metadata: { providerListingId: 'listing-1' } });
    const exactDuplicate = { ...duplicate, metadata: { providerListingId: 'listing-1' } };
    const distinct = observation({
      metadata: { providerListingId: 'listing-2' },
    });
    const result = consolidatePrices([duplicate, exactDuplicate, distinct]);

    expect(result.comparableObservationCount).toBe(2);
    expect(result.comparableObservations).toEqual([duplicate, distinct]);
    expect(result.excludedObservations).toEqual([{ observation: exactDuplicate, reason: 'duplicate' }]);
  });

  test('excludes stale observations and reports an all-stale result without a current reference', () => {
    const options: ComparableNormalizationOptions = {
      cardId: 'test-card',
      maxObservationAgeMs: 1000,
      now: currentTime,
    };
    const fresh = observation({ observedAt: currentTime - 500 });
    const stale = observation({ price: 30, observedAt: currentTime - 2000 });
    const mixed = consolidatePrices([fresh, stale], 'USD', options);
    const allStale = consolidatePrices([stale], 'USD', options);

    expect(mixed.value).toBe(10);
    expect(mixed.excludedObservations).toEqual([{ observation: stale, reason: 'stale' }]);
    expect(allStale.value).toBeNull();
    expect(allStale.explanation.freshness).toBe('stale');
    expect(allStale.explanation.statements.join(' ')).toContain('1 stale observation was excluded');
  });

  test('rejects invalid and zero prices without discarding their raw provenance', () => {
    const invalid = observation({ price: Number.NaN });
    const zero = observation({ price: 0 });
    const result = consolidatePrices([invalid, zero]);

    expect(result.value).toBeNull();
    expect(result.observations).toEqual([invalid, zero]);
    expect(result.excludedObservations.map(({ reason }) => reason)).toEqual([
      'invalid-price',
      'invalid-price',
    ]);
  });

  test('explanation reports the actual contributing sources, marketplaces, and divergence', () => {
    const tcgplayer = observation({
      source: 'tcgdex',
      market: 'tcgplayer',
      price: 10,
      metadata: { field: 'marketPrice' },
    });
    const cardmarket = observation({
      source: 'tcgdex',
      market: 'cardmarket',
      price: 20,
      priceType: 'trend',
      metadata: { field: 'trend' },
    });
    const result = consolidatePrices([tcgplayer, cardmarket], 'USD', { cardId: 'test-card' });

    expect(result.explanation.comparableObservationCount).toBe(2);
    expect(result.explanation.providers).toEqual(['tcgdex']);
    expect(result.explanation.marketplaces).toEqual(['cardmarket', 'tcgplayer']);
    expect(result.explanation.priceTypes).toEqual(['cardmarket trend', 'tcgplayer market']);
    expect(result.explanation.divergence).toBe('high_divergence');
    expect(result.explanation.statements.join(' ')).toContain('High price divergence');
  });
});
