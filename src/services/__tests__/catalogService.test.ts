import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/types';

const cachedCardsKey = 'cached_cards_store';
let localStore: Map<string, unknown>;
let writes: Array<{ key: string; value: unknown }>;

function legacyCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'fut2020-1',
    name: 'Pikachu on the Ball',
    category: 'pokemon',
    rarity: 'other',
    setCode: 'fut2020',
    setNumber: '1',
    ...overrides,
  };
}

async function loadCatalogService() {
  vi.doMock('../storage', () => ({
    storage: {
      get: async (key: string) => localStore.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        localStore.set(key, value);
        writes.push({ key, value });
      },
      remove: async (key: string) => { localStore.delete(key); },
    },
  }));
  vi.doMock('../catalog/catalogRegistry', () => ({
    catalogRegistry: {
      getProvider: () => ({
        searchCards: async () => [],
        getCardById: async () => null,
      }),
    },
  }));

  return import('../catalogService');
}

describe('catalog image cache normalization', () => {
  beforeEach(() => {
    vi.resetModules();
    localStore = new Map();
    writes = [];
  });

  it('repairs legacy nested image URLs and persists the corrected cache record', async () => {
    const card = legacyCard() as Card & { images: { low: string; high: string } };
    card.images = {
      low: 'https://assets.tcgdex.net/en/swsh/fut2020/1/low.webp',
      high: 'https://assets.tcgdex.net/en/swsh/fut2020/1/high.webp',
    };
    localStore.set(cachedCardsKey, [card]);

    const { catalogService } = await loadCatalogService();
    const cards = await catalogService.getAll();

    expect(cards[0]).toMatchObject({
      imageUrlLow: card.images.low,
      imageUrlHigh: card.images.high,
    });
    expect(writes).toEqual([{ key: cachedCardsKey, value: cards }]);
  });

  it('preserves valid canonical image URLs without replacing them from legacy fields', async () => {
    const card = legacyCard({
      imageUrlLow: 'https://canonical.example/low.webp',
      imageUrlHigh: 'https://canonical.example/high.webp',
    }) as Card & { images: { low: string; high: string } };
    card.images = {
      low: 'https://legacy.example/low.webp',
      high: 'https://legacy.example/high.webp',
    };
    localStore.set(cachedCardsKey, [card]);

    const { catalogService } = await loadCatalogService();
    const cards = await catalogService.getAll();

    expect(cards[0]).toMatchObject({
      imageUrlLow: 'https://canonical.example/low.webp',
      imageUrlHigh: 'https://canonical.example/high.webp',
    });
    expect(writes).toEqual([]);
  });
});
