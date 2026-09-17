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
  const entries = await getBinder();
  const existing = entries.find((e) => e.cardId === cardId);
  if (existing) {
    existing.quantity += qty;
  } else {
    entries.push({ cardId, quantity: qty, addedAt: Date.now() });
  }
  await setBinder(entries);
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
  return entries;
}

export async function removeFromBinder(cardId: string): Promise<BinderEntry[]> {
  const entries = (await getBinder()).filter((e) => e.cardId !== cardId);
  await setBinder(entries);
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
  }
  await setWishlist(entries);
  return entries;
}

export async function removeFromWishlist(cardId: string): Promise<WishlistEntry[]> {
  const entries = (await getWishlist()).filter((e) => e.cardId !== cardId);
  await setWishlist(entries);
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
  if (existing) {
    existing.quantity += qty;
    if (sellerPrice !== undefined) existing.sellerPrice = sellerPrice;
  } else {
    entries.push({ cardId, quantity: qty, sellerPrice: sellerPrice ?? null, addedAt: Date.now() });
  }
  await setCart(entries);
  return entries;
}

export async function updateCartEntry(cardId: string, patch: Partial<Omit<CartEntry, 'cardId'>>): Promise<CartEntry[]> {
  const entries = await getCart();
  const existing = entries.find((e) => e.cardId === cardId);
  if (existing) Object.assign(existing, patch);
  await setCart(entries);
  return entries;
}

export async function removeFromCart(cardId: string): Promise<CartEntry[]> {
  const entries = (await getCart()).filter((e) => e.cardId !== cardId);
  await setCart(entries);
  return entries;
}

export async function clearCart(): Promise<void> {
  await setCart([]);
}

// ── Statistics ─────────────────────────────────────────────────────────────────

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'holo', 'ultra', 'secret', 'other'];

export async function getCollectionStats(): Promise<CollectionStats> {
  const [owned, wishlist, cart] = await Promise.all([getOwnedCards(), getWishlist(), getCart()]);
  const byRarity = {} as Record<Rarity, number>;
  for (const r of RARITIES) byRarity[r] = 0;

  let totalCards = 0;
  for (const { card, quantity } of owned) {
    totalCards += quantity;
    byRarity[card.rarity] = (byRarity[card.rarity] ?? 0) + quantity;
  }

  return {
    uniqueCards: owned.length,
    totalCards,
    collectionValue: 0,
    byRarity,
    wishlistCount: wishlist.length,
    cartCount: cart.length,
  };
}

