import type { PriceObservation, ComparableNormalizationOptions } from '../providers/pricingProvider';
import { ConsolidatedPrice, CONSOLIDATION_CONSTANTS } from './types';

// Conversion rates to USD for calculation ONLY.
// Never mutates original source observation values.
const CURRENCY_CONVERSION_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  CAD: 0.74,
  AUD: 0.66,
  JPY: 0.0068,
  PHP: 0.018,
};

export function normalizeToUSD(price: number, currency: string): number {
  const rate = CURRENCY_CONVERSION_TO_USD[currency.toUpperCase()] ?? 1.0;
  return price * rate;
}

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

function deduplicateObservations(obsList: PriceObservation[]): PriceObservation[] {
  const seen = new Set<string>();
  const result: PriceObservation[] = [];

  for (const obs of obsList) {
    const key = `${obs.source}:${obs.market}:${obs.priceType}:${obs.variant || 'normal'}:${obs.isGraded || false}:${obs.condition || 'ungraded'}:${obs.price}:${obs.currency}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(obs);
    }
  }
  return result;
}

export function filterComparableObservations(
  observations: PriceObservation[],
  options?: ComparableNormalizationOptions
): PriceObservation[] {
  // Deduplicate identical provider observations first
  const deduplicated = deduplicateObservations(observations);

  return deduplicated.filter((o) => {
    if (!o.price || o.price <= 0) return false;

    // Variant filter
    if (options?.variant) {
      if (o.variant !== options.variant) return false;
    } else {
      // Default: exclude non-normal variants if default/normal requested
      if (o.variant && o.variant !== 'normal') return false;
    }

    // Graded filter
    if (options?.isGraded !== undefined) {
      if (Boolean(o.isGraded) !== options.isGraded) return false;
    } else {
      // Default: exclude graded
      if (o.isGraded || o.condition === 'graded') return false;
    }

    // Condition filter
    if (options?.condition && options.condition !== 'graded') {
      if (o.condition && o.condition !== options.condition) return false;
    }

    // Language filter
    if (options?.language) {
      if (o.language && o.language !== options.language) return false;
    }

    // Price type filter
    if (options?.priceType) {
      if (o.priceType !== options.priceType) return false;
    }

    return true;
  });
}

export function consolidatePrices(
  observations: PriceObservation[],
  baseCurrency: string = 'USD',
  options?: ComparableNormalizationOptions
): ConsolidatedPrice {
  const allObservations = observations || [];

  if (allObservations.length === 0) {
    return {
      value: null,
      currency: baseCurrency,
      method: 'insufficient_data',
      status: 'insufficient_data',
      observationCount: 0,
      comparableObservationCount: 0,
      observations: [],
    };
  }

  const comparable = filterComparableObservations(allObservations, options);

  if (comparable.length === 0) {
    return {
      value: null,
      currency: baseCurrency,
      method: 'insufficient_data',
      status: 'insufficient_data',
      observationCount: allObservations.length,
      comparableObservationCount: 0,
      observations: allObservations,
    };
  }

  const normalizedValues = comparable.map((o) => normalizeToUSD(o.price, o.currency));
  const sortedValues = [...normalizedValues].sort((a, b) => a - b);

  const median = calculateMedian(sortedValues);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  const mean = normalizedValues.reduce((a, b) => a + b, 0) / normalizedValues.length;
  const spread = max - min;
  const relativeSpread = median > 0 ? spread / median : 0;
  const mad = calculateMAD(normalizedValues, median);

  const divergent = comparable.filter((o) => {
    const val = normalizeToUSD(o.price, o.currency);
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

  return {
    value: roundedValue,
    currency: baseCurrency,
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
    observations: allObservations,
  };
}

