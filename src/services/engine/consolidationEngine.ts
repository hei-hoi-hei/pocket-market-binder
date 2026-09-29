import type { PriceObservation, ComparableNormalizationOptions } from '../providers/pricingProvider';
import {
  ConsolidatedPrice,
  CONSOLIDATION_CONSTANTS,
  ExcludedPriceObservation,
  PriceExclusionReason,
  PriceExplanation,
  PriceObservationConversion,
} from './types';
import {
  CANONICAL_CALCULATION_CURRENCY,
  convertCurrency,
  ExchangeRateProvider,
  staticFallbackExchangeRateProvider,
  type CurrencyCode,
} from '../currencyService';

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateMAD(values: number[], median: number): number {
  if (values.length === 0) return 0;
  const deviations = values.map((v) => Math.abs(v - median));
  return calculateMedian(deviations);
}

function observationKey(obs: PriceObservation): string {
  return JSON.stringify([
    obs.cardId,
    obs.source,
    obs.market,
    obs.priceType,
    obs.variant ?? 'normal',
    obs.isGraded ?? false,
    obs.condition ?? 'ungraded',
    obs.language ?? '',
    obs.price,
    obs.currency,
    obs.observedAt,
    obs.fetchedAt,
    obs.metadata?.providerListingId ?? obs.metadata?.idProduct ?? '',
  ]);
}

function defaultPriceTypeIsComparable(observation: PriceObservation): boolean {
  if (observation.source !== 'tcgdex') return observation.priceType === 'market';

  const field = observation.metadata?.field;
  if (observation.market === 'cardmarket') {
    return observation.priceType === 'trend' && (field === 'trend' || field === 'trend-holo');
  }
  if (observation.market === 'tcgplayer') {
    return observation.priceType === 'market' && field === 'marketPrice';
  }
  return false;
}

function exclusionReason(
  observation: PriceObservation,
  options: ComparableNormalizationOptions,
): PriceExclusionReason | null {
  if (!Number.isFinite(observation.price) || observation.price <= 0) return 'invalid-price';
  if (options.cardId && observation.cardId !== options.cardId) return 'card-identity';

  if (options.variantSpecified && !options.variant) return 'variant';
  if (options.variant) {
    if (observation.variant !== options.variant) return 'variant';
  } else if (observation.variant && observation.variant !== 'normal') {
    return 'variant';
  }

  const graded = Boolean(observation.isGraded) || observation.condition === 'graded';
  if (options.isGraded !== true && graded) return 'graded';
  if (options.isGraded === true && !graded) return 'graded';
  if (options.condition && options.condition !== 'graded'
    && observation.condition && observation.condition !== options.condition) return 'condition';
  if (options.language && observation.language && observation.language !== options.language) return 'language';
  if (options.priceType
    ? observation.priceType !== options.priceType
    : !defaultPriceTypeIsComparable(observation)) return 'price-type';

  if (options.maxObservationAgeMs !== undefined) {
    if (!Number.isFinite(observation.observedAt) || observation.observedAt <= 0) {
      return 'invalid-observed-at';
    }
    const ageMs = (options.now ?? Date.now()) - observation.observedAt;
    if (ageMs < 0) return 'invalid-observed-at';
    if (ageMs > options.maxObservationAgeMs) return 'stale';
  }
  return null;
}

