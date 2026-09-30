import { describe, expect, it } from 'vitest';
import type { Card } from '@/types';
import {
  artworkProviders,
  artworkResolutionState,
  artworkService,
  isArtworkUrlFailed,
  ProviderArtworkResolver,
  type ArtworkProvider,
  type ArtworkProviderRegistration,
} from '../artworkService';

const card: Card = {
  id: 'base1-1',
  name: 'Alakazam',
  category: 'pokemon',
  rarity: 'rare',
  setCode: 'base1',
  setNumber: '1',
  identity: {
    providerIds: { tcgdex: ['base1-1'] },
    setId: 'base1',
    cardNumber: '1',
  },
};

function register(
  provider: ArtworkProvider,
  role: ArtworkProviderRegistration['role'],
  priority: number,
): ArtworkProviderRegistration {
  return { provider, role, priority };
}

function registerInOrder(providers: ArtworkProvider[]): ArtworkProviderRegistration[] {
  return providers.map((provider, index) => register(
    provider,
    index === 0 ? 'primary' : 'fallback',
    index,
  ));
}

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
        evidence: expect.stringContaining('Legacy untagged image URL'),
      },
      usageEligibility: { status: 'unresolved' },
      candidate: { resolution: 'high', sourceCardId: 'base1-1' },
      attempts: [{ source: 'tcgdex', status: 'available' }],
    });
    expect(result.status === 'available' && result.resolvedAt).toEqual(expect.any(Number));
    expect(result.status === 'available' && result.candidate.unresolvedUsageAllowed).toBe(true);
  });

  it('does not call secondary artwork when TCGdex returns usable artwork', async () => {
    let secondaryCalls = 0;
    const secondary: ArtworkProvider = {
      source: 'secondary',
      resolve: async () => {
        secondaryCalls += 1;
        return { status: 'unavailable', reason: 'Must not run.' };
      },
    };
    const resolver = new ProviderArtworkResolver([
      ...artworkProviders,
      register(secondary, 'fallback', 1),
    ]);
    const result = await resolver.resolve({
      ...card,
      imageUrlHigh: 'https://assets.tcgdex.net/en/base/base1/1/high.webp',
    }, 'high');

    expect(result).toMatchObject({ status: 'available', source: 'tcgdex', role: 'primary' });
    expect(secondaryCalls).toBe(0);
    expect(result.status === 'available' && result.attempts).toHaveLength(1);
  });

  it('tries a secondary provider after primary artwork is unavailable or malformed', async () => {
    const secondary: ArtworkProvider = {
      source: 'secondary',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/secondary.webp',
        verification: { status: 'exact', evidence: 'Exact set and number match.' },
        usageEligibility: { status: 'eligible', evidence: 'Display use reviewed.' },
      }),
    };
    const resolver = new ProviderArtworkResolver([
      ...artworkProviders,
      register(secondary, 'fallback', 1),
    ]);

    await expect(resolver.resolve(card, 'high')).resolves.toMatchObject({
      status: 'available',
      source: 'secondary',
      attempts: [
        { source: 'tcgdex', status: 'unavailable' },
        { source: 'secondary', status: 'available' },
      ],
    });
    await expect(resolver.resolve({
      ...card,
      imageUrlHigh: 'javascript:alert(1)',
    }, 'high')).resolves.toMatchObject({
      status: 'available',
      source: 'secondary',
      attempts: [
        { source: 'tcgdex', status: 'error' },
        { source: 'secondary', status: 'available' },
      ],
    });
  });

  it('isolates primary provider exceptions and continues to the secondary provider', async () => {
    const failingPrimary: ArtworkProvider = {
      source: 'primary',
      resolve: async () => { throw new Error('Primary service is offline.'); },
    };
    const fallback: ArtworkProvider = {
      source: 'secondary',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/secondary.webp',
        verification: { status: 'exact', evidence: 'Exact set and number match.' },
        usageEligibility: { status: 'eligible', evidence: 'Display use reviewed.' },
      }),
    };

    await expect(new ProviderArtworkResolver([
      register(failingPrimary, 'primary', 0),
      register(fallback, 'fallback', 1),
    ]).resolve(card, 'high')).resolves.toMatchObject({
      status: 'available',
      source: 'secondary',
      attempts: [
        { source: 'primary', status: 'error', message: 'Primary service is offline.' },
        { source: 'secondary', status: 'available' },
      ],
    });
  });

  it('tries a secondary provider after TCGdex artwork is explicitly excluded following image-load failure', async () => {
    const failedPrimaryUrl = 'https://assets.tcgdex.net/en/base/base1/1/high.webp';
    const secondary: ArtworkProvider = {
      source: 'secondary',
      resolve: async ({ excludedImageUrls }) => {
        expect(excludedImageUrls).toContain(failedPrimaryUrl);
        return {
          status: 'available',
          imageUrl: 'https://images.example/secondary.webp',
          verification: { status: 'exact', evidence: 'Exact set and number match.' },
          usageEligibility: { status: 'eligible', evidence: 'Display use reviewed.' },
        };
      },
    };
    const resolver = new ProviderArtworkResolver([
      ...artworkProviders,
      register(secondary, 'fallback', 1),
    ]);
    const cardWithImage = { ...card, imageUrlHigh: failedPrimaryUrl };
    const first = await resolver.resolve(cardWithImage, 'high');
    expect(first).toMatchObject({ status: 'available', imageUrl: failedPrimaryUrl, source: 'tcgdex' });

    const retried = await resolver.resolve(cardWithImage, 'high', [failedPrimaryUrl]);

    expect(retried).toMatchObject({
      status: 'available',
      imageUrl: 'https://images.example/secondary.webp',
      source: 'secondary',
      attempts: [
        { source: 'tcgdex', status: 'excluded' },
        { source: 'secondary', status: 'available' },
      ],
    });
  });

  it('rejects candidates that do not verify the requested printing before trying the next provider', async () => {
    const wrongPrinting: ArtworkProvider = {
      source: 'wrong-printing',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/wrong-printing.webp',
        verification: { status: 'rejected', evidence: 'A different printing was identified.' },
        usageEligibility: { status: 'eligible', evidence: 'Usage reviewed.' },
      }),
    };
    const wrongSetAndNumber: ArtworkProvider = {
      source: 'wrong-set-number',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/wrong-set-number.webp',
        verification: { status: 'partial', evidence: 'Set and local number do not match.' },
        usageEligibility: { status: 'eligible', evidence: 'Usage reviewed.' },
      }),
    };
    const exact: ArtworkProvider = {
      source: 'exact-printing',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/exact.webp',
        verification: { status: 'exact', evidence: 'Exact set and local number match.' },
        usageEligibility: { status: 'eligible', evidence: 'Usage reviewed.' },
      }),
    };

    const result = await new ProviderArtworkResolver([
      register(wrongSetAndNumber, 'primary', 0),
      register(exact, 'fallback', 3),
      register(wrongPrinting, 'fallback', 1),
    ]).resolve(card, 'high');

    expect(result).toMatchObject({
      status: 'available',
      source: 'exact-printing',
      attempts: [
        { source: 'wrong-set-number', status: 'available' },
        { source: 'wrong-printing', status: 'available' },
        { source: 'exact-printing', status: 'available' },
      ],
    });
    expect(result.status === 'available' && result.candidates.map(({ verification }) => verification.status))
      .toEqual(['partial', 'rejected', 'exact']);
  });

  it('rejects a known placeholder and proceeds to the next provider', async () => {
    const fallback: ArtworkProvider = {
      source: 'secondary',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/real-artwork.webp',
        verification: { status: 'exact', evidence: 'Exact printing matched.' },
        usageEligibility: { status: 'eligible', evidence: 'Display use reviewed.' },
      }),
    };

    await expect(new ProviderArtworkResolver([
      ...artworkProviders,
      register(fallback, 'fallback', 1),
    ]).resolve({
      ...card,
      imageUrlLow: 'https://assets.tcgdex.net/en/base/base1/placeholder.webp',
    }, 'low')).resolves.toMatchObject({
      status: 'available',
      source: 'secondary',
      attempts: [
        { source: 'tcgdex', status: 'unavailable', message: expect.stringContaining('placeholder') },
        { source: 'secondary', status: 'available' },
      ],
    });
  });

  it('tries secondary providers in explicit priority order, independent of registration order', async () => {
    const calls: string[] = [];
    const makeProvider = (source: string, status: 'unavailable' | 'available'): ArtworkProvider => ({
      source,
      resolve: async () => {
        calls.push(source);
        return status === 'unavailable'
          ? { status, reason: 'No exact artwork.' }
          : {
              status,
              imageUrl: `https://images.example/${source}.webp`,
              verification: { status: 'exact', evidence: 'Exact printing matched.' },
              usageEligibility: { status: 'eligible', evidence: 'Display use reviewed.' },
            };
      },
    });
    const primary = makeProvider('primary', 'unavailable');
    const firstFallback = makeProvider('fallback-a', 'unavailable');
    const selectedFallback = makeProvider('fallback-b', 'available');
    const lastFallback = makeProvider('fallback-c', 'available');
    const result = await new ProviderArtworkResolver([
      register(lastFallback, 'fallback', 3),
      register(selectedFallback, 'fallback', 2),
      register(primary, 'primary', 0),
      register(firstFallback, 'fallback', 1),
    ]).resolve(card, 'high');

    expect(result).toMatchObject({ status: 'available', source: 'fallback-b', role: 'fallback' });
    expect(calls).toEqual(['primary', 'fallback-a', 'fallback-b']);
    expect(result.status === 'available' && result.attempts.map(({ source }) => source))
      .toEqual(calls);
  });

  it('does not return generated UI fallback as a provider candidate or mutate catalog identity', async () => {
    const originalCard = structuredClone(card);
    const result = await new ProviderArtworkResolver([]).resolve(card, 'low');

    expect(result).toMatchObject({ status: 'unavailable', candidates: [], attempts: [] });
    expect(card).toEqual(originalCard);
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
        requestedIdentity: { providerIds: { tcgdex: [card.id] } },
        resolvedAt: 1,
        role: 'primary',
        sourceType: 'catalog-artwork',
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
      candidate: { resolution: 'low' },
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
        expect(identity.providerIds?.tcgdex).toContain(card.id);
        return {
          status: 'available',
          imageUrl: 'https://images.example/card.webp',
          verification: { status: 'exact', evidence: 'Exact set ID and local card number match.' },
          usageEligibility: { status: 'eligible', evidence: 'Provider usage terms reviewed.' },
          sourceCardId: 'source-card-1',
        };
      },
    };
    const resolver = new ProviderArtworkResolver([
      register(primary, 'primary', 0),
      register(fallback, 'fallback', 1),
    ]);
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

  it('resolves a provider-specific artwork ID without requiring a TCGdex identity', async () => {
    const sourceSpecificId = 'jp-set-042';
    let receivedIdentity: unknown;
    const provider: ArtworkProvider = {
      source: 'japanese-artwork-source',
      resolve: async ({ identity }) => {
        receivedIdentity = identity;
        return {
          status: 'available',
          imageUrl: 'https://images.example/jp-set-042.webp',
          sourceCardId: sourceSpecificId,
          sourceUrl: 'https://images.example/jp-set-042-original.webp',
          cachedImageUrl: 'https://cache.example/art/jp-set-042.webp',
          language: 'ja',
          variant: 'alternate-art',
          retrievedAt: 1_800_000_000_000,
          confidence: 0.94,
          provenance: {
            attribution: 'Source image attribution.',
          },
          verification: { status: 'exact', evidence: 'Set and collector number match.' },
          usageEligibility: { status: 'eligible', evidence: 'Reuse terms reviewed.' },
          quality: { width: 1200, height: 1680, urlStability: 'verified-stable' },
        };
      },
    };
    const identity = {
      setId: 'jp-set',
      cardNumber: '042',
      name: 'Alakazam',
      language: 'ja',
      providerIds: { japaneseArt: [sourceSpecificId] },
    };
    const identityOnlyCard: Card = { ...card, identity };
    const result = await new ProviderArtworkResolver([
      register(provider, 'primary', 0),
    ]).resolve(identityOnlyCard, 'high');

    expect(receivedIdentity).not.toHaveProperty('tcgdexId');
    expect(result).toMatchObject({
      status: 'available',
      source: 'japanese-artwork-source',
      candidate: {
        sourceCardId: sourceSpecificId,
        sourceType: 'catalog-artwork',
        sourceUrl: 'https://images.example/jp-set-042-original.webp',
        cachedImageUrl: 'https://cache.example/art/jp-set-042.webp',
        language: 'ja',
        variant: 'alternate-art',
        retrievedAt: 1_800_000_000_000,
        confidence: 0.94,
        provenance: {
          attribution: 'Source image attribution.',
        },
        quality: { width: 1200, height: 1680, urlStability: 'verified-stable' },
      },
    });
  });

  it('merges usable Card identity fields into a partial canonical identity without inventing provider IDs', async () => {
      let receivedIdentity: unknown;
      const partialCard: Card = {
        ...card,
        name: 'Card name from catalog',
        setName: 'Base Set',
        rarity: 'rare',
        identity: { cardNumber: '1', providerIds: { example: ['source-1'] } },
        catalogArtwork: {
          provider: 'art-source',
          providerCardId: 'art-source-card',
          imageUrls: {},
        },
      };
      const inspector: ArtworkProvider = {
        source: 'identity-inspector',
        resolve: async ({ identity }) => {
          receivedIdentity = identity;
          return { status: 'unavailable', reason: 'Inspection only.' };
        },
      };

      await new ProviderArtworkResolver([register(inspector, 'primary', 0)]).resolve(partialCard, 'high');

      expect(receivedIdentity).toMatchObject({
        name: 'Card name from catalog',
        setId: 'base1',
        setName: 'Base Set',
        cardNumber: '1',
        rarity: 'rare',
        providerIds: { example: ['source-1'], 'art-source': ['art-source-card'] },
      });
      expect(receivedIdentity).not.toHaveProperty('providerIds.tcgdex');
    });

  it('preserves tagged artwork printing identity and rejects metadata for a different printing', async () => {
      const taggedCard: Card = {
        ...card,
        catalogArtwork: {
          provider: 'tcgdex',
          providerCardId: 'base1-1',
          printingIdentity: {
            setId: 'base1',
            cardNumber: '1',
            name: 'Alakazam',
            rarity: 'rare',
            providerIds: { tcgdex: ['base1-1'] },
          },
          imageUrls: { high: 'https://assets.tcgdex.net/en/base/base1/1/high.webp' },
        },
      };
      const taggedResult = await artworkService.resolve(taggedCard, 'high');
      expect(taggedResult).toMatchObject({
        status: 'available',
        candidate: {
          sourceCardId: 'base1-1',
          matchedIdentity: { setId: 'base1', cardNumber: '1', providerIds: { tcgdex: ['base1-1'] } },
        },
      });

      const wrongPrinting: ArtworkProvider = {
        source: 'wrong-printing',
        resolve: async () => ({
          status: 'available',
          imageUrl: 'https://images.example/wrong-printing.webp',
          matchedIdentity: {
            setId: 'base1',
            cardNumber: '99',
            name: 'Alakazam',
            variants: { normal: false },
            providerIds: { tcgdex: ['unrelated-tcgdex-record'] },
          },
          verification: { status: 'exact', evidence: 'Provider reported an exact printing.' },
          usageEligibility: { status: 'eligible', evidence: 'Usage reviewed.' },
        }),
      };
      const exactPrintingRequest: Card = {
        ...card,
        variants: { normal: true },
        identity: { ...card.identity!, variants: { normal: true } },
      };
      const rejected = await new ProviderArtworkResolver([
        register(wrongPrinting, 'primary', 0),
      ]).resolve(exactPrintingRequest, 'high');

      expect(rejected).toMatchObject({
        status: 'unavailable',
        candidates: [{
          matchedIdentity: { cardNumber: '99' },
          verification: { status: 'rejected', evidence: expect.stringContaining('variants.normal') },
        }],
      });
    });

  it('does not attribute untagged legacy images to unrelated artwork providers', async () => {
      let receivedInput: unknown;
      const nonCatalogProvider: ArtworkProvider = {
        source: 'secondary-artwork',
        resolve: async (input) => {
          receivedInput = input;
          return { status: 'unavailable', reason: 'No secondary image.' };
        },
      };

      await new ProviderArtworkResolver([
        register(nonCatalogProvider, 'primary', 0),
      ]).resolve({
        ...card,
        imageUrlHigh: 'https://images.example/legacy-high.webp',
      }, 'high');

      expect(receivedInput).toMatchObject({ catalogArtwork: undefined });
    });

  it('normalizes legacy TCGdex identity IDs into provider-namespaced metadata', async () => {
    const legacyIdentity = Object.assign({}, card.identity, {
      tcgdexId: card.id,
      imageUrl: 'https://assets.tcgdex.net/en/base/base1/1/high.webp',
    });
    const legacyCard: Card = { ...card, identity: legacyIdentity };
    let receivedIdentity: unknown;
    const provider: ArtworkProvider = {
      source: 'identity-inspector',
      resolve: async ({ identity }) => {
        receivedIdentity = identity;
        return { status: 'unavailable', reason: 'Inspection only.' };
      },
    };

    await new ProviderArtworkResolver([
      register(provider, 'primary', 0),
    ]).resolve(legacyCard, 'low');

    expect(receivedIdentity).not.toHaveProperty('tcgdexId');
    expect(receivedIdentity).not.toHaveProperty('imageUrl');
    expect(receivedIdentity).toMatchObject({ providerIds: { tcgdex: [card.id] } });
    expect(legacyCard.identity).toHaveProperty('tcgdexId', card.id);
  });

  it('keeps user-photo inputs outside provider artwork results', async () => {
    let capturedInput: unknown;
    const photoCandidate: ArtworkProvider = {
      source: 'invalid-photo-source',
      resolve: async (input) => {
        capturedInput = input;
        return {
          status: 'available',
          imageUrl: 'https://images.example/user-photo.webp',
          sourceType: 'user-photo',
          verification: { status: 'exact', evidence: 'Not a provider catalog record.' },
          usageEligibility: { status: 'eligible', evidence: 'User-uploaded.' },
        };
      },
    };
    const catalogCandidate: ArtworkProvider = {
      source: 'catalog-source',
      resolve: async () => ({
        status: 'available',
        imageUrl: 'https://images.example/catalog-art.webp',
        verification: { status: 'exact', evidence: 'Exact printing verified.' },
        usageEligibility: { status: 'eligible', evidence: 'Display permission reviewed.' },
      }),
    };
    const result = await new ProviderArtworkResolver([
      register(photoCandidate, 'primary', 0),
      register(catalogCandidate, 'fallback', 1),
    ]).resolve(card, 'low');

    expect(result).toMatchObject({
      status: 'available',
      source: 'catalog-source',
      attempts: [
        { source: 'invalid-photo-source', status: 'malformed' },
        { source: 'catalog-source', status: 'available' },
      ],
    });
    expect(capturedInput).not.toHaveProperty('photo');
    expect(capturedInput).not.toHaveProperty('image');
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

    const result = await new ProviderArtworkResolver([
      register(mutatingProvider, 'primary', 0),
    ]).resolve(cardWithProviderIds, 'low');

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
    expect(artworkProviders.map(({ provider, role, priority }) => ({
      source: provider.source,
      role,
      priority,
    }))).toEqual([{ source: 'tcgdex', role: 'primary', priority: 0 }]);
  });

  it('selects the first usable candidate and does not call lower-priority providers', async () => {
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
    let lowerPriorityCalls = 0;
    const lowerPriority: ArtworkProvider = {
      source: 'lower-priority-source',
      resolve: async () => {
        lowerPriorityCalls += 1;
        throw new Error('This provider must not be called.');
      },
    };
    const result = await new ProviderArtworkResolver([
      register(unavailable, 'primary', 0),
      register(candidate, 'fallback', 1),
      register(lowerPriority, 'fallback', 2),
    ]).resolve(card, 'high');

    expect(result).toMatchObject({
      status: 'available',
      source: 'candidate-source',
      imageUrl: 'https://images.example/card.webp',
      usageEligibility: { status: 'eligible' },
      attempts: [
        { source: 'unavailable-source', status: 'unavailable' },
        { source: 'candidate-source', status: 'available' },
      ],
    });
    expect(lowerPriorityCalls).toBe(0);
    expect(result.status === 'available' && result.candidates[0]).toMatchObject({
      sourceCardId: 'source-456',
      requestedIdentity: { providerIds: { tcgdex: [card.id] } },
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

    await expect(new ProviderArtworkResolver(registerInOrder([malformed, valid])).resolve(card, 'low')).resolves.toMatchObject({
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

    await expect(new ProviderArtworkResolver(registerInOrder([unresolved])).resolve(card, 'low')).resolves.toMatchObject({
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

    await expect(new ProviderArtworkResolver(registerInOrder([unsupportedClaim])).resolve(card, 'low')).resolves.toMatchObject({
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

    await expect(new ProviderArtworkResolver(registerInOrder([unsupportedUsageClaim])).resolve(card, 'low')).resolves.toMatchObject({
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

    await expect(new ProviderArtworkResolver(registerInOrder([ineligible])).resolve(card, 'low')).resolves.toMatchObject({
      status: 'unavailable',
      candidates: [{ usageEligibility: { status: 'ineligible' } }],
    });
  });

  it('uses explicit priority rather than quality or registration order', async () => {
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
    const primary = makeProvider('primary-source', 'eligible', 400, 'https://images.example/a.webp');
    const fallback = makeProvider('higher-quality-fallback', 'eligible', 1200, 'https://images.example/b.webp');
    const last = makeProvider('last-fallback', 'eligible', 1600, 'https://images.example/c.webp');
    const registrations = [
      register(last, 'fallback', 2),
      register(fallback, 'fallback', 1),
      register(primary, 'primary', 0),
    ];

    const result = await new ProviderArtworkResolver(registrations).resolve(card, 'high');

    expect(result).toMatchObject({
      status: 'available',
      source: 'primary-source',
      role: 'primary',
      candidate: { quality: { width: 400 } },
    });
    expect(result.status === 'available' ? result.attempts.map(({ source }) => source) : []).toEqual(['primary-source']);
  });

  it('falls through malformed provider output and reports errors if no artwork resolves', async () => {
    const provider: ArtworkProvider = {
      source: 'broken-provider',
      resolve: async () => ({ status: 'available', imageUrl: 'not-a-url' }),
    };

    await expect(new ProviderArtworkResolver(registerInOrder([provider])).resolve(card, 'low')).resolves.toMatchObject({
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
