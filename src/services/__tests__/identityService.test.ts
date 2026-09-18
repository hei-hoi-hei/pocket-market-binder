import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityService } from '../identityService';
import type { Card } from '@/types';
import type { IdentityVerificationProvider, CardVerificationResult } from '../providers/identityProvider';

// Mock storage
const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('../storage', () => ({
  storage: {
    get: (key: string) => mockGet(key),
    set: (key: string, val: any) => mockSet(key, val),
  },
}));

// Mock Navigator
const originalOnline = globalThis.navigator?.onLine ?? true;
function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: online,
    configurable: true,
  });
}

class MockIdentityProvider implements IdentityVerificationProvider {
  constructor(public name: string, private mockResult: CardVerificationResult | null) {}

  async verifyIdentity(): Promise<CardVerificationResult> {
    if (this.mockResult) {
      return this.mockResult;
    }
    throw new Error('Identity verification failed');
  }
}

describe('IdentityService', () => {
  let identityService: IdentityService;

  beforeEach(() => {
    vi.resetAllMocks();
    setOnline(true);
    identityService = new IdentityService();
  });

  const baseCard: Card = {
    id: 'sv3pt5-1',
    name: 'Bulbasaur',
    category: 'pokemon',
    rarity: 'common',
    setCode: 'sv3pt5',
    setName: '151',
    setNumber: '1',
    imageUrlLow: 'https://images.tcgdex.net/en/sv/sv3pt5/1/low.webp',
    imageUrlHigh: 'https://images.tcgdex.net/en/sv/sv3pt5/1/high.webp',
    attacks: [{ name: 'Leech Seed' }],
    identity: {
      tcgdexId: 'sv3pt5-1',
      name: 'Bulbasaur',
      cardNumber: '1',
    },
  };

  it('determines if secondary verification is warranted', () => {
    // If complete, should not require secondary verification
    expect(identityService.shouldVerifySecondary(baseCard)).toBe(false);

    // If missing image and attacks (e.g. basic search result), should verify
    const incompleteCard: Card = {
      ...baseCard,
      imageUrlHigh: undefined,
      attacks: undefined,
    };
    expect(identityService.shouldVerifySecondary(incompleteCard)).toBe(true);

    // If identity is completely missing
    const noIdentityCard: Card = { ...baseCard, identity: undefined };
    expect(identityService.shouldVerifySecondary(noIdentityCard)).toBe(true);
  });

  it('verifies identity using registered providers and caches results', async () => {
    const cardToVerify: Card = {
      ...baseCard,
      imageUrlHigh: undefined,
      attacks: undefined,
    };

    const mockResult: CardVerificationResult = {
      provider: 'mock-provider',
      canonicalCardId: 'sv3pt5-1',
      matchedProviderId: 'tcg-12345',
      confidence: 'high',
      evidence: {
        nameMatch: true,
        collectorNumberMatch: true,
      },
      observedAt: Date.now(),
    };

    const provider = new MockIdentityProvider('mock-provider', mockResult);
    identityService.registerProvider(provider);

    mockGet.mockResolvedValue(null); // No cache hit

    const results = await identityService.verifyCard(cardToVerify);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(mockResult);
    expect(mockSet).toHaveBeenCalledWith('identity_verification:sv3pt5-1', [mockResult]);
  });

  it('uses cached results if available', async () => {
    const cardToVerify: Card = {
      ...baseCard,
      imageUrlHigh: undefined,
      attacks: undefined,
    };

    const mockResult: CardVerificationResult = {
      provider: 'mock-provider',
      canonicalCardId: 'sv3pt5-1',
      matchedProviderId: 'tcg-12345',
      confidence: 'high',
      evidence: {
        nameMatch: true,
      },
      observedAt: Date.now(),
    };

    mockGet.mockResolvedValue([mockResult]); // Cache hit

    const provider = new MockIdentityProvider('mock-provider', null);
    identityService.registerProvider(provider);

    const results = await identityService.verifyCard(cardToVerify);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(mockResult);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not verify if offline', async () => {
    setOnline(false);
    mockGet.mockResolvedValue(null);

    const provider = new MockIdentityProvider('mock-provider', null);
    identityService.registerProvider(provider);

    const cardToVerify: Card = {
      ...baseCard,
      imageUrlHigh: undefined,
      attacks: undefined,
    };

    const results = await identityService.verifyCard(cardToVerify);
    expect(results).toHaveLength(0);
  });

  it('merges verification results into canonical identity', () => {
    const originalIdentity = baseCard.identity!;
    const mockResult: CardVerificationResult = {
      provider: 'TCGPlayer',
      matchedProviderId: 'tcg-12345',
      evidence: { nameMatch: true },
      observedAt: Date.now(),
    };

    const updated = identityService.applyVerification(originalIdentity, [mockResult]);
    expect(updated.providerIds?.tcgplayer).toContain('tcg-12345');
  });

  it('handles conflicting secondary results gracefully', () => {
    const originalIdentity = baseCard.identity!;
    const result1: CardVerificationResult = {
      provider: 'TCGPlayer',
      matchedProviderId: 'tcg-12345',
      confidence: 'high',
      evidence: { nameMatch: true },
      observedAt: Date.now(),
    };
    const result2: CardVerificationResult = {
      provider: 'TCGPlayer',
      matchedProviderId: 'tcg-54321',
      confidence: 'low',
      evidence: { nameMatch: false },
      observedAt: Date.now(),
    };

    const updated = identityService.applyVerification(originalIdentity, [result1, result2]);
    expect(updated.providerIds?.tcgplayer).toContain('tcg-12345');
    expect(updated.providerIds?.tcgplayer).toContain('tcg-54321');
  });
});
