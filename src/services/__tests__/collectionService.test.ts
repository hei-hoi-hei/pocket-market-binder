import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let localStore: Map<string, unknown>;
let closeSyncDatabase: (() => void) | undefined;

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
      get: async (key: string) => localStore.get(key) ?? null,
      set: async (key: string, value: unknown) => { localStore.set(key, value); },
      remove: async (key: string) => { localStore.delete(key); },
    },
  }));
  vi.doMock('../catalogService', () => ({
    catalogService: { getById: vi.fn() },
  }));

  return import('../collectionService');
}

describe('collectionService cart mutations', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStore = new Map();
    closeSyncDatabase?.();
    closeSyncDatabase = undefined;
    await deleteSyncDatabase();
  });

  afterEach(async () => {
    closeSyncDatabase?.();
    closeSyncDatabase = undefined;
    await deleteSyncDatabase();
  });

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
});
