import type { Card } from '@/types';
import type { PricingProvider, PriceObservation } from './pricingProvider';

export class TickerMintProvider implements PricingProvider {
  name = 'tickermint' as const;

  async fetchPrices(card: Card): Promise<PriceObservation[]> {
    // V1 Stub: API integration deferred. Returns empty array until implemented.
    if (!card) return [];
    return [];
  }
}

export const tickermintProvider = new TickerMintProvider();
