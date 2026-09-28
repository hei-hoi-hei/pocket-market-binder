import { describe, expect, it } from 'vitest';
import type { Card } from '@/types';
import {
  sortCartLines,
  sortCollectionItems,
  sortWishlistCards,
  type CollectionSortMode,
  type SortableCollectionItem,
} from '../collectionSorting';

type ItemOverrides = Omit<Partial<SortableCollectionItem>, 'card'> & {
  card?: Partial<Pick<Card, 'name' | 'setCode' | 'setName' | 'setNumber'>>;
};

function item(
  id: string,
  name: string,
  properties: ItemOverrides = {},
): SortableCollectionItem & { id: string } {
  const card: Pick<Card, 'name' | 'setCode' | 'setName' | 'setNumber'> = {
    name,
    setCode: id,
    setName: id.toUpperCase(),
    setNumber: id,
  };
  return {
    ...properties,
    id,
    card: { ...card, ...properties.card },
  };
}

const items = [
  item('third', 'Cinderace', {
    card: { setCode: 'set-c', setName: 'Gamma', setNumber: '10' },
    addedAt: 30,
    marketPrice: 8,
    unitPrice: 8,
    quantity: 2,
    totalValue: 16,
  }),
  item('first', 'Bulbasaur', {
    card: { setCode: 'set-a', setName: 'Alpha', setNumber: '2' },
    addedAt: 10,
    marketPrice: 2,
    unitPrice: 2,
    quantity: 5,
    totalValue: 10,
  }),
  item('second', 'Abra', {
    card: { setCode: 'set-b', setName: 'Beta', setNumber: '1' },
    addedAt: 20,
    marketPrice: 5,
    unitPrice: 5,
    quantity: 1,
    totalValue: 5,
  }),
];

const ids = (mode: CollectionSortMode, source = items) =>
  sortCollectionItems(source, mode).map(({ id }) => id);

describe('sortCollectionItems', () => {
  it.each([
    ['recently-added', ['third', 'second', 'first']],
    ['name-asc', ['second', 'first', 'third']],
    ['name-desc', ['third', 'first', 'second']],
    ['set-asc', ['first', 'second', 'third']],
    ['set-desc', ['third', 'second', 'first']],
    ['collector-number', ['second', 'first', 'third']],
    ['price-asc', ['first', 'second', 'third']],
    ['price-desc', ['third', 'second', 'first']],
    ['unit-price-asc', ['first', 'second', 'third']],
    ['unit-price-desc', ['third', 'second', 'first']],
    ['quantity-asc', ['second', 'third', 'first']],
    ['quantity-desc', ['first', 'third', 'second']],
    ['total-value-asc', ['second', 'first', 'third']],
    ['total-value-desc', ['third', 'first', 'second']],
  ] as const)('%s sorts in the requested direction', (mode, expected) => {
    expect(ids(mode)).toEqual(expected);
  });

  it('preserves original order for the Cart default and does not mutate its source', () => {
    const original = [...items];
    expect(ids('original')).toEqual(['third', 'first', 'second']);
    expect(ids('name-asc')).toEqual(['second', 'first', 'third']);
    expect(items).toEqual(original);
  });

  it('keeps missing values last in either direction and uses set code when set name is missing', () => {
    const withMissing: Array<SortableCollectionItem & { id: string }> = [
      item('missing', 'Missing', {
        card: { setCode: 'zeta', setName: undefined, setNumber: '' },
        marketPrice: null,
        unitPrice: null,
        quantity: 1,
        totalValue: null,
      }),
      item('known', 'Known', {
        card: { setCode: 'alpha', setName: undefined, setNumber: '1' },
        marketPrice: 0,
        unitPrice: 0,
        quantity: 2,
        totalValue: 0,
      }),
    ];

    expect(ids('price-asc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('price-desc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('unit-price-asc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('unit-price-desc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('total-value-asc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('total-value-desc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('collector-number', withMissing)).toEqual(['known', 'missing']);
    expect(ids('set-asc', withMissing)).toEqual(['known', 'missing']);
    expect(ids('set-desc', withMissing)).toEqual(['missing', 'known']);
  });

  it('keeps equal sort keys in their input order', () => {
    const tied = [
      item('second', 'Same', { addedAt: 10, quantity: 2 }),
      item('first', 'same', { addedAt: 10, quantity: 2 }),
    ];
    expect(ids('name-asc', tied)).toEqual(['second', 'first']);
    expect(ids('recently-added', tied)).toEqual(['second', 'first']);
    expect(ids('quantity-asc', tied)).toEqual(['second', 'first']);
  });

  it('matches the Wishlist name sort default without changing saved entry order', () => {
    const wishlistCards = [
      { ...items[0], addedAt: items[0].addedAt ?? 30, marketPrice: items[0].marketPrice ?? null },
      { ...items[1], addedAt: items[1].addedAt ?? 10, marketPrice: items[1].marketPrice ?? null },
    ];
    expect(sortWishlistCards(wishlistCards, 'name-asc').map(({ id }) => id)).toEqual(['first', 'third']);
    expect(wishlistCards.map(({ id }) => id)).toEqual(['third', 'first']);
  });

  it('sorts Cart lines by seller unit price and derived total while preserving their original order by default', () => {
    const lines = [
      { ...items[0], addedAt: items[0].addedAt ?? 30, sellerPrice: 5, quantity: 2 },
      { ...items[1], addedAt: items[1].addedAt ?? 10, sellerPrice: 2, quantity: 1 },
      { ...items[2], addedAt: items[2].addedAt ?? 20, sellerPrice: null, quantity: 4 },
    ];
    expect(sortCartLines(lines, 'original').map(({ id }) => id)).toEqual(['third', 'first', 'second']);
    expect(sortCartLines(lines, 'unit-price-asc').map(({ id }) => id)).toEqual(['first', 'third', 'second']);
    expect(sortCartLines(lines, 'total-value-desc').map(({ id }) => id)).toEqual(['third', 'first', 'second']);
    expect(lines.map(({ id }) => id)).toEqual(['third', 'first', 'second']);
  });
});
