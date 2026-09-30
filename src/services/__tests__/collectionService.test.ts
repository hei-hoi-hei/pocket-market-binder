import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  vi.doMock('../catalogService', () => ({
    catalogService: { getById: vi.fn() },
  }));

  return import('../collectionService');
}

describe('collectionService', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStore = new Map();
    failBinderWrite = false;
    failBinderRead = false;
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
});
