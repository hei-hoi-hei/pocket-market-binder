import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectionValueStat } from '../CollectionValueStat';
import type { CollectionStats } from '@/types';

function stats(overrides: Partial<CollectionStats> = {}): CollectionStats {
  return {
    uniqueCards: 0,
    totalCards: 0,
    collectionValue: 0,
    pricedItems: 0,
    unpricedItems: 0,
    pricingPending: false,
    byRarity: {
      common: 0,
      uncommon: 0,
      rare: 0,
      holo: 0,
      ultra: 0,
      secret: 0,
      other: 0,
    },
    wishlistCount: 0,
    cartCount: 0,
    ...overrides,
  };
}

function renderStat(value: CollectionStats): string {
  return renderToStaticMarkup(createElement(CollectionValueStat, { stats: value }));
}

describe('CollectionValueStat', () => {
  it('labels a partial total as priced value and reports its coverage', () => {
    const markup = renderStat(stats({
      collectionValue: 8,
      pricedItems: 1,
      unpricedItems: 2,
    }));

    expect(markup).toContain('Priced value');
    expect(markup).toContain('$8.00');
    expect(markup).toContain('1 of 3 cards priced');
  });

  it('shows unavailable instead of zero when no Binder item has a price', () => {
    const markup = renderStat(stats({
      uniqueCards: 2,
      collectionValue: null,
      unpricedItems: 2,
    }));

    expect(markup).toContain('Unavailable');
    expect(markup).toContain('0 of 2 cards priced');
    expect(markup).not.toContain('$0.00');
  });

  it('shows zero for an empty Binder and a pending state while prices load', () => {
    expect(renderStat(stats())).toContain('$0.00');

    const pendingMarkup = renderStat(stats({
      uniqueCards: 1,
      collectionValue: null,
      pricingPending: true,
    }));
    expect(pendingMarkup).toContain('Checking...');
    expect(pendingMarkup).not.toContain('$0.00');
  });
});