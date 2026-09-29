import { describe, expect, it } from 'vitest';
import {
  readCurrencyPreference,
  writeCurrencyPreference,
} from '../currencyPreference';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('currency preference', () => {
  it('persists a selection and reads it again after reopening', () => {
    const storage = createMemoryStorage();

    writeCurrencyPreference('EUR', storage);

    expect(readCurrencyPreference(storage)).toBe('EUR');
  });

  it('defaults missing or invalid values to USD', () => {
    expect(readCurrencyPreference(createMemoryStorage())).toBe('USD');
    expect(readCurrencyPreference(createMemoryStorage({ 'pmb:currency': 'unknown' }))).toBe('USD');
  });

  it('accepts every currency supported by the conversion service', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'PHP'] as const) {
      const storage = createMemoryStorage();
      writeCurrencyPreference(currency, storage);
      expect(readCurrencyPreference(storage)).toBe(currency);
    }
  });

  it('falls back to USD when local storage cannot be read', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('Storage unavailable'); },
      setItem: () => { throw new Error('Storage unavailable'); },
    };

    expect(readCurrencyPreference(unavailableStorage)).toBe('USD');
  });

  it('rejects unsupported values before writing', () => {
    const storage = createMemoryStorage();

    expect(() => writeCurrencyPreference('XYZ' as 'USD', storage)).toThrow(/Unsupported currency/);
    expect(readCurrencyPreference(storage)).toBe('USD');
  });
});
