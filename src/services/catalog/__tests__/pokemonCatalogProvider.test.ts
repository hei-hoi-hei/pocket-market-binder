import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/types';

vi.mock('../../providers/tcgdexProvider', () => ({
  tcgdexProvider: {
    searchCards: vi.fn(),
    getCardById: vi.fn(),
  },
  mapTCGdexToCard: vi.fn(),
}));

import { tcgdexProvider } from '../../providers/tcgdexProvider';
import { PokemonCatalogProvider } from '../providers/pokemonCatalogProvider';

const sourceCard: Card = {
  id: 'fut2020-1',
  name: 'Pikachu on the Ball',
  category: 'pokemon',
  rarity: 'other',
  setCode: 'fut2020',
  setNumber: '1',
  imageUrlLow: 'https://assets.tcgdex.net/en/swsh/fut2020/1/low.webp',
  imageUrlHigh: 'https://assets.tcgdex.net/en/swsh/fut2020/1/high.webp',
};

describe('PokemonCatalogProvider image mapping', () => {
  it('preserves canonical image fields alongside the CatalogCard images contract', async () => {
    vi.mocked(tcgdexProvider.searchCards).mockResolvedValue([sourceCard]);

    const cards = await new PokemonCatalogProvider().searchCards('Pikachu');

    expect(cards[0]).toMatchObject({
      setCode: sourceCard.setCode,
      imageUrlLow: sourceCard.imageUrlLow,
      imageUrlHigh: sourceCard.imageUrlHigh,
      images: {
        low: sourceCard.imageUrlLow,
        high: sourceCard.imageUrlHigh,
      },
    });
  });
});
