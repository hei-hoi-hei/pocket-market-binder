import { recordSyncChange } from './sync/syncCollectionService';

import type {
  BinderEntry,
  CartEntry,
  CollectionStats,
  OwnedCard,
  Rarity,
  WishlistEntry,
} from '@/types';
import { storage } from './storage';
import { catalogService } from './catalogService';
import { pricingService } from './pricingService';

/**
 * Collection service — binder, wishlist, and cart persistence.
 *
 * All methods are async to allow a future IndexedDB-backed implementation.
 * UI code should call these via the React hooks/context, not directly.
 */

const KEYS = {
  binder: 'binder',
  wishlist: 'wishlist',
  cart: 'cart',
} as const;

// ── Binder ──────────────────────────────────────────────────────────────────

export async function getBinder(): Promise<BinderEntry[]> {
  return (await storage.get<BinderEntry[]>(KEYS.binder)) ?? [];
}

export async function setBinder(entries: BinderEntry[]): Promise<void> {
  await storage.set(KEYS.binder, entries);
}

export async function addToBinder(cardId: string, qty = 1): Promise<BinderEntry[]> {
  if (typeof cardId !== 'string' || cardId.trim().length === 0) {
    throw new Error('A valid card ID is required to add a Binder entry.');
  }
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error('Binder quantity must be a positive whole number.');
  }

  let entries = await getBinder();
  const firstIndex = entries.findIndex((entry) => entry.cardId === cardId);
  const existingEntries = entries.filter((entry) => entry.cardId === cardId);
  if (firstIndex >= 0) {
    const existing = entries[firstIndex];
    const quantity = existingEntries.reduce((total, entry) => total + entry.quantity, qty);
    if (!Number.isSafeInteger(quantity)) {
      throw new Error('The resulting Binder quantity must be a safe whole number.');
    }
    entries = entries.filter((entry) => entry.cardId !== cardId);
    entries.splice(firstIndex, 0, { ...existing, quantity });
  } else {
    entries.push({ cardId, quantity: qty, addedAt: Date.now() });
  }
  await setBinder(entries);
  try {
    await recordSyncChange('binder', cardId, {
      cardId,
      quantity: entries.find((entry) => entry.cardId === cardId)?.quantity ?? qty,
    });
  } catch (error: unknown) {
    console.error('Binder was updated locally, but its sync change could not be recorded.', error);
  }
  return entries;
}

export async function setBinderQuantity(cardId: string, quantity: number): Promise<BinderEntry[]> {
  let entries = await getBinder();
  if (quantity <= 0) {
    entries = entries.filter((e) => e.cardId !== cardId);
  } else {
    const existing = entries.find((e) => e.cardId === cardId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      entries.push({ cardId, quantity, addedAt: Date.now() });
    }
  }
  await setBinder(entries);
  await recordSyncChange('binder', cardId, { cardId, quantity });
  return entries;
}

export async function removeFromBinder(cardId: string): Promise<BinderEntry[]> {
  const entries = (await getBinder()).filter((e) => e.cardId !== cardId);
  await setBinder(entries);
  await recordSyncChange('binder', cardId, {}, true);
  return entries;
}

export async function getOwnedCards(): Promise<OwnedCard[]> {
  const entries = await getBinder();
  const ownedCards: OwnedCard[] = [];
  for (const e of entries) {
    const card = await catalogService.getById(e.cardId);
    if (card) {
      ownedCards.push({ card, quantity: e.quantity });
    }
  }
  return ownedCards.sort((a, b) => a.card.name.localeCompare(b.card.name));
}

// ── Wishlist ─────────────────────────────────────────────────────────────────

export async function getWishlist(): Promise<WishlistEntry[]> {
  return (await storage.get<WishlistEntry[]>(KEYS.wishlist)) ?? [];
}

export async function setWishlist(entries: WishlistEntry[]): Promise<void> {
  await storage.set(KEYS.wishlist, entries);
}

export async function addToWishlist(cardId: string): Promise<WishlistEntry[]> {
  const entries = await getWishlist();
  if (!entries.some((e) => e.cardId === cardId)) {
    entries.push({ cardId, addedAt: Date.now() });
    await recordSyncChange('wishlist', cardId, { cardId });
  }
  await setWishlist(entries);
  return entries;
}

