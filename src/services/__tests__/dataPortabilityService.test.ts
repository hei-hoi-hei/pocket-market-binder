import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BinderEntry, CartEntry, WishlistEntry } from '@/types';

let current: {
  binder: BinderEntry[];
  wishlist: WishlistEntry[];
  cart: CartEntry[];
};
let writeCount: number;
let failWrites: boolean;

type CollectionWrite =
  | readonly ['binder', BinderEntry[]]
  | readonly ['wishlist', WishlistEntry[]]
  | readonly ['cart', CartEntry[]];

async function setMany(entries: ReadonlyArray<CollectionWrite>): Promise<void> {
  writeCount += 1;
  if (failWrites) throw new Error('IndexedDB write failed.');

  const updated = { ...current };
  for (const [key, value] of entries) {
    switch (key) {
      case 'binder':
        updated.binder = value;
        break;
      case 'wishlist':
        updated.wishlist = value;
        break;
      case 'cart':
        updated.cart = value;
        break;
    }
  }
  current = updated;
}

async function loadService() {
  vi.resetModules();
  vi.doMock('../storage', () => ({ storage: { setMany } }));
  vi.doMock('../collectionService', () => ({
    getBinder: async () => current.binder,
    getWishlist: async () => current.wishlist,
    getCart: async () => current.cart,
  }));
  return import('../dataPortabilityService');
}

function backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: '1.0.0',
    exportedAt: 100,
    binder: [{ cardId: 'card-a', quantity: 2, addedAt: 10 }],
    wishlist: [{ cardId: 'card-b', addedAt: 20 }],
    cart: [{ cardId: 'card-c', quantity: 1, sellerPrice: 4.5, addedAt: 30 }],
    ...overrides,
  });
}

describe('dataPortabilityService', () => {
  beforeEach(() => {
    current = { binder: [], wishlist: [], cart: [] };
    writeCount = 0;
    failWrites = false;
  });

  afterEach(() => {
    vi.doUnmock('../storage');
    vi.doUnmock('../collectionService');
    vi.resetModules();
  });

  it('atomically overwrites all user-owned collections from a validated backup', async () => {
    const { importUserData } = await loadService();

    await importUserData(backup(), 'overwrite');

    expect(writeCount).toBe(1);
    expect(current).toEqual({
      binder: [{ cardId: 'card-a', quantity: 2, addedAt: 10 }],
      wishlist: [{ cardId: 'card-b', addedAt: 20 }],
      cart: [{ cardId: 'card-c', quantity: 1, sellerPrice: 4.5, addedAt: 30 }],
    });
  });

  it('merges quantities while preserving existing cart prices and unique wishlist entries', async () => {
    current = {
      binder: [{ cardId: 'card-a', quantity: 3, addedAt: 1 }],
      wishlist: [{ cardId: 'card-b', addedAt: 2 }],
      cart: [{ cardId: 'card-c', quantity: 4, sellerPrice: 8, addedAt: 3 }],
    };
    const { importUserData } = await loadService();

    await importUserData(backup(), 'merge');

    expect(current).toEqual({
      binder: [{ cardId: 'card-a', quantity: 5, addedAt: 1 }],
      wishlist: [{ cardId: 'card-b', addedAt: 2 }],
      cart: [{ cardId: 'card-c', quantity: 5, sellerPrice: 8, addedAt: 3 }],
    });
    expect(writeCount).toBe(1);
  });

  it.each([
    ['unsupported version', backup({ version: '2.0.0' })],
    ['invalid quantity', backup({ binder: [{ cardId: 'card-a', quantity: 0, addedAt: 10 }] })],
    ['duplicate IDs', backup({ wishlist: [{ cardId: 'card-b', addedAt: 20 }, { cardId: 'card-b', addedAt: 21 }] })],
    ['unsupported collection field', backup({ cart: [{ cardId: 'card-c', quantity: 1, addedAt: 30, sellerName: 'Shop' }] })],
  ])('rejects %s without writing any collection', async (_description, payload) => {
    const { importUserData } = await loadService();

    await expect(importUserData(payload, 'overwrite')).rejects.toThrow();

    expect(writeCount).toBe(0);
    expect(current).toEqual({ binder: [], wishlist: [], cart: [] });
  });

  it('surfaces an atomic storage failure without reporting a successful import', async () => {
    const { importUserData } = await loadService();
    failWrites = true;

    await expect(importUserData(backup(), 'overwrite')).rejects.toThrow('IndexedDB write failed.');
  });
});
