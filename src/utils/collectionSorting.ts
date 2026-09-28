import type { Card } from '@/types';

export type CollectionSortMode =
  | 'original'
  | 'recently-added'
  | 'name-asc'
  | 'name-desc'
  | 'set-asc'
  | 'set-desc'
  | 'collector-number'
  | 'price-asc'
  | 'price-desc'
  | 'unit-price-asc'
  | 'unit-price-desc'
  | 'quantity-asc'
  | 'quantity-desc'
  | 'total-value-asc'
  | 'total-value-desc';

export interface SortableCollectionItem {
  card: Pick<Card, 'name' | 'setCode' | 'setName' | 'setNumber'>;
  addedAt?: number;
  marketPrice?: number | null;
  unitPrice?: number | null;
  quantity?: number;
  totalValue?: number | null;
}

export interface WishlistSortableCard extends SortableCollectionItem {
  addedAt: number;
  marketPrice: number | null;
}

export interface CartSortableLine extends SortableCollectionItem {
  addedAt: number;
  quantity: number;
  sellerPrice: number | null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareText(
  left: string | null | undefined,
  right: string | null | undefined,
  descending = false,
): number {
  const a = left?.trim() || null;
  const b = right?.trim() || null;
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  const comparison = collator.compare(a, b);
  return descending ? -comparison : comparison;
}

function setName(item: SortableCollectionItem): string {
  return item.card.setName?.trim() || item.card.setCode;
}

function compareNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  descending: boolean,
): number {
  const a = typeof left === 'number' && Number.isFinite(left) ? left : null;
  const b = typeof right === 'number' && Number.isFinite(right) ? right : null;
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  return descending ? b - a : a - b;
}

function compareCollectionItems(
  left: SortableCollectionItem,
  right: SortableCollectionItem,
  mode: CollectionSortMode,
): number {
  switch (mode) {
    case 'recently-added':
      return compareNumber(left.addedAt, right.addedAt, true);
    case 'name-asc':
      return compareText(left.card.name, right.card.name);
    case 'name-desc':
      return compareText(left.card.name, right.card.name, true);
    case 'set-asc':
      return compareText(setName(left), setName(right));
    case 'set-desc':
      return compareText(setName(left), setName(right), true);
    case 'collector-number':
      return compareText(left.card.setNumber, right.card.setNumber);
    case 'price-asc':
      return compareNumber(left.marketPrice, right.marketPrice, false);
    case 'price-desc':
      return compareNumber(left.marketPrice, right.marketPrice, true);
    case 'unit-price-asc':
      return compareNumber(left.unitPrice, right.unitPrice, false);
    case 'unit-price-desc':
      return compareNumber(left.unitPrice, right.unitPrice, true);
    case 'quantity-asc':
      return compareNumber(left.quantity, right.quantity, false);
    case 'quantity-desc':
      return compareNumber(left.quantity, right.quantity, true);
    case 'total-value-asc':
      return compareNumber(left.totalValue, right.totalValue, false);
    case 'total-value-desc':
      return compareNumber(left.totalValue, right.totalValue, true);
    case 'original':
      return 0;
  }
}

/** Sorts a view copy only; missing values remain last in either direction and ties stay stable. */
export function sortCollectionItems<T extends SortableCollectionItem>(
  items: readonly T[],
  mode: CollectionSortMode,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compareCollectionItems(left.item, right.item, mode) || left.index - right.index)
    .map(({ item }) => item);
}

export function sortWishlistCards<T extends WishlistSortableCard>(
  cards: readonly T[],
  mode: CollectionSortMode,
): T[] {
  return sortCollectionItems(cards, mode);
}

export function sortCartLines<T extends CartSortableLine>(
  lines: readonly T[],
  mode: CollectionSortMode,
): T[] {
  return sortCollectionItems(
    lines.map((line) => ({
      ...line,
      unitPrice: line.sellerPrice,
      totalValue: line.sellerPrice === null ? null : line.sellerPrice * line.quantity,
    })),
    mode,
  );
}
