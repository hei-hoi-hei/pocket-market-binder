// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartScreen } from '../CartScreen';

const cartMocks = vi.hoisted(() => ({
  cart: [] as Array<{ cardId: string; quantity: number; sellerPrice?: number | null; addedAt: number }>,
  updateCartEntry: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
  go: vi.fn(),
  getById: vi.fn(),
  getConsolidatedPrice: vi.fn(),
}));

vi.mock('@/context/CollectionContext', () => ({
  useCollection: () => ({
    cart: cartMocks.cart,
    updateCartEntry: cartMocks.updateCartEntry,
    removeFromCart: cartMocks.removeFromCart,
    clearCart: cartMocks.clearCart,
  }),
}));

vi.mock('@/context/NavContext', () => ({
  useNav: () => ({ go: cartMocks.go }),
}));

vi.mock('@/services/catalogService', () => ({
  catalogService: { getById: cartMocks.getById },
}));

vi.mock('@/services/pricingService', () => ({
  pricingService: { getConsolidatedPrice: cartMocks.getConsolidatedPrice },
}));

vi.mock('@/components/CardArtwork', () => ({
  CardArtwork: ({ card }: { card: { id: string } }) => <div data-card-artwork={card.id} />,
}));

vi.mock('@/components/CollectionSortControl', () => ({
  CollectionSortControl: () => <div />,
}));

describe('CartScreen acquisition calculator', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    cartMocks.cart = [
      { cardId: 'card-a', quantity: 2, sellerPrice: 8, addedAt: 1 },
      { cardId: 'card-b', quantity: 1, addedAt: 2 },
      { cardId: 'card-c', quantity: 3, sellerPrice: 2, addedAt: 3 },
    ];
    cartMocks.getById.mockImplementation(async (id: string) => ({
      id,
      name: `Card ${id}`,
      category: 'pokemon',
      rarity: 'common',
      setCode: 'set',
      setNumber: id,
    }));
    cartMocks.getConsolidatedPrice.mockImplementation(async (card: { id: string }) => {
      if (card.id === 'card-c') throw new Error('Market reference unavailable.');
      return { value: card.id === 'card-a' ? 10 : 5 };
    });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('compares planned costs to available references and labels partial coverage', async () => {
    await act(async () => root.render(createElement(CartScreen)));
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Difference (1 comparable)');
      expect(container.textContent).toContain('Some Market References could not be loaded.');
    });

    expect(container.textContent).toContain('Acquisition Cart');
    expect(container.textContent).toContain('Market Reference (2/3)');
    expect(container.textContent).toContain('Planned acquisition (2/3)');
    expect(container.textContent).toContain('$25.00');
    expect(container.textContent).toContain('$22.00');
    expect(container.textContent).toContain('-$4.00');
    expect(container.textContent).toContain('Difference uses only items with both a planned cost and a fresh Market Reference.');
    expect(cartMocks.getConsolidatedPrice).toHaveBeenCalledTimes(3);
    expect(cartMocks.getConsolidatedPrice).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-a' }));
    expect(cartMocks.getConsolidatedPrice).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-b' }));
    expect(cartMocks.getConsolidatedPrice).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-c' }));
  });
});
