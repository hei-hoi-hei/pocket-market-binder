import { describe, test, expect } from 'vitest';
import { consolidatePrices } from '../consolidationEngine';
import type { PriceObservation, PricingProviderName } from '../../providers/pricingProvider';

describe('ConsolidationEngine', () => {
  const baseObs: Omit<PriceObservation, 'price' | 'currency' | 'source' | 'market' | 'observedAt' | 'fetchedAt' | 'priceType'> = {
    cardId: 'test-card',
  };

  const MOCK_SOURCE: PricingProviderName = 'pkmnprices';

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
});

