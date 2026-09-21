import type { PriceObservation, PricingProvider, PricingProviderName } from './pricingProvider';
import type { Card } from '@/types';
import { storage } from '../storage';

export class RemotePricingProvider implements PricingProvider {
  name: PricingProviderName = 'tickermint'; // Type fallback
  isSecondary = false;

  private endpoint = import.meta.env.VITE_PRICING_PROXY_URL || '';

  async fetchPrices(card: Card): Promise<PriceObservation[]> {
    if (!this.endpoint) return [];

    try {
      const response = await fetch(`${this.endpoint}/api/prices?cardId=${encodeURIComponent(card.id)}`);
      if (!response.ok) return [];
      
      const obs: PriceObservation[] = await response.json();
      
      // Store in IndexedDB for offline fallback
      if (obs && obs.length > 0) {
        await storage.set(`cached_prices_store:${card.id}`, obs);
      }
      
      return obs;
    } catch {
      // Gracefully fail and return empty
      return [];
    }
  }
}

export const remotePricingProvider = new RemotePricingProvider();

