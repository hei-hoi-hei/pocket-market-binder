import type { Card } from '@/types';
import type { PricingProvider, PriceObservation } from './pricingProvider';

export class JustTCGProvider implements PricingProvider {
  name = 'justtcg' as const;

  async fetchPrices(card: Card): Promise<PriceObservation[]> {
    // V1 Stub: API integration deferred. Returns empty array until implemented.
    if (!card) return [];
    return [];
  }
}

export const justtcgProvider = new JustTCGProvider();