export async function removeFromWishlist(cardId: string): Promise<WishlistEntry[]> {
  const entries = (await getWishlist()).filter((e) => e.cardId !== cardId);
  await setWishlist(entries);
  await recordSyncChange('wishlist', cardId, {}, true);
  return entries;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export async function getCart(): Promise<CartEntry[]> {
  return (await storage.get<CartEntry[]>(KEYS.cart)) ?? [];
}

export async function setCart(entries: CartEntry[]): Promise<void> {
  await storage.set(KEYS.cart, entries);
}

export async function addToCart(cardId: string, qty = 1, sellerPrice?: number | null): Promise<CartEntry[]> {
  const entries = await getCart();
  const existing = entries.find((e) => e.cardId === cardId);
  let updatedEntry: CartEntry;
  if (existing) {
    existing.quantity += qty;
    if (sellerPrice != null) existing.sellerPrice = sellerPrice;
    updatedEntry = existing;
  } else {
    updatedEntry = { cardId, quantity: qty, sellerPrice: sellerPrice ?? null, addedAt: Date.now() };
    entries.push(updatedEntry);
  }
  await setCart(entries);
  await recordSyncChange('cart', cardId, updatedEntry);
  return entries;
}

export async function updateCartEntry(cardId: string, patch: Partial<Omit<CartEntry, 'cardId'>>): Promise<CartEntry[]> {
  const entries = await getCart();
  const existing = entries.find((e) => e.cardId === cardId);
  if (existing) {
    Object.assign(existing, patch);
  }
  await setCart(entries);
  if (existing) await recordSyncChange('cart', cardId, existing);
  return entries;
}

export async function removeFromCart(cardId: string): Promise<CartEntry[]> {
  const entries = (await getCart()).filter((e) => e.cardId !== cardId);
  await setCart(entries);
  await recordSyncChange('cart', cardId, {}, true);
  return entries;
}

export async function clearCart(): Promise<void> {
  await setCart([]);
}

// ── Statistics ─────────────────────────────────────────────────────────────────

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'holo', 'ultra', 'secret', 'other'];

export interface BinderMarketValueSummary {
  collectionValue: number | null;
  pricedItems: number;
  unpricedItems: number;
  pricingPending: boolean;
}

function isValidBinderQuantity(quantity: unknown): quantity is number {
  return typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0;
}

export async function getBinderMarketValue(
  entries: BinderEntry[],
  ownedCards: OwnedCard[],
): Promise<BinderMarketValueSummary> {
  if (entries.length === 0) {
    return { collectionValue: 0, pricedItems: 0, unpricedItems: 0, pricingPending: false };
  }

  const cardsById = new Map(ownedCards.map(({ card }) => [card.id, card]));
  const itemValues = await Promise.all(entries.map(async (entry): Promise<number | null> => {
    const card = cardsById.get(entry.cardId);
    if (!card || !isValidBinderQuantity(entry.quantity)) return null;

    try {
      const { value } = await pricingService.getConsolidatedPrice(card);
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
      const itemValue = value * entry.quantity;
      return Number.isFinite(itemValue) ? itemValue : null;
    } catch {
      return null;
    }
  }));

  let collectionValue = 0;
  let pricedItems = 0;
  for (const itemValue of itemValues) {
    if (itemValue === null || !Number.isFinite(collectionValue + itemValue)) continue;
    collectionValue += itemValue;
    pricedItems += 1;
  }

  return {
    collectionValue: pricedItems > 0 ? Math.round(collectionValue * 100) / 100 : null,
    pricedItems,
    unpricedItems: entries.length - pricedItems,
    pricingPending: false,
  };
}

export function calculateCollectionStats(
  entries: BinderEntry[],
  owned: OwnedCard[],
  wishlist: WishlistEntry[],
  cart: CartEntry[],
): CollectionStats {
  const byRarity = {} as Record<Rarity, number>;
  for (const r of RARITIES) byRarity[r] = 0;

  let totalCards = 0;
  for (const { card, quantity } of owned) {
    if (!isValidBinderQuantity(quantity)) continue;
    totalCards += quantity;
    byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + quantity;
  }

  return {
    uniqueCards: owned.length,
    totalCards,
    collectionValue: entries.length === 0 ? 0 : null,
    pricedItems: 0,
    unpricedItems: 0,
    pricingPending: entries.length > 0,
    byRarity,
    wishlistCount: wishlist.length,
    cartCount: cart.length,
  };
}

export async function getCollectionStats(): Promise<CollectionStats> {
  const [entries, owned, wishlist, cart] = await Promise.all([
    getBinder(),
    getOwnedCards(),
    getWishlist(),
    getCart(),
  ]);
  const stats = calculateCollectionStats(entries, owned, wishlist, cart);
  return { ...stats, ...await getBinderMarketValue(entries, owned) };
}