export function classifyComparableObservations(
  observations: PriceObservation[],
  options: ComparableNormalizationOptions = {},
): { comparableObservations: PriceObservation[]; excludedObservations: ExcludedPriceObservation[] } {
  const comparableObservations: PriceObservation[] = [];
  const excludedObservations: ExcludedPriceObservation[] = [];
  const seen = new Set<string>();

  for (const observation of observations) {
    const reason = exclusionReason(observation, options);
    if (reason) {
      excludedObservations.push({ observation, reason });
      continue;
    }
    const key = observationKey(observation);
    if (seen.has(key)) {
      excludedObservations.push({ observation, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    comparableObservations.push(observation);
  }
  return { comparableObservations, excludedObservations };
}

export function filterComparableObservations(
  observations: PriceObservation[],
  options?: ComparableNormalizationOptions,
): PriceObservation[] {
  return classifyComparableObservations(observations, options).comparableObservations;
}

function buildExplanation(
  comparableObservations: PriceObservation[],
  excludedObservations: ExcludedPriceObservation[],
  observationConversions: PriceObservationConversion[],
  result: Pick<ConsolidatedPrice, 'method' | 'status'>,
  freshnessChecked: boolean,
  calculationCurrency: CurrencyCode,
): PriceExplanation {
  const providers = [...new Set(comparableObservations.map(({ source }) => source))].sort();
  const marketplaces = [...new Set(comparableObservations.map(({ market }) => market))].sort();
  const variants = [...new Set(comparableObservations.map(({ variant }) => variant ?? 'untagged'))].sort();
  const conditions = [...new Set(comparableObservations.map((observation) => {
    if (observation.condition) return observation.condition.replace(/_/g, ' ');
    if (observation.isGraded === false) return 'ungraded status reported';
    if (observation.isGraded === true) return 'graded';
    return 'not reported';
  }))].sort();
  const priceTypes = [...new Set(comparableObservations.map(({ market, priceType }) =>
    `${market} ${priceType}`,
  ))].sort();
  const exclusions: PriceExplanation['exclusions'] = {};
  for (const { reason } of excludedObservations) exclusions[reason] = (exclusions[reason] ?? 0) + 1;

  const freshness = comparableObservations.length > 0
    ? freshnessChecked ? 'fresh' : 'unavailable'
    : (exclusions.stale ?? 0) > 0
      ? 'stale'
      : 'unavailable';
  const statements = [
    `${comparableObservations.length} comparable observation${comparableObservations.length === 1 ? '' : 's'}.`,
    `Market Reference is calculated in ${calculationCurrency}.`,
  ];
  if (marketplaces.length > 0) statements.push(`${marketplaces.length} marketplace${marketplaces.length === 1 ? '' : 's'} represented.`);
  if (providers.length > 0) statements.push(`Provider${providers.length === 1 ? '' : 's'}: ${providers.join(', ')}.`);
  if (variants.length > 0) statements.push(`Printing variants represented: ${variants.join(', ')}.`);
  if (conditions.length > 0) statements.push(`Condition metadata: ${conditions.join(', ')}.`);
  if (priceTypes.length > 0) statements.push(`Reference metrics: ${priceTypes.join(', ')}.`);
  if (freshness === 'fresh') statements.push('Comparable observations are within the configured freshness window.');
  if (freshness === 'unavailable' && comparableObservations.length > 0) statements.push('Freshness was not checked by this calculation.');
  if (freshness === 'stale') statements.push(`${exclusions.stale} stale observation${exclusions.stale === 1 ? ' was' : 's were'} excluded; no current comparable observation was available.`);
  if (result.method === 'median') statements.push('Median used as the central reference.');
  if (result.method === 'single_source') statements.push('Single observation; no multi-observation median is available.');
  if (result.status === 'review') statements.push('Moderate price divergence detected.');
  if (result.status === 'high_divergence') statements.push('High price divergence detected; all comparable observations remain included.');
  for (const [reason, count] of Object.entries(exclusions)) {
    if (count) statements.push(`${count} observation${count === 1 ? ' was' : 's were'} excluded: ${reason.replace(/-/g, ' ')}.`);
  }
  if (observationConversions.some(({ exchangeRate }) => exchangeRate.kind === 'static-fallback')) {
    statements.push('Source currencies were converted using static fallback rates; no live exchange-rate provider is configured.');
  }
  return {
    comparableObservationCount: comparableObservations.length,
    providers,
    marketplaces,
    variants,
    conditions,
    priceTypes,
    freshness,
    method: result.method,
    divergence: result.status,
    exclusions,
    statements,
    calculationCurrency,
    observationConversions,
  };
}

export function consolidatePrices(
  observations: PriceObservation[],
  baseCurrency: CurrencyCode = CANONICAL_CALCULATION_CURRENCY,
  options?: ComparableNormalizationOptions,
  rateProvider: ExchangeRateProvider = staticFallbackExchangeRateProvider,
): ConsolidatedPrice {
  const allObservations = observations || [];
  const { comparableObservations: classifiedComparable, excludedObservations } =
    classifyComparableObservations(allObservations, options);
  const comparable: PriceObservation[] = [];
  const observationConversions: PriceObservationConversion[] = [];
  const normalizedValues: number[] = [];
  for (const observation of classifiedComparable) {
    const conversion = convertCurrency(observation.price, observation.currency, baseCurrency, rateProvider);
    if (conversion.status === 'unsupported') {
      excludedObservations.push({
        observation,
        reason: 'unsupported-currency',
        detail: conversion.reason,
      });
      continue;
    }
    comparable.push(observation);
    normalizedValues.push(conversion.amount);
    observationConversions.push({
      observation,
      originalAmount: observation.price,
      originalCurrency: observation.currency,
      convertedAmount: conversion.amount,
      calculationCurrency: baseCurrency,
      exchangeRate: conversion.exchangeRate,
    });
  }

  if (comparable.length === 0) {
    const result: ConsolidatedPrice = {
      value: null,
      currency: baseCurrency,
      observationConversions,
      method: 'insufficient_data',
      status: 'insufficient_data',
      observationCount: allObservations.length,
      comparableObservationCount: 0,
      comparableObservations: [],
      excludedObservations,
      explanation: buildExplanation([], excludedObservations, observationConversions, {
        method: 'insufficient_data',
        status: 'insufficient_data',
      }, options?.maxObservationAgeMs !== undefined, baseCurrency),
      observations: allObservations,
    };
    return result;
  }

  const sortedValues = [...normalizedValues].sort((a, b) => a - b);

  const median = calculateMedian(sortedValues);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  const mean = normalizedValues.reduce((a, b) => a + b, 0) / normalizedValues.length;
  const spread = max - min;
  const relativeSpread = median > 0 ? spread / median : 0;
  const mad = calculateMAD(normalizedValues, median);

  const divergent = comparable.filter((o, index) => {
    const val = normalizedValues[index];
    const deviation = median > 0 ? Math.abs(val - median) / median : 0;
    return deviation > CONSOLIDATION_CONSTANTS.REVIEW_THRESHOLD;
  });

  let status: ConsolidatedPrice['status'] = 'normal';
  if (comparable.length >= 2) {
    if (relativeSpread > CONSOLIDATION_CONSTANTS.HIGH_DIVERGENCE_THRESHOLD) {
      status = 'high_divergence';
    } else if (relativeSpread > CONSOLIDATION_CONSTANTS.REVIEW_THRESHOLD) {
      status = 'review';
    }
  }

  const roundedValue = Math.round(median * 100) / 100;

  const result: ConsolidatedPrice = {
    value: roundedValue,
    currency: baseCurrency,
    observationConversions,
    method: comparable.length === 1 ? 'single_source' : 'median',
    status,
    observationCount: allObservations.length,
    comparableObservationCount: comparable.length,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: roundedValue,
    spread: Math.round(spread * 100) / 100,
    relativeSpread: Math.round(relativeSpread * 10000) / 10000,
    mad: Math.round(mad * 100) / 100,
    divergentObservationCount: divergent.length,
    comparableObservations: comparable,
    excludedObservations,
    explanation: buildExplanation(comparable, excludedObservations, observationConversions, {
      method: comparable.length === 1 ? 'single_source' : 'median',
      status,
    }, options?.maxObservationAgeMs !== undefined, baseCurrency),
    observations: allObservations,
  };
  return result;
}
