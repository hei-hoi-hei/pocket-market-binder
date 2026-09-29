import { SUPPORTED_CURRENCIES, type CurrencyCode } from './currencyService';

export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES;
export type CurrencyPreference = CurrencyCode;
export const CURRENCY_PREFERENCE_CHANGE_EVENT = 'pmb:currency-preference-change';

const CURRENCY_STORAGE_KEY = 'pmb:currency';
const DEFAULT_CURRENCY: CurrencyPreference = 'USD';

type CurrencyStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isCurrencyPreference(value: string | null): value is CurrencyPreference {
  return CURRENCY_OPTIONS.some((currency) => currency === value);
}

export function readCurrencyPreference(storage?: CurrencyStorage): CurrencyPreference {
  try {
    const storedValue = (storage ?? window.localStorage).getItem(CURRENCY_STORAGE_KEY);
    return isCurrencyPreference(storedValue) ? storedValue : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function writeCurrencyPreference(
  currency: CurrencyPreference,
  storage?: CurrencyStorage,
): void {
  if (!isCurrencyPreference(currency)) {
    throw new Error('Unsupported currency preference.');
  }
  (storage ?? window.localStorage).setItem(CURRENCY_STORAGE_KEY, currency);
  if (!storage && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CURRENCY_PREFERENCE_CHANGE_EVENT));
  }
}
