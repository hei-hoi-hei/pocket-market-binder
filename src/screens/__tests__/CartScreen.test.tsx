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
  addToBinder: vi.fn(),
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
    addToBinder: cartMocks.addToBinder,
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
    cartMocks.addToBinder.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('requires confirmation and adds the exact cart card and quantity without removing the cart line', async () => {
    await act(async () => root.render(createElement(CartScreen)));
    await vi.waitFor(() => expect(container.textContent).toContain('Acquisition Summary'));

    const addButtons = [...container.querySelectorAll('button')]
      .filter((button) => button.textContent?.includes('Add to Binder'));
    if (addButtons.length === 0) throw new Error('Add to Binder action was not rendered.');

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await act(async () => addButtons[0].click());
    expect(cartMocks.addToBinder).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Added 2 copies of Card card-a');

    await act(async () => {
      addButtons[0].click();
      await Promise.resolve();
    });
    expect(window.confirm).toHaveBeenLastCalledWith('Add 2 copies of Card card-a to your Binder?');
    expect(cartMocks.addToBinder).toHaveBeenCalledWith('card-a', 2);
    expect(container.textContent).toContain('Added 2 copies of Card card-a to your Binder.');
    expect(container.textContent).toContain('The cart item remains here.');
    expect(container.textContent).toContain('Card card-a');
    expect(cartMocks.removeFromCart).not.toHaveBeenCalled();
  });

  it('reports a failed Binder write without reporting success or clearing the cart', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    cartMocks.addToBinder.mockRejectedValueOnce(new Error('IndexedDB write failed.'));
    await act(async () => root.render(createElement(CartScreen)));
    await vi.waitFor(() => expect(container.textContent).toContain('Acquisition Summary'));

    const addButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Add to Binder'));
    if (!addButton) throw new Error('Add to Binder action was not rendered.');
    await act(async () => {
      addButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Could not add Card card-a to your Binder.');
    expect(container.textContent).not.toContain('Added 2 copies of Card card-a');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Your cart item is unchanged');
    expect(cartMocks.removeFromCart).not.toHaveBeenCalled();
  });
});
