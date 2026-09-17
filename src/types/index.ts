// Core domain types for Pocket Market Binder.
// Kept framework-agnostic so UI, service, and data layers can all import them.

export type CardCategory = 'pokemon' | 'trainer' | 'energy';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'holo' | 'ultra' | 'secret' | 'other';

export interface CardVariants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
}

export interface CardAttack {
  name: string;
  damage?: string | number;
  energyCost?: string[];
  text?: string;
}

/** Provider-agnostic normalized Card model. */
export interface Card {
  id: string;
  name: string;
  category: CardCategory;
  types?: string[];
  rarity: Rarity;
  setCode: string;
  setName?: string;
  setNumber: string;
  imageUrlLow?: string;
  imageUrlHigh?: string;
  hp?: number;
  genus?: string;
  evolvesFrom?: string | null;
  attacks?: CardAttack[];
  flavor?: string;
  variants?: CardVariants;
  artSeed?: number;
}

/** An entry in the user's binder (collection). */
export interface BinderEntry {
  cardId: string;
  quantity: number;
  addedAt: number;
}

/** An entry in the wishlist. */
export interface WishlistEntry {
  cardId: string;
  addedAt: number;
}

/** An entry in the shopping cart with an optional seller price. */
export interface CartEntry {
  cardId: string;
  quantity: number;
  /** Optional price the user found from a seller, in USD. */
  sellerPrice?: number | null;
  addedAt: number;
}

/** Augmented card with collection info, for the binder grid. */
export interface OwnedCard {
  card: Card;
  quantity: number;
}

/** Summary statistics for the collection. */
export interface CollectionStats {
  uniqueCards: number;
  totalCards: number;
  collectionValue: number;
  byRarity: Record<Rarity, number>;
  wishlistCount: number;
  cartCount: number;
}

export type ScreenId =
  | 'home'
  | 'binder'
  | 'search'
  | 'detail'
  | 'wishlist'
  | 'cart';

