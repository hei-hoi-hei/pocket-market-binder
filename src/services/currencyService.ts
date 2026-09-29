export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'PHP'] as const;
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

export const CANONICAL_CALCULATION_CURRENCY: CurrencyCode = 'USD';

export interface ExchangeRate {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rate: number;
  source: string;
  effectiveAt?: number;
  fetchedAt?: number;
  kind: 'static-fallback' | 'provider';
}

export interface ExchangeRateProvider {
  getRate(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): ExchangeRate | null;
}

export type CurrencyConversionResult =
  | {
      status: 'converted';
      amount: number;
      fromCurrency: CurrencyCode;
      toCurrency: CurrencyCode;
      exchangeRate: ExchangeRate;
    }
  | {
      status: 'unsupported';
      fromCurrency: string;
      toCurrency: string;
      reason: string;
    };

const USD_PER_CURRENCY: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.28,
  CAD: 0.74,
  AUD: 0.66,
  JPY: 0.0068,
  PHP: 0.018,
};

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export class StaticFallbackExchangeRateProvider implements ExchangeRateProvider {
  getRate(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): ExchangeRate | null {
    const rate = USD_PER_CURRENCY[baseCurrency] / USD_PER_CURRENCY[quoteCurrency];
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return {
      baseCurrency,
      quoteCurrency,
      rate,
      source: 'Pocket Market Binder static fallback',
      kind: 'static-fallback',
    };
  }
}

export const staticFallbackExchangeRateProvider = new StaticFallbackExchangeRateProvider();

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rateProvider: ExchangeRateProvider = staticFallbackExchangeRateProvider,
): CurrencyConversionResult {
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
    return {
      status: 'unsupported',
      fromCurrency,
      toCurrency,
      reason: `No exchange-rate support is configured for ${!isSupportedCurrency(fromCurrency) ? fromCurrency : toCurrency}.`,
    };
  }
  if (!Number.isFinite(amount)) {
    return {
      status: 'unsupported',
      fromCurrency,
      toCurrency,
      reason: 'The amount to convert must be a finite number.',
    };
  }

  const exchangeRate = rateProvider.getRate(fromCurrency, toCurrency);
  if (!exchangeRate
    || exchangeRate.baseCurrency !== fromCurrency
    || exchangeRate.quoteCurrency !== toCurrency
    || !Number.isFinite(exchangeRate.rate)
    || exchangeRate.rate <= 0) {
    return {
      status: 'unsupported',
      fromCurrency,
      toCurrency,
      reason: `No valid exchange rate is available from ${fromCurrency} to ${toCurrency}.`,
    };
  }
  return {
    status: 'converted',
    amount: amount * exchangeRate.rate,
    fromCurrency,
    toCurrency,
    exchangeRate,
  };
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency });
}

export function convertCanonicalPriceForDisplay(
  amount: number,
  displayCurrency: CurrencyCode,
  rateProvider: ExchangeRateProvider = staticFallbackExchangeRateProvider,
): CurrencyConversionResult {
  return convertCurrency(amount, CANONICAL_CALCULATION_CURRENCY, displayCurrency, rateProvider);
}

export function formatCanonicalPriceForDisplay(
  amount: number,
  displayCurrency: CurrencyCode,
  rateProvider: ExchangeRateProvider = staticFallbackExchangeRateProvider,
): { conversion: CurrencyConversionResult; formatted: string | null } {
  const conversion = convertCanonicalPriceForDisplay(amount, displayCurrency, rateProvider);
  return {
    conversion,
    formatted: conversion.status === 'converted'
      ? formatCurrency(conversion.amount, displayCurrency)
      : null,
  };
}
