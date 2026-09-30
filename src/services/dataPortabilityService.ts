import { storage } from './storage';
import { getBinder, getWishlist, getCart } from './collectionService';
import type { BinderEntry, CartEntry, WishlistEntry } from '@/types';

export interface BackupPayload {
  version: '1.0.0';
  exportedAt: number;
  binder: BinderEntry[];
  wishlist: WishlistEntry[];
  cart: CartEntry[];
}

const BACKUP_VERSION = '1.0.0';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAllowedFields(
  entry: Record<string, unknown>,
  allowedFields: readonly string[],
  collectionName: string,
  index: number,
): void {
  const unsupported = Object.keys(entry).filter((key) => !allowedFields.includes(key));
  if (unsupported.length > 0) {
    throw new Error(`Backup ${collectionName} entry ${index + 1} contains unsupported fields.`);
  }
}

function parseCollection<T extends { cardId: string }>(
  value: unknown,
  collectionName: string,
  allowedFields: readonly string[],
  parseEntry: (entry: Record<string, unknown>, index: number) => T,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Backup ${collectionName} must be an array.`);
  }

  const cardIds = new Set<string>();
  return value.map((item: unknown, index: number) => {
    if (!isRecord(item)) {
      throw new Error(`Backup ${collectionName} entry ${index + 1} must be an object.`);
    }
    assertAllowedFields(item, allowedFields, collectionName, index);
    const parsed = parseEntry(item, index);
    if (cardIds.has(parsed.cardId)) {
      throw new Error(`Backup ${collectionName} contains duplicate card ID "${parsed.cardId}".`);
    }
    cardIds.add(parsed.cardId);
    return parsed;
  });
}

function parseTimestamp(value: unknown, field: string, collectionName: string, index: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Backup ${collectionName} entry ${index + 1} has an invalid ${field}.`);
  }
  return value;
}

function parseCardId(entry: Record<string, unknown>, collectionName: string, index: number): string {
  if (typeof entry.cardId !== 'string' || entry.cardId.trim().length === 0) {
    throw new Error(`Backup ${collectionName} entry ${index + 1} has an invalid card ID.`);
  }
  return entry.cardId;
}

function parseQuantity(entry: Record<string, unknown>, collectionName: string, index: number): number {
  if (typeof entry.quantity !== 'number' || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
    throw new Error(`Backup ${collectionName} entry ${index + 1} has an invalid quantity.`);
  }
  return entry.quantity;
}

function parseBackupPayload(jsonData: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error('Invalid JSON format.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid backup schema structure.');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version. Expected ${BACKUP_VERSION}.`);
  }
  if (typeof parsed.exportedAt !== 'number' || !Number.isFinite(parsed.exportedAt) || parsed.exportedAt < 0) {
    throw new Error('Backup has an invalid export timestamp.');
  }

  const binder = parseCollection<BinderEntry>(
    parsed.binder,
    'binder',
    ['cardId', 'quantity', 'addedAt'],
    (entry, index) => ({
      cardId: parseCardId(entry, 'binder', index),
      quantity: parseQuantity(entry, 'binder', index),
      addedAt: parseTimestamp(entry.addedAt, 'addedAt', 'binder', index),
    }),
  );
  const wishlist = parseCollection<WishlistEntry>(
    parsed.wishlist,
    'wishlist',
    ['cardId', 'addedAt'],
    (entry, index) => ({
      cardId: parseCardId(entry, 'wishlist', index),
      addedAt: parseTimestamp(entry.addedAt, 'addedAt', 'wishlist', index),
    }),
  );
  const cart = parseCollection<CartEntry>(
    parsed.cart,
    'cart',
    ['cardId', 'quantity', 'sellerPrice', 'addedAt'],
    (entry, index) => {
      const cartEntry: CartEntry = {
        cardId: parseCardId(entry, 'cart', index),
        quantity: parseQuantity(entry, 'cart', index),
        addedAt: parseTimestamp(entry.addedAt, 'addedAt', 'cart', index),
      };
      if ('sellerPrice' in entry) {
        const sellerPrice = entry.sellerPrice;
        if (sellerPrice !== null && (
          typeof sellerPrice !== 'number' || !Number.isFinite(sellerPrice) || sellerPrice < 0
        )) {
          throw new Error(`Backup cart entry ${index + 1} has an invalid planned unit cost.`);
        }
        cartEntry.sellerPrice = sellerPrice;
      }
      return cartEntry;
    },
  );

  const unsupportedFields = Object.keys(parsed).filter(
    (key) => !['version', 'exportedAt', 'binder', 'wishlist', 'cart'].includes(key),
  );
  if (unsupportedFields.length > 0) {
    throw new Error('Backup contains unsupported top-level fields.');
  }

  return { version: BACKUP_VERSION, exportedAt: parsed.exportedAt, binder, wishlist, cart };
}

export async function exportUserData(): Promise<BackupPayload> {
  const [binder, wishlist, cart] = await Promise.all([
    getBinder(),
    getWishlist(),
    getCart()
  ]);

  return parseBackupPayload(JSON.stringify({
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    binder,
    wishlist,
    cart,
  }));
}

export async function importUserData(jsonData: string, mode: 'merge' | 'overwrite'): Promise<void> {
  const parsed = parseBackupPayload(jsonData);
  if (mode !== 'merge' && mode !== 'overwrite') {
    throw new Error('Invalid backup import mode.');
  }

  if (mode === 'overwrite') {
    await storage.setMany([
      ['binder', parsed.binder],
      ['wishlist', parsed.wishlist],
      ['cart', parsed.cart],
    ]);
  } else {
    const [currentBinder, currentWishlist, currentCart] = await Promise.all([
      getBinder(),
      getWishlist(),
      getCart()
    ]);

    const binderMap = new Map(currentBinder.map((item) => [item.cardId, { ...item }]));
    for (const item of parsed.binder) {
      const existing = binderMap.get(item.cardId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        binderMap.set(item.cardId, item);
      }
    }

    const wishlistMap = new Map(currentWishlist.map((item) => [item.cardId, item]));
    for (const item of parsed.wishlist) {
      if (!wishlistMap.has(item.cardId)) {
        wishlistMap.set(item.cardId, item);
      }
    }

    const cartMap = new Map(currentCart.map((item) => [item.cardId, { ...item }]));
    for (const item of parsed.cart) {
      const existing = cartMap.get(item.cardId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        cartMap.set(item.cardId, item);
      }
    }

    await storage.setMany([
      ['binder', Array.from(binderMap.values())],
      ['wishlist', Array.from(wishlistMap.values())],
      ['cart', Array.from(cartMap.values())],
    ]);
  }
}
