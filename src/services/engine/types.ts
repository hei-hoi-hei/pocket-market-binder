import type { PriceObservation } from '../providers/pricingProvider';

export interface ConsolidatedPrice {
  value: number | null;
  currency: string;

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

  observations: PriceObservation[];
}

export const CONSOLIDATION_CONSTANTS = {
  REVIEW_THRESHOLD: 0.3, // 30%
  HIGH_DIVERGENCE_THRESHOLD: 0.6, // 60%
};
