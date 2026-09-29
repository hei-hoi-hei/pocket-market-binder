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
    expect(readCurrencyPreference(createMemoryStorage({ 'pmb:currency': 'CAD' }))).toBe('USD');
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

    expect(() => writeCurrencyPreference('CAD' as 'USD', storage)).toThrow(/Unsupported currency/);
    expect(readCurrencyPreference(storage)).toBe('USD');
  });
});
