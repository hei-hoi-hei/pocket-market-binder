import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinderEntry, Card, OwnedCard } from '@/types';

const collectionMocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getConsolidatedPrice: vi.fn(),
}));

let localStore: Map<string, unknown>;
let closeSyncDatabase: (() => void) | undefined;
let failBinderWrite: boolean;
let failBinderRead: boolean;

function deleteSyncDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('pocket-market-sync');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Sync database deletion was blocked'));
  });
}

async function loadCollectionService() {
  vi.doMock('../storage', () => ({
    storage: {
      get: async (key: string) => {
        if (key === 'binder' && failBinderRead) throw new Error('IndexedDB read failed.');
        return localStore.get(key) ?? null;
      },
      set: async (key: string, value: unknown) => {
        if (key === 'binder' && failBinderWrite) throw new Error('IndexedDB write failed.');
        localStore.set(key, value);
      },
      remove: async (key: string) => { localStore.delete(key); },
    },
  }));
  vi.doMock('../catalogService', () => ({ catalogService: { getById: collectionMocks.getById } }));
  vi.doMock('../pricingService', () => ({
    pricingService: { getConsolidatedPrice: collectionMocks.getConsolidatedPrice },
  }));

  return import('../collectionService');
}

describe('collectionService', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStore = new Map();
    failBinderWrite = false;
    failBinderRead = false;
    collectionMocks.getById.mockReset().mockResolvedValue(null);
    collectionMocks.getConsolidatedPrice.mockReset().mockResolvedValue({ value: null });
    closeSyncDatabase?.();
    closeSyncDatabase = undefined;
    await deleteSyncDatabase();
  });

  afterEach(async () => {
    closeSyncDatabase?.();
    closeSyncDatabase = undefined;
    await deleteSyncDatabase();
    vi.restoreAllMocks();
  });

  async function failOutboxRecording(): Promise<void> {
    const { outboxManager } = await import('../sync/engine/outboxManager');
    vi.spyOn(outboxManager, 'enqueue').mockRejectedValue(new Error('Outbox unavailable.'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }

  it('preserves an existing seller price locally and in the outbox when no new price is supplied', async () => {
    localStore.set('cart', [
      { cardId: 'qa-existing-priced-cart-item', quantity: 2, sellerPrice: 6.75, addedAt: 10 },
    ]);
    const { addToCart } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await expect(addToCart('qa-existing-priced-cart-item')).resolves.toEqual([
      { cardId: 'qa-existing-priced-cart-item', quantity: 3, sellerPrice: 6.75, addedAt: 10 },
    ]);
    await expect(outboxManager.getNextBatch(10)).resolves.toMatchObject([{
      store: 'cart',
      recordId: 'qa-existing-priced-cart-item',
      record: {
        data: { cardId: 'qa-existing-priced-cart-item', quantity: 3, sellerPrice: 6.75, addedAt: 10 },
      },
    }]);
  });

  it('includes an explicitly updated seller price in the resulting Cart record and outbox payload', async () => {
    localStore.set('cart', [
      { cardId: 'qa-cart-price-update', quantity: 2, sellerPrice: 6.75, addedAt: 10 },
    ]);
    const { addToCart } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await expect(addToCart('qa-cart-price-update', 1, 8.5)).resolves.toEqual([
      { cardId: 'qa-cart-price-update', quantity: 3, sellerPrice: 8.5, addedAt: 10 },
    ]);
    await expect(outboxManager.getNextBatch(10)).resolves.toMatchObject([{
      store: 'cart',
      record: {
        data: { cardId: 'qa-cart-price-update', quantity: 3, sellerPrice: 8.5, addedAt: 10 },
      },
    }]);
  });

  it('keeps a genuinely price-less Cart entry price-less in local storage and the outbox', async () => {
    localStore.set('cart', [
      { cardId: 'qa-cart-without-price', quantity: 1, addedAt: 10 },
    ]);
    const { addToCart } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await expect(addToCart('qa-cart-without-price')).resolves.toEqual([
      { cardId: 'qa-cart-without-price', quantity: 2, addedAt: 10 },
    ]);
    const [outboxEntry] = await outboxManager.getNextBatch(10);
    expect(outboxEntry).toMatchObject({
      store: 'cart',
      record: {
        data: { cardId: 'qa-cart-without-price', quantity: 2, addedAt: 10 },
      },
    });
    expect(outboxEntry.record.data).not.toHaveProperty('sellerPrice');
  });

  it('preserves seller price in the full outbox record when updating quantity', async () => {
    localStore.set('cart', [
      { cardId: 'qa-cart-quantity-update', quantity: 2, sellerPrice: 6.75, addedAt: 10 },
    ]);
    const { updateCartEntry } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await expect(updateCartEntry('qa-cart-quantity-update', { quantity: 3 })).resolves.toEqual([
      { cardId: 'qa-cart-quantity-update', quantity: 3, sellerPrice: 6.75, addedAt: 10 },
    ]);
    await expect(outboxManager.getNextBatch(10)).resolves.toMatchObject([{
      store: 'cart',
      recordId: 'qa-cart-quantity-update',
      record: {
        data: { cardId: 'qa-cart-quantity-update', quantity: 3, sellerPrice: 6.75, addedAt: 10 },
      },
    }]);
  });

  it('preserves absence of seller price in the full outbox record when updating a price-less entry', async () => {
    localStore.set('cart', [
      { cardId: 'qa-cart-quantity-without-price', quantity: 1, addedAt: 10 },
    ]);
    const { updateCartEntry } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await expect(updateCartEntry('qa-cart-quantity-without-price', { quantity: 2 })).resolves.toEqual([
      { cardId: 'qa-cart-quantity-without-price', quantity: 2, addedAt: 10 },
    ]);
    const [outboxEntry] = await outboxManager.getNextBatch(10);
    expect(outboxEntry.record.data).not.toHaveProperty('sellerPrice');
    expect(outboxEntry.record.data).toEqual({
      cardId: 'qa-cart-quantity-without-price',
      quantity: 2,
      addedAt: 10,
    });
  });

  it('adds multiple copies to an empty Binder using the exact card ID', async () => {
    const { addToBinder } = await loadCollectionService();
    const { closeSyncDatabase: close } = await import('../sync/syncDatabase');
    closeSyncDatabase = close;

    await expect(addToBinder('provider-card:exact-printing-id', 3)).resolves.toMatchObject([
      { cardId: 'provider-card:exact-printing-id', quantity: 3 },
    ]);
    expect(localStore.get('binder')).toEqual([
      expect.objectContaining({ cardId: 'provider-card:exact-printing-id', quantity: 3 }),
    ]);
  });

  it('increments an existing Binder card and consolidates duplicate logical entries', async () => {
    localStore.set('binder', [
      { cardId: 'exact-card-id', quantity: 2, addedAt: 10 },
      { cardId: 'another-card-id', quantity: 1, addedAt: 11 },
      { cardId: 'exact-card-id', quantity: 4, addedAt: 12 },
    ]);
    const { addToBinder } = await loadCollectionService();
    const { closeSyncDatabase: close } = await import('../sync/syncDatabase');
    closeSyncDatabase = close;

    await expect(addToBinder('exact-card-id', 3)).resolves.toEqual([
      { cardId: 'exact-card-id', quantity: 9, addedAt: 10 },
      { cardId: 'another-card-id', quantity: 1, addedAt: 11 },
    ]);
  });

  it('does not report a Binder addition when local storage rejects the write', async () => {
    failBinderWrite = true;
    const { addToBinder } = await loadCollectionService();

    await expect(addToBinder('card-id', 2)).rejects.toThrow('IndexedDB write failed.');
    expect(localStore.has('binder')).toBe(false);
  });

  it('does not replace Binder state or report success when the local read fails', async () => {
    localStore.set('binder', [{ cardId: 'existing-card', quantity: 4, addedAt: 1 }]);
    failBinderRead = true;
    const { addToBinder } = await loadCollectionService();

    await expect(addToBinder('new-card', 2)).rejects.toThrow('IndexedDB read failed.');
    expect(localStore.get('binder')).toEqual([
      { cardId: 'existing-card', quantity: 4, addedAt: 1 },
    ]);
  });

  it('reports a successful local addition when the optional sync outbox fails', async () => {
    const { addToBinder } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));
    vi.spyOn(outboxManager, 'enqueue').mockRejectedValueOnce(new Error('Outbox unavailable.'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(addToBinder('locally-canonical-card', 2)).resolves.toMatchObject([
      { cardId: 'locally-canonical-card', quantity: 2 },
    ]);
    expect(localStore.get('binder')).toEqual([
      expect.objectContaining({ cardId: 'locally-canonical-card', quantity: 2 }),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      'Binder was updated locally, but its sync change could not be recorded.',
      expect.any(Error),
    );
  });

  it('keeps Binder quantity updates when outbox recording fails', async () => {
    localStore.set('binder', [binderEntry('card-a', 2)]);
    await failOutboxRecording();
    const { setBinderQuantity } = await loadCollectionService();

    await expect(setBinderQuantity('card-a', 5)).resolves.toEqual([binderEntry('card-a', 5)]);
    expect(localStore.get('binder')).toEqual([binderEntry('card-a', 5)]);
    expect(console.error).toHaveBeenCalledWith(
      'Binder was updated locally, but its sync change could not be recorded.',
      expect.any(Error),
    );
  });

  it('keeps Binder removals when outbox recording fails', async () => {
    localStore.set('binder', [binderEntry('card-a', 2)]);
    await failOutboxRecording();
    const { removeFromBinder } = await loadCollectionService();

    await expect(removeFromBinder('card-a')).resolves.toEqual([]);
    expect(localStore.get('binder')).toEqual([]);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('persists Wishlist additions before best-effort outbox recording', async () => {
    await failOutboxRecording();
    const { addToWishlist, getWishlist } = await loadCollectionService();

    await expect(addToWishlist('card-a')).resolves.toEqual([
      { cardId: 'card-a', addedAt: expect.any(Number) },
    ]);
    await expect(getWishlist()).resolves.toEqual([
      { cardId: 'card-a', addedAt: expect.any(Number) },
    ]);
    expect(console.error).toHaveBeenCalledWith(
      'Wishlist was updated locally, but its sync change could not be recorded.',
      expect.any(Error),
    );
  });

  it('keeps Wishlist removals when outbox recording fails', async () => {
    localStore.set('wishlist', [{ cardId: 'card-a', addedAt: 1 }]);
    await failOutboxRecording();
    const { removeFromWishlist, getWishlist } = await loadCollectionService();

    await expect(removeFromWishlist('card-a')).resolves.toEqual([]);
    await expect(getWishlist()).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('keeps Cart add, update, and removal mutations when outbox recording fails', async () => {
    localStore.set('cart', [{ cardId: 'card-a', quantity: 1, sellerPrice: 4, addedAt: 1 }]);
    await failOutboxRecording();
    const { addToCart, updateCartEntry, removeFromCart, getCart } = await loadCollectionService();

    await addToCart('card-a', 2, 5);
    await expect(getCart()).resolves.toEqual([
      { cardId: 'card-a', quantity: 3, sellerPrice: 5, addedAt: 1 },
    ]);
    await updateCartEntry('card-a', { sellerPrice: 7 });
    await expect(getCart()).resolves.toEqual([
      { cardId: 'card-a', quantity: 3, sellerPrice: 7, addedAt: 1 },
    ]);
    await removeFromCart('card-a');
    await expect(getCart()).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('continues recording successful Wishlist mutations in the outbox', async () => {
    const { addToWishlist } = await loadCollectionService();
    const { outboxManager } = await import('../sync/engine/outboxManager');
    ({ closeSyncDatabase } = await import('../sync/syncDatabase'));

    await addToWishlist('card-a');

    await expect(outboxManager.getNextBatch(10)).resolves.toMatchObject([{
      store: 'wishlist',
      recordId: 'card-a',
      record: { data: { cardId: 'card-a' } },
    }]);
  });

  it('calculates Binder value from Market References multiplied by each quantity', async () => {
    const { getBinderMarketValue } = await loadCollectionService();
    const cards = [ownedCard('card-a', 2), ownedCard('card-b', 4)];
    collectionMocks.getConsolidatedPrice.mockImplementation(async (card: Card) => ({
      value: card.id === 'card-a' ? 2.5 : 3,
    }));

    await expect(getBinderMarketValue([
      binderEntry('card-a', 2),
      binderEntry('card-b', 4),
    ], cards)).resolves.toEqual({
      collectionValue: 17,
      pricedItems: 2,
      unpricedItems: 0,
      pricingPending: false,
    });
  });

  it('excludes cards without a usable Market Reference from the value', async () => {
    const { getBinderMarketValue } = await loadCollectionService();
    collectionMocks.getConsolidatedPrice.mockResolvedValue({ value: null });

    await expect(getBinderMarketValue(
      [binderEntry('card-a', 3)],
      [ownedCard('card-a', 3)],
    )).resolves.toEqual({
      collectionValue: null,
      pricedItems: 0,
      unpricedItems: 1,
      pricingPending: false,
    });
  });

  it('reports partial pricing coverage and isolates a failed price lookup', async () => {
    const { getBinderMarketValue } = await loadCollectionService();
    const cards = [ownedCard('card-a', 2), ownedCard('card-b', 1), ownedCard('card-c', 3)];
    collectionMocks.getConsolidatedPrice.mockImplementation(async (card: Card) => {
      if (card.id === 'card-a') return { value: 4 };
      if (card.id === 'card-b') return { value: 0 };
      throw new Error('Pricing unavailable.');
    });

    await expect(getBinderMarketValue([
      binderEntry('card-a', 2),
      binderEntry('card-b', 1),
      binderEntry('card-c', 3),
    ], cards)).resolves.toEqual({
      collectionValue: 8,
      pricedItems: 1,
      unpricedItems: 2,
      pricingPending: false,
    });
  });

  it('returns zero only for an empty Binder and does not request prices', async () => {
    const { getBinderMarketValue } = await loadCollectionService();

    await expect(getBinderMarketValue([], [])).resolves.toEqual({
      collectionValue: 0,
      pricedItems: 0,
      unpricedItems: 0,
      pricingPending: false,
    });
    expect(collectionMocks.getConsolidatedPrice).not.toHaveBeenCalled();
  });

  it('treats invalid or missing quantities and missing catalog cards as unpriced', async () => {
    const { getBinderMarketValue } = await loadCollectionService();
    collectionMocks.getConsolidatedPrice.mockResolvedValue({ value: 2 });

    await expect(getBinderMarketValue([
      binderEntry('priced', 2),
      binderEntry('zero', 0),
      binderEntry('fractional', 1.5),
      { cardId: 'missing-quantity', addedAt: 1 } as BinderEntry,
      binderEntry('missing-card', 3),
    ], [ownedCard('priced', 2), ownedCard('zero'), ownedCard('fractional')])).resolves.toEqual({
      collectionValue: 4,
      pricedItems: 1,
      unpricedItems: 4,
      pricingPending: false,
    });
    expect(collectionMocks.getConsolidatedPrice).toHaveBeenCalledOnce();
  });

  it('keeps Binder reads and local stats independent of pricing availability', async () => {
    const card = ownedCard('local-card', 2);
    localStore.set('binder', [binderEntry('local-card', 2)]);
    collectionMocks.getById.mockResolvedValue(card.card);
    collectionMocks.getConsolidatedPrice.mockRejectedValue(new Error('Pricing unavailable.'));
    const { calculateCollectionStats, getBinder } = await loadCollectionService();

    await expect(getBinder()).resolves.toEqual([binderEntry('local-card', 2)]);
    expect(calculateCollectionStats(
      [binderEntry('local-card', 2)],
      [card],
      [],
      [],
    )).toMatchObject({
      uniqueCards: 1,
      totalCards: 2,
      collectionValue: null,
      pricingPending: true,
    });
    expect(collectionMocks.getConsolidatedPrice).not.toHaveBeenCalled();
  });

  it('returns completed stats when price lookup is unavailable', async () => {
    const card = ownedCard('local-card', 2);
    localStore.set('binder', [binderEntry('local-card', 2)]);
    collectionMocks.getById.mockResolvedValue(card.card);
    collectionMocks.getConsolidatedPrice.mockRejectedValue(new Error('Pricing unavailable.'));
    const { getCollectionStats } = await loadCollectionService();

    await expect(getCollectionStats()).resolves.toMatchObject({
      collectionValue: null,
      pricedItems: 0,
      unpricedItems: 1,
      pricingPending: false,
    });
  });
});

function binderEntry(cardId: string, quantity: number): BinderEntry {
  return { cardId, quantity, addedAt: 1 };
}

function ownedCard(id: string, quantity = 1): OwnedCard {
  return {
    card: {
      id,
      name: id,
      category: 'pokemon',
      rarity: 'common',
      setCode: 'test',
      setNumber: '1',
    },
    quantity,
  };
}
