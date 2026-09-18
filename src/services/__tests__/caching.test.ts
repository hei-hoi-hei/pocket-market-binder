import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityService } from '../identityService';
import { PricingService } from '../pricingService';
import type { Card } from '@/types';
import type { IdentityVerificationProvider, CardVerificationResult } from '../providers/identityProvider';
import type { PricingProvider, PriceObservation } from '../providers/pricingProvider';

// Mock storage with in-memory map for key isolation testing
const store = new Map<string, any>();

vi.mock('../storage', () => ({
  storage: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, val: any) => { store.set(key, val); },
    remove: async (key: string) => { store.delete(key); },
  },
}));

function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: online,
    configurable: true,
  });
}

class MockSecondaryPriceProvider implements PricingProvider {
  name = 'tickermint' as const;
  isSecondary = true;

  constructor(private obsToReturn: PriceObservation[]) {}

  async fetchPrices(): Promise<PriceObservation[]> {
    return this.obsToReturn;
  }
}

describe('Caching & Isolation Foundation', () => {
  beforeEach(() => {
    store.clear();
    setOnline(true);
  });

  const cardA: Card = {
    id: 'sv3pt5-1',
    name: 'Bulbasaur',
    category: 'pokemon',
    rarity: 'common',
    setCode: 'sv3pt5',
    setNumber: '1',
  };

  const cardB: Card = {
    id: 'sv3pt5-2',
    name: 'Ivysaur',
    category: 'pokemon',
    rarity: 'uncommon',
    setCode: 'sv3pt5',
    setNumber: '2',
  };

  it('stores and reuses identity verification results without collisions across cards', async () => {
    const identityService = new IdentityService();
    
    const mockProvider: IdentityVerificationProvider = {
      name: 'provider-1',
      verifyIdentity: async (clues) => ({
        provider: 'provider-1',
        matchedProviderId: `p1-${clues.name}`,
        evidence: { nameMatch: true },
        observedAt: Date.now(),
      }),
    };
    identityService.registerProvider(mockProvider);

    // Verify Card A
    await identityService.verifyCard(cardA);

    // Verify Card B
    const cardBIncomplete = { ...cardB, id: 'sv3pt5-2', imageUrlHigh: undefined };
    await identityService.verifyCard(cardBIncomplete);

    expect(store.has('identity_verification:sv3pt5-1')).toBe(true);
    expect(store.has('identity_verification:sv3pt5-2')).toBe(true);

    const resA = store.get('identity_verification:sv3pt5-1');
    const resB = store.get('identity_verification:sv3pt5-2');

    expect(resA[0].matchedProviderId).toBe('p1-Bulbasaur');
    expect(resA).not.toEqual(resB); // Ensure no collision between unrelated cards
  });

  it('keeps price verification cache isolated from raw observations and references', async () => {
    const pricingService = new PricingService();
    pricingService.clearProviders();

    // Primary provider returning high divergence
    const primaryProvider: PricingProvider = {
      name: 'justtcg',
      isSecondary: false,
      fetchPrices: async () => [
        { cardId: 'sv3pt5-1', source: 'justtcg', market: 'tcgplayer', price: 10, currency: 'USD', priceType: 'market', observedAt: Date.now(), fetchedAt: Date.now() },
        { cardId: 'sv3pt5-1', source: 'justtcg', market: 'cardmarket', price: 10, currency: 'USD', priceType: 'market', observedAt: Date.now(), fetchedAt: Date.now() },
        { cardId: 'sv3pt5-1', source: 'justtcg', market: 'cardtrader', price: 20, currency: 'USD', priceType: 'market', observedAt: Date.now(), fetchedAt: Date.now() },
      ],
    };

    // Secondary provider
    const secondaryProvider = new MockSecondaryPriceProvider([
      { cardId: 'sv3pt5-1', source: 'tickermint', market: 'tcgplayer', price: 11, currency: 'USD', priceType: 'market', observedAt: Date.now(), fetchedAt: Date.now() },
    ]);

    pricingService.registerProvider(primaryProvider);
    pricingService.registerProvider(secondaryProvider);

    await pricingService.getPriceReference(cardA, { forceRefresh: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Verify key isolation in storage
    expect(store.has('cached_prices_store:sv3pt5-1')).toBe(true);
    expect(store.has('cached_observations_store:sv3pt5-1')).toBe(true);
    expect(store.has('cached_price_verification:sv3pt5-1')).toBe(true);

    const priceRef = store.get('cached_prices_store:sv3pt5-1');
    const obs = store.get('cached_observations_store:sv3pt5-1');
    const verification = store.get('cached_price_verification:sv3pt5-1');

    expect(priceRef.cardId).toBe('sv3pt5-1');
    expect(obs.length).toBeGreaterThan(0);
    expect(verification.requiresVerification).toBe(true);
    expect(verification.verificationProvider).toContain('tickermint');
  });
});
