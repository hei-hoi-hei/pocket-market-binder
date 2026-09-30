import { describe, expect, it } from 'vitest';
import { consolidatePrices } from '../engine/consolidationEngine';
import { readCurrencyPreference, writeCurrencyPreference } from '../currencyPreference';
import {
  convertCurrency,
  formatCanonicalPriceForDisplay,
  type ExchangeRateProvider,
} from '../currencyService';
import type { PriceObservation } from '../providers/pricingProvider';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function observation(overrides: Partial<PriceObservation> = {}): PriceObservation {
  const now = Date.now();
  return {
    cardId: 'currency-test-card',
    source: 'pkmnprices',
    market: 'tcgplayer',
    price: 10,
    currency: 'USD',
    priceType: 'market',
    transactionType: 'price-guide',
    observedAt: now,
    fetchedAt: now,
    ...overrides,
  };
}

describe('currency service', () => {
  it('converts USD to USD, EUR, PHP, and JPY using the static fallback', () => {
    expect(convertCurrency(100, 'USD', 'USD')).toMatchObject({
      status: 'converted',
      amount: 100,
      exchangeRate: { rate: 1, kind: 'static-fallback' },
    });
    expect(convertCurrency(100, 'USD', 'EUR')).toMatchObject({ status: 'converted' });
    expect(convertCurrency(100, 'USD', 'EUR')).toMatchObject({ amount: 100 / 1.08 });
    expect(convertCurrency(100, 'USD', 'PHP')).toMatchObject({ amount: 100 / 0.018 });
    expect(convertCurrency(100, 'USD', 'JPY')).toMatchObject({ amount: 100 / 0.0068 });
  });

  it('converts a non-USD raw observation to canonical USD without mutating provenance', () => {
    const sourceObservation = observation({ price: 10, currency: 'EUR' });
    const original = { ...sourceObservation };

    const result = consolidatePrices([sourceObservation]);

    expect(result.value).toBe(10.8);
    expect(result.currency).toBe('USD');
    expect(result.observations[0]).toEqual(original);
    expect(result.observationConversions[0]).toMatchObject({
      originalAmount: 10,
      originalCurrency: 'EUR',
      convertedAmount: 10.8,
      calculationCurrency: 'USD',
      exchangeRate: { baseCurrency: 'EUR', quoteCurrency: 'USD', kind: 'static-fallback' },
    });
  });

  it('converts the final canonical Market Reference to the stored display preference', () => {
    const storage = createMemoryStorage();
    writeCurrencyPreference('USD', storage);
    const usdOutput = formatCanonicalPriceForDisplay(100, readCurrencyPreference(storage));
    writeCurrencyPreference('PHP', storage);
    const phpPreference = readCurrencyPreference(storage);
    const phpOutput = formatCanonicalPriceForDisplay(100, phpPreference);

    expect(usdOutput.conversion.status).toBe('converted');
    expect(usdOutput.formatted).toContain('$100.00');
    expect(phpOutput.conversion).toMatchObject({
      status: 'converted',
      toCurrency: 'PHP',
      exchangeRate: {
        source: 'Pocket Market Binder static fallback',
        kind: 'static-fallback',
      },
    });
    expect(phpOutput.formatted).toContain('5,555.56');
  });

  it('reports unsupported currencies and missing rates instead of using a 1:1 rate', () => {
    expect(convertCurrency(25, 'XYZ', 'USD')).toMatchObject({
      status: 'unsupported',
      reason: expect.stringContaining('XYZ'),
    });
    const missingRateProvider: ExchangeRateProvider = { getRate: () => null };
    expect(convertCurrency(25, 'USD', 'PHP', missingRateProvider)).toMatchObject({
      status: 'unsupported',
      reason: expect.stringContaining('No valid exchange rate'),
    });
    const unsupportedObservation = observation({ currency: 'XYZ' });
    const result = consolidatePrices([unsupportedObservation]);
    expect(result.value).toBeNull();
    expect(result.excludedObservations).toEqual([
      {
        observation: unsupportedObservation,
        reason: 'unsupported-currency',
        detail: expect.stringContaining('XYZ'),
      },
    ]);
  });

  it('exposes calculation and conversion-rate metadata for price explanations', () => {
    const result = consolidatePrices([observation({ currency: 'EUR' })]);

    expect(result.explanation.calculationCurrency).toBe('USD');
    expect(result.explanation.observationConversions[0]).toMatchObject({
      originalCurrency: 'EUR',
      calculationCurrency: 'USD',
      exchangeRate: {
        source: 'Pocket Market Binder static fallback',
        kind: 'static-fallback',
      },
    });
    expect(result.explanation.statements.join(' ')).toContain('no live exchange-rate provider');
  });

  it('keeps median consolidation in canonical currency', () => {
    const result = consolidatePrices([
      observation({ price: 10, currency: 'USD' }),
      observation({ price: 10, currency: 'EUR', market: 'cardmarket' }),
    ]);

    expect(result.value).toBe(10.4);
    expect(result.method).toBe('median');
    expect(result.median).toBe(10.4);
  });
});
