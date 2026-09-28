import { describe, expect, it } from 'vitest';
import type { Card } from '@/types';
import {
  artworkProviders,
  artworkResolutionState,
  artworkService,
  isArtworkUrlFailed,
  ProviderArtworkResolver,
  type ArtworkProvider,
} from '../artworkService';

const card: Card = {
  id: 'base1-1',
  name: 'Alakazam',
  category: 'pokemon',
  rarity: 'rare',
  setCode: 'base1',
  setNumber: '1',
  identity: {
    tcgdexId: 'base1-1',
    setId: 'base1',
    cardNumber: '1',
  },
};

describe('artwork resolution', () => {
  it('returns TCGdex primary artwork with source and resolution provenance', async () => {
    const result = await artworkService.resolve({
      ...card,
      imageUrlLow: 'https://assets.tcgdex.net/en/base/base1/1/low.webp',
      imageUrlHigh: 'https://assets.tcgdex.net/en/base/base1/1/high.webp',
    }, 'high');

    expect(result).toMatchObject({
      status: 'available',
      imageUrl: 'https://assets.tcgdex.net/en/base/base1/1/high.webp',
      source: 'tcgdex',
      role: 'primary',
      verification: {
        status: 'exact',
        evidence: expect.stringContaining('base1-1'),
      },
      usageEligibility: { status: 'unresolved' },
      attempts: [{ source: 'tcgdex', status: 'available' }],
    });
    expect(result.status === 'available' && result.resolvedAt).toEqual(expect.any(Number));
    expect(result.status === 'available' && result.candidate.unresolvedUsageAllowed).toBe(true);
  });

  it('preserves resolver states for the UI state attribute', () => {
    expect(artworkResolutionState(null)).toBe('loading');
    expect(artworkResolutionState({
      status: 'unavailable',
      reason: 'No artwork.',
      candidates: [],
      attempts: [],
    })).toBe('unavailable');
    expect(artworkResolutionState({
      status: 'error',
      message: 'Provider failed.',
      candidates: [],
      attempts: [],
    })).toBe('error');
    expect(artworkResolutionState({
      status: 'available',
      imageUrl: 'https://images.example/card.webp',
      source: 'test',
      resolvedAt: 1,
      role: 'primary',
      candidate: {
        imageUrl: 'https://images.example/card.webp',
        source: 'test',
        requestedIdentity: { tcgdexId: card.id },
        resolvedAt: 1,
        role: 'primary',
        verification: { status: 'exact', evidence: 'Set and number match.' },
        usageEligibility: { status: 'eligible', evidence: 'Usage basis recorded.' },
        unresolvedUsageAllowed: false,
      },
      verification: { status: 'exact', evidence: 'Set and number match.' },
      usageEligibility: { status: 'eligible', evidence: 'Usage basis recorded.' },
      candidates: [],
      attempts: [],
    })).toBe('available');
  });

  it('tries the lower-resolution TCGdex image after the preferred URL fails', async () => {
    const high = 'https://assets.tcgdex.net/en/base/base1/1/high.webp';
    const low = 'https://assets.tcgdex.net/en/base/base1/1/low.webp';
    const cardWithBoth = { ...card, imageUrlHigh: high, imageUrlLow: low };

    await expect(artworkService.resolve(cardWithBoth, 'high')).resolves.toMatchObject({
      status: 'available',
      imageUrl: high,
      role: 'primary',
    });
    await expect(artworkService.resolve(cardWithBoth, 'high', [high])).resolves.toMatchObject({
      status: 'available',
      imageUrl: low,
      source: 'tcgdex',
      role: 'primary',
    });
  });

  it('skips malformed preferred artwork when the alternate quality URL is valid', async () => {
    const low = 'https://assets.tcgdex.net/en/base/base1/1/low.webp';

    await expect(artworkService.resolve({
      ...card,
      imageUrlHigh: 'javascript:alert(1)',
      imageUrlLow: low,
    }, 'high')).resolves.toMatchObject({
      status: 'available',
      imageUrl: low,
      source: 'tcgdex',
      role: 'primary',
    });
  });

  it('returns an explicit unavailable result when TCGdex has no image URL', async () => {
    await expect(artworkService.resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('TCGdex has no artwork URL'),
      attempts: [{ source: 'tcgdex', status: 'unavailable' }],
    });
  });

  it('returns an explicit error for malformed primary artwork URLs', async () => {
    await expect(artworkService.resolve({
      ...card,
      imageUrlHigh: 'javascript:alert(1)',
    }, 'high')).resolves.toMatchObject({
      status: 'error',
      message: expect.stringContaining('tcgdex: TCGdex returned malformed'),
      attempts: [{ source: 'tcgdex', status: 'error' }],
    });
  });

  it('distinguishes known placeholder URLs from actual artwork', async () => {
    await expect(artworkService.resolve({
      ...card,
      imageUrlLow: 'https://assets.tcgdex.net/en/base/base1/placeholder.webp',
    }, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('known placeholder'),
    });
  });

  it('preserves canonical identity while trying a future fallback provider', async () => {
    const primary: ArtworkProvider = {
      source: 'tcgdex',
      resolve: async () => ({ status: 'unavailable', reason: 'No image URL.' }),
    };
    let fallbackCalls = 0;
    const fallback: ArtworkProvider = {
      source: 'approved-secondary',
      resolve: async ({ identity }) => {
        fallbackCalls += 1;
        expect(identity.tcgdexId).toBe(card.id);
        return {
          status: 'available',
          imageUrl: 'https://images.example/card.webp',
          verification: { status: 'exact', evidence: 'Exact set ID and local card number match.' },
          usageEligibility: { status: 'eligible', evidence: 'Provider usage terms reviewed.' },
          sourceCardId: 'source-card-1',
        };
      },
    };
    const resolver = new ProviderArtworkResolver([primary, fallback]);
    const originalCard = structuredClone(card);

    const result = await resolver.resolve(card, 'high');

    expect(result).toMatchObject({
      status: 'available',
      imageUrl: 'https://images.example/card.webp',
      source: 'approved-secondary',
      role: 'fallback',
      verification: { status: 'exact', evidence: 'Exact set ID and local card number match.' },
      usageEligibility: { status: 'eligible', evidence: 'Provider usage terms reviewed.' },
      attempts: [
        { source: 'tcgdex', status: 'unavailable' },
        { source: 'approved-secondary', status: 'available' },
      ],
    });
    expect(card).toEqual(originalCard);
    expect(fallbackCalls).toBe(1);
  });

  it('isolates nested provider IDs from provider mutation and candidate provenance', async () => {
    const cardWithProviderIds: Card = {
      ...card,
      identity: {
        ...card.identity!,
        providerIds: { example: ['original-id'] },
      },
    };
    let receivedProviderIds: string[] | undefined;
    const mutatingProvider: ArtworkProvider = {
      source: 'mutating-source',
      resolve: async ({ identity }) => {
        receivedProviderIds = identity.providerIds?.example;
        identity.providerIds?.example?.push('provider-mutation');
        return {
          status: 'available',
          imageUrl: 'https://images.example/isolated.webp',
          verification: { status: 'exact', evidence: 'Exact set and number match.' },
          usageEligibility: { status: 'eligible', evidence: 'Usage basis recorded.' },
        };
      },
    };

    const result = await new ProviderArtworkResolver([mutatingProvider]).resolve(cardWithProviderIds, 'low');

    expect(cardWithProviderIds.identity?.providerIds?.example).toEqual(['original-id']);
    expect(receivedProviderIds).toEqual(['original-id', 'provider-mutation']);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.candidate.requestedIdentity.providerIds?.example).toEqual(['original-id']);
      receivedProviderIds?.push('later-provider-mutation');
      expect(result.candidate.requestedIdentity.providerIds?.example).toEqual(['original-id']);
    }
  });

  it('registers only TCGdex in the default production provider list', () => {
    expect(artworkProviders.map((provider) => provider.source)).toEqual(['tcgdex']);
  });

  it('continues through unavailable and failed providers and chooses an exact candidate', async () => {
    const unavailable: ArtworkProvider = {
      source: 'unavailable-source',
      resolve: async () => ({ status: 'unavailable', reason: 'No artwork.' }),
    };
    const candidate: ArtworkProvider = {
      source: 'candidate-source',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/card.webp',
        sourceCardId: 'source-456',
        verification: { status: 'exact', evidence: 'Set and card number both match.' },
        usageEligibility: { status: 'eligible', evidence: 'Display permission documented.' },
        quality: { width: 800, height: 1120, urlStability: 'verified-stable' },
      }),
    };
    const failed: ArtworkProvider = {
      source: 'failed-source',
      resolve: async () => { throw new Error('Provider offline.'); },
    };

    const result = await new ProviderArtworkResolver([unavailable, candidate, failed]).resolve(card, 'high');

    expect(result).toMatchObject({
      status: 'available',
      source: 'candidate-source',
      imageUrl: 'https://images.example/card.webp',
      usageEligibility: { status: 'eligible' },
      attempts: [
        { source: 'unavailable-source', status: 'unavailable' },
        { source: 'candidate-source', status: 'available' },
        { source: 'failed-source', status: 'error' },
      ],
    });
    expect(result.status === 'available' && result.candidates[0]).toMatchObject({
      sourceCardId: 'source-456',
      requestedIdentity: { tcgdexId: card.id },
      quality: { width: 800, height: 1120, urlStability: 'verified-stable' },
    });
  });

  it('reports malformed provider data without blocking a valid provider', async () => {
    const malformed: ArtworkProvider = {
      source: 'malformed-source',
      resolve: async () => ({ status: 'available', imageUrl: 'javascript:alert(1)' }),
    };
    const valid: ArtworkProvider = {
      source: 'valid-source',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/valid.webp',
        verification: { status: 'exact', evidence: 'Exact printing metadata matched.' },
        usageEligibility: { status: 'eligible', evidence: 'Usage basis recorded.' },
      }),
    };

    await expect(new ProviderArtworkResolver([malformed, valid]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'available',
      source: 'valid-source',
      usageEligibility: { status: 'eligible' },
      attempts: [
        { source: 'malformed-source', status: 'malformed' },
        { source: 'valid-source', status: 'available' },
      ],
    });
  });

  it('does not promote unresolved printing verification to an exact match', async () => {
    const unresolved: ArtworkProvider = {
      source: 'unverified-source',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/unverified.webp',
        verification: { status: 'unresolved', evidence: 'Source printing metadata unavailable.' },
      }),
    };

    await expect(new ProviderArtworkResolver([unresolved]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      reason: expect.stringContaining('none passed exact-printing'),
      candidates: [{
        verification: { status: 'unresolved' },
        usageEligibility: { status: 'unresolved' },
      }],
    });
  });

  it('normalizes an unsupported exact claim without evidence to unresolved', async () => {
    const unsupportedClaim: ArtworkProvider = {
      source: 'unsupported-claim',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/claimed.webp',
        verification: { status: 'exact' },
      }),
    };

    await expect(new ProviderArtworkResolver([unsupportedClaim]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      candidates: [{ verification: { status: 'unresolved' } }],
    });
  });

  it('does not treat an unsupported eligible usage claim as verified eligibility', async () => {
    const unsupportedUsageClaim: ArtworkProvider = {
      source: 'unsupported-usage-claim',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/usage-claim.webp',
        verification: { status: 'exact', evidence: 'Exact printing metadata matched.' },
        usageEligibility: { status: 'eligible' },
      }),
    };

    await expect(new ProviderArtworkResolver([unsupportedUsageClaim]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      candidates: [{
        usageEligibility: { status: 'unresolved' },
        unresolvedUsageAllowed: false,
      }],
    });
  });

  it('keeps TCGdex unresolved-usage display behind explicit provider compatibility', async () => {
    const tcgdexCard: Card = {
      ...card,
      imageUrlLow: 'https://assets.tcgdex.net/en/base/base1/1/low.webp',
    };

    await expect(artworkService.resolve(tcgdexCard, 'low')).resolves.toMatchObject({
      status: 'available',
      source: 'tcgdex',
      usageEligibility: { status: 'unresolved' },
      candidate: { unresolvedUsageAllowed: true },
    });
  });

  it('does not select a candidate explicitly marked ineligible', async () => {
    const ineligible: ArtworkProvider = {
      source: 'ineligible-source',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/ineligible.webp',
        verification: { status: 'exact', evidence: 'Exact set and number match.' },
        usageEligibility: { status: 'ineligible', evidence: 'Source terms prohibit this use.' },
      }),
    };

    await expect(new ProviderArtworkResolver([ineligible]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      candidates: [{ usageEligibility: { status: 'ineligible' } }],
    });
  });

  it('selects deterministically by eligibility and observable quality, not provider order', async () => {
    const makeProvider = (
      source: string,
      usageStatus: 'eligible' | 'unresolved',
      width: number,
      imageUrl: string,
    ): ArtworkProvider => ({
      source,
      resolve: async () => ({
        status: 'available',
        imageUrl,
        verification: { status: 'exact', evidence: 'Exact printing matched by set and number.' },
        usageEligibility: { status: usageStatus, evidence: usageStatus === 'eligible' ? 'Use reviewed.' : undefined },
        quality: { width, height: 1000 },
      }),
    });
    const lowerQuality = makeProvider('source-a', 'eligible', 400, 'https://images.example/a.webp');
    const higherQuality = makeProvider('source-b', 'eligible', 800, 'https://images.example/b.webp');
    const unresolvedUsage = makeProvider('source-c', 'unresolved', 1200, 'https://images.example/c.webp');

    const first = await new ProviderArtworkResolver([lowerQuality, higherQuality, unresolvedUsage]).resolve(card, 'high');
    const second = await new ProviderArtworkResolver([unresolvedUsage, higherQuality, lowerQuality]).resolve(card, 'high');

    expect(first).toMatchObject({ status: 'available', source: 'source-b' });
    expect(second).toMatchObject({ status: 'available', source: 'source-b' });
  });

  it('falls through malformed provider output and reports errors if no artwork resolves', async () => {
    const provider: ArtworkProvider = {
      source: 'broken-provider',
      resolve: async () => ({ status: 'available', imageUrl: 'not-a-url' }),
    };

    await expect(new ProviderArtworkResolver([provider]).resolve(card, 'low')).resolves.toMatchObject({
      status: 'error',
      message: expect.stringContaining('invalid or unusable candidate'),
      attempts: [{ source: 'broken-provider', status: 'malformed' }],
    });
  });

  it('does not reuse an image error for a different card image URL', () => {
    const failedUrl = 'https://assets.tcgdex.net/en/base/base1/1/high.webp';
    expect(isArtworkUrlFailed(failedUrl, failedUrl)).toBe(true);
    expect(isArtworkUrlFailed(failedUrl, 'https://images.example/other-card.webp')).toBe(false);
    expect(isArtworkUrlFailed(failedUrl, null)).toBe(false);
  });
});
