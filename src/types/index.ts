// Core domain types for Pocket Market Binder.
// Kept framework-agnostic so UI, service, and data layers can all import them.

export type EnergyType =
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'dark'
  | 'steel'
  | 'dragon';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'holo' | 'ultra';

/** A single card in the mock catalog. */
export interface Card {
  id: string;
  name: string;
  /** Original creature genus label, e.g. "Flame Lizard". */
  genus: string;
  energyType: EnergyType;
  rarity: Rarity;
  setCode: string;
  setNumber: string;
  /** Reference / market price in USD (mock). */
  refPrice: number;
  hp: number;
  /** Evolves-from label, or null if basic. */
  evolvesFrom?: string | null;
  /** Mock attack entries. */
  attacks: CardAttack[];
  /** Flavor text — original, not copyrighted. */
  flavor: string;
  /** Stable seed used to generate the placeholder artwork gradient. */
  artSeed: number;
  /** Year of the (fictional) print. */
  year: number;
}

export interface CardAttack {
  name: string;
  damage: number;
  energyCost: EnergyType[];
  text: string;
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
  byEnergy: Partial<Record<EnergyType, number>>;
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
