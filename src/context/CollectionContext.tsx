import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  BinderEntry,
  CartEntry,
  CollectionStats,
  OwnedCard,
  WishlistEntry,
} from '@/types';
import * as svc from '@/services/collectionService';

interface CollectionContextValue {
  binder: BinderEntry[];
  wishlist: WishlistEntry[];
  cart: CartEntry[];
  ownedCards: OwnedCard[];
  stats: CollectionStats | null;
  loading: boolean;

  // Binder actions
  addToBinder: (cardId: string, qty?: number) => Promise<void>;
  setBinderQuantity: (cardId: string, qty: number) => Promise<void>;
  removeFromBinder: (cardId: string) => Promise<void>;
  getQuantity: (cardId: string) => number;

  // Wishlist actions
  addToWishlist: (cardId: string) => Promise<void>;
  removeFromWishlist: (cardId: string) => Promise<void>;
  isInWishlist: (cardId: string) => boolean;

  // Cart actions
  addToCart: (cardId: string, qty?: number, sellerPrice?: number | null) => Promise<void>;
  updateCartEntry: (cardId: string, patch: Partial<Omit<CartEntry, 'cardId'>>) => Promise<void>;
  removeFromCart: (cardId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [binder, setBinder] = useState<BinderEntry[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [ownedCards, setOwnedCards] = useState<OwnedCard[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    const [b, w, c, owned, s] = await Promise.all([
      svc.getBinder(),
      svc.getWishlist(),
      svc.getCart(),
      svc.getOwnedCards(),
      svc.getCollectionStats(),
    ]);
    setBinder(b);
    setWishlist(w);
    setCart(c);
    setOwnedCards(owned);
    setStats(s);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  // Binder
  const addToBinder = useCallback(async (cardId: string, qty = 1) => {
    await svc.addToBinder(cardId, qty);
    await refreshAll();
  }, [refreshAll]);

  const setBinderQuantity = useCallback(async (cardId: string, qty: number) => {
    await svc.setBinderQuantity(cardId, qty);
    await refreshAll();
  }, [refreshAll]);

  const removeFromBinder = useCallback(async (cardId: string) => {
    await svc.removeFromBinder(cardId);
    await refreshAll();
  }, [refreshAll]);

  const getQuantity = useCallback((cardId: string) => {
    return binder.find((e) => e.cardId === cardId)?.quantity ?? 0;
  }, [binder]);

  // Wishlist
  const addToWishlist = useCallback(async (cardId: string) => {
    await svc.addToWishlist(cardId);
    await refreshAll();
  }, [refreshAll]);

  const removeFromWishlist = useCallback(async (cardId: string) => {
    await svc.removeFromWishlist(cardId);
    await refreshAll();
  }, [refreshAll]);

  const isInWishlist = useCallback((cardId: string) => {
    return wishlist.some((e) => e.cardId === cardId);
  }, [wishlist]);

  // Cart
  const addToCart = useCallback(async (cardId: string, qty = 1, sellerPrice?: number | null) => {
    await svc.addToCart(cardId, qty, sellerPrice);
    await refreshAll();
  }, [refreshAll]);

  const updateCartEntry = useCallback(async (cardId: string, patch: Partial<Omit<CartEntry, 'cardId'>>) => {
    await svc.updateCartEntry(cardId, patch);
    await refreshAll();
  }, [refreshAll]);

  const removeFromCart = useCallback(async (cardId: string) => {
    await svc.removeFromCart(cardId);
    await refreshAll();
  }, [refreshAll]);

  const clearCart = useCallback(async () => {
    await svc.clearCart();
    await refreshAll();
  }, [refreshAll]);

  const value = useMemo<CollectionContextValue>(() => ({
    binder, wishlist, cart, ownedCards, stats, loading,
    addToBinder, setBinderQuantity, removeFromBinder, getQuantity,
    addToWishlist, removeFromWishlist, isInWishlist,
    addToCart, updateCartEntry, removeFromCart, clearCart, refreshAll,
  }), [
    binder, wishlist, cart, ownedCards, stats, loading,
    addToBinder, setBinderQuantity, removeFromBinder, getQuantity,
    addToWishlist, removeFromWishlist, isInWishlist,
    addToCart, updateCartEntry, removeFromCart, clearCart, refreshAll,
  ]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider');
  return ctx;
}
