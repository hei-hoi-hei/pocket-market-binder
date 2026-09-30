// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/types';
import { artworkService } from '@/services/artworkService';
import type { ArtworkResolution } from '@/services/artworkService';
import { CardArtwork } from '../CardArtwork';

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

function availableArtwork(imageUrl: string, source: string, role: 'primary' | 'fallback'): ArtworkResolution {
  const verification = { status: 'exact' as const, evidence: 'Exact printing verified.' };
  const usageEligibility = { status: 'eligible' as const, evidence: 'Display use reviewed.' };
  const candidate = {
    imageUrl,
    source,
    requestedIdentity: card.identity ?? { providerIds: { tcgdex: [card.id] } },
    resolvedAt: 1,
    role,
    sourceType: 'catalog-artwork' as const,
    verification,
    usageEligibility,
    unresolvedUsageAllowed: false,
  };
  return {
    status: 'available',
    imageUrl,
    source,
    resolvedAt: 1,
    role,
    candidate,
    verification,
    usageEligibility,
    candidates: [candidate],
    attempts: [{ source, status: 'available' }],
  };
}

describe('CardArtwork generated fallback', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders UI-generated fallback without changing card identity', async () => {
    const originalIdentity = structuredClone(card.identity);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(createElement(CardArtwork, { card })));
    await vi.waitFor(() => {
      expect(container?.querySelector('[data-artwork-kind="ui-placeholder"] svg')).not.toBeNull();
    });

    expect(container.querySelector('img')).toBeNull();
    expect(card.identity).toEqual(originalIdentity);
  });

  it('excludes an image-load failure and requests artwork resolution again', async () => {
    const primaryUrl = 'https://assets.tcgdex.net/en/base/base1/1/high.webp';
    const secondaryUrl = 'https://images.example/secondary.webp';
    const resolve = vi.spyOn(artworkService, 'resolve')
      .mockResolvedValueOnce(availableArtwork(primaryUrl, 'tcgdex', 'primary'))
      .mockResolvedValueOnce(availableArtwork(secondaryUrl, 'secondary', 'fallback'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(createElement(CardArtwork, { card, quality: 'high' })));
    await vi.waitFor(() => expect(container?.querySelector('img')?.getAttribute('src')).toBe(primaryUrl));

    await act(async () => {
      const image = container?.querySelector('img');
      if (!image) throw new Error('Primary artwork image was not rendered.');
      image.dispatchEvent(new Event('error'));
    });
    await vi.waitFor(() => expect(container?.querySelector('img')?.getAttribute('src')).toBe(secondaryUrl));

    expect(resolve).toHaveBeenNthCalledWith(1, card, 'high', []);
    expect(resolve).toHaveBeenNthCalledWith(2, card, 'high', [primaryUrl]);
  });

  it('re-resolves when canonical identity or catalog artwork reference changes', async () => {
    const identityUpdatedCard: Card = {
      ...card,
      identity: {
        ...card.identity,
        providerIds: { tcgdex: ['base1-1'], alternateCatalog: ['set-a-1'] },
        language: 'en',
      },
    };
    const artworkUpdatedCard: Card = {
      ...identityUpdatedCard,
      catalogArtwork: {
        provider: 'alternateCatalog',
        providerCardId: 'set-a-1',
        printingIdentity: identityUpdatedCard.identity,
        imageUrls: { high: 'https://images.example/set-a-1.webp' },
      },
    };
    const resolve = vi.spyOn(artworkService, 'resolve')
      .mockResolvedValue(availableArtwork('https://images.example/card.webp', 'catalog', 'primary'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root?.render(createElement(CardArtwork, { card })));
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));

    await act(async () => root?.render(createElement(CardArtwork, { card: identityUpdatedCard })));
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));

    await act(async () => root?.render(createElement(CardArtwork, { card: artworkUpdatedCard })));
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(3));

    expect(resolve).toHaveBeenNthCalledWith(2, identityUpdatedCard, 'low', []);
    expect(resolve).toHaveBeenNthCalledWith(3, artworkUpdatedCard, 'low', []);
  });
});
