import type { PriceObservation } from '../providers/pricingProvider';
import type { CurrencyCode, ExchangeRate } from '../currencyService';

export type PriceExclusionReason =
  | 'duplicate'
  | 'invalid-price'
  | 'card-identity'
  | 'variant'
  | 'graded'
  | 'condition'
  | 'language'
  | 'price-type'
  | 'stale'
  | 'invalid-observed-at'
  | 'unsupported-currency';

export interface PriceObservationConversion {
  observation: PriceObservation;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  calculationCurrency: CurrencyCode;
  exchangeRate: ExchangeRate;
}

export interface ExcludedPriceObservation {
  observation: PriceObservation;
  reason: PriceExclusionReason;
  detail?: string;
}

export interface PriceExplanation {
  comparableObservationCount: number;
  providers: string[];
  marketplaces: string[];
  variants: string[];
  conditions: string[];
  priceTypes: string[];
  freshness: 'fresh' | 'stale' | 'unavailable';
  method: 'median' | 'single_source' | 'insufficient_data';
  divergence: 'normal' | 'review' | 'high_divergence' | 'insufficient_data';
  exclusions: Partial<Record<PriceExclusionReason, number>>;
  statements: string[];
  calculationCurrency: CurrencyCode;
  observationConversions: PriceObservationConversion[];
}

export interface ConsolidatedPrice {
  value: number | null;
  currency: CurrencyCode;
  observationConversions: PriceObservationConversion[];

  method: 'median' | 'single_source' | 'insufficient_data';

  status:
    | 'normal'
    | 'review'
    | 'high_divergence'
    | 'insufficient_data';

  observationCount: number;
  comparableObservationCount: number;

  min?: number;
  max?: number;
  mean?: number;
  median?: number;

  spread?: number;
  relativeSpread?: number;

  mad?: number; // Median Absolute Deviation

  divergentObservationCount?: number;

  comparableObservations: PriceObservation[];
  excludedObservations: ExcludedPriceObservation[];
  explanation: PriceExplanation;
  observations: PriceObservation[];
}

export const CONSOLIDATION_CONSTANTS = {
  REVIEW_THRESHOLD: 0.3, // 30%
  HIGH_DIVERGENCE_THRESHOLD: 0.6, // 60%
};
