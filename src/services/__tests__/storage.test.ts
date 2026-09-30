import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let closeLocalDatabase: (() => void) | undefined;
let storage: (typeof import('../storage'))['storage'];

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('pocket-market-binder');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Local database deletion was blocked.'));
  });
}

describe('IndexedDB atomic batch writes', () => {
  beforeEach(async () => {
    await deleteDatabase();
    const module = await import('../storage');
    storage = module.storage;
    closeLocalDatabase = module.closeLocalDatabase;
  });

  afterEach(async () => {
    closeLocalDatabase?.();
    closeLocalDatabase = undefined;
    await deleteDatabase();
  });

  it('commits every key in one successful batch', async () => {
    await storage.setMany([
      ['binder', [{ cardId: 'card-a', quantity: 1, addedAt: 10 }]],
      ['wishlist', [{ cardId: 'card-b', addedAt: 20 }]],
      ['cart', [{ cardId: 'card-c', quantity: 2, addedAt: 30 }]],
    ]);

    await expect(storage.get('binder')).resolves.toEqual([{ cardId: 'card-a', quantity: 1, addedAt: 10 }]);
    await expect(storage.get('wishlist')).resolves.toEqual([{ cardId: 'card-b', addedAt: 20 }]);
    await expect(storage.get('cart')).resolves.toEqual([{ cardId: 'card-c', quantity: 2, addedAt: 30 }]);
  });

  it('rolls back the entire batch when a value cannot be stored', async () => {
    await storage.set('binder', [{ cardId: 'existing-card', quantity: 1, addedAt: 1 }]);

    await expect(storage.setMany([
      ['binder', [{ cardId: 'replacement-card', quantity: 1, addedAt: 2 }]],
      ['uncloneable', () => undefined],
    ])).rejects.toThrow();

    await expect(storage.get('binder')).resolves.toEqual([
      { cardId: 'existing-card', quantity: 1, addedAt: 1 },
    ]);
    await expect(storage.get('uncloneable')).resolves.toBeNull();
  });
});
