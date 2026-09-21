import { storage } from './storage';
import { getBinder, setBinder, getWishlist, setWishlist, getCart, setCart } from './collectionService';

export interface BackupPayload {
  version: string;
  exportedAt: number;
  binder: any[];
  wishlist: any[];
  cart: any[];
}

export async function exportUserData(): Promise<BackupPayload> {
  const [binder, wishlist, cart] = await Promise.all([
    getBinder(),
    getWishlist(),
    getCart()
  ]);

  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    binder,
    wishlist,
    cart
  };
}

export async function importUserData(jsonData: string, mode: 'merge' | 'overwrite'): Promise<void> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch (e) {
    throw new Error('Invalid JSON format.');
  }

  // Validate schema structure
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.binder) || !Array.isArray(parsed.wishlist) || !Array.isArray(parsed.cart)) {
    throw new Error('Invalid backup schema structure.');
  }

  if (mode === 'overwrite') {
    await setBinder(parsed.binder);
    await setWishlist(parsed.wishlist);
    await setCart(parsed.cart);
  } else {
    // Merge mode
    const [currentBinder, currentWishlist, currentCart] = await Promise.all([
      getBinder(),
      getWishlist(),
      getCart()
    ]);

    // Merge binder
    const binderMap = new Map(currentBinder.map((item: any) => [item.cardId, item]));
    for (const item of parsed.binder) {
      if (binderMap.has(item.cardId)) {
        const existing: any = binderMap.get(item.cardId);
        existing.quantity += (item.quantity || 1);
      } else {
        binderMap.set(item.cardId, item);
      }
    }

    // Merge wishlist
    const wishlistMap = new Map(currentWishlist.map((item: any) => [item.cardId, item]));
    for (const item of parsed.wishlist) {
      if (!wishlistMap.has(item.cardId)) {
        wishlistMap.set(item.cardId, item);
      }
    }

    // Merge cart
    const cartMap = new Map(currentCart.map((item: any) => [item.cardId, item]));
    for (const item of parsed.cart) {
      if (cartMap.has(item.cardId)) {
        const existing: any = cartMap.get(item.cardId);
        existing.quantity += (item.quantity || 1);
      } else {
        cartMap.set(item.cardId, item);
      }
    }

    await setBinder(Array.from(binderMap.values()));
    await setWishlist(Array.from(wishlistMap.values()));
    await setCart(Array.from(cartMap.values()));
  }
}
