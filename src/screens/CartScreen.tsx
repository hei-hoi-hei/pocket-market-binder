import { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart, Trash2, Coins, CheckCircle2, Minus, Plus, BookOpen,
} from 'lucide-react';
import type { Card } from '@/types';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { catalogService } from '@/services/catalogService';
import { CardArtwork } from '@/components/CardArtwork';
import { CollectionSortControl, type CollectionSortOption } from '@/components/CollectionSortControl';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatPrice, getCardTypeStyle } from '@/utils/format';
import { sortCartLines, type CollectionSortMode } from '@/utils/collectionSorting';
import { pricingService } from '@/services/pricingService';

interface CartLine {
  cardId: string;
  card: Card;
  quantity: number;
  sellerPrice: number | null;
  referencePrice: number | null;
  addedAt: number;
}

const CART_SORT_OPTIONS: CollectionSortOption[] = [
  { value: 'original', label: 'Default order' },
  { value: 'recently-added', label: 'Recently added' },
  { value: 'name-asc', label: 'Card name A → Z' },
  { value: 'name-desc', label: 'Card name Z → A' },
  { value: 'set-asc', label: 'Set A → Z' },
  { value: 'set-desc', label: 'Set Z → A' },
  { value: 'collector-number', label: 'Collector number' },
  { value: 'unit-price-asc', label: 'Unit price: Low → High' },
  { value: 'unit-price-desc', label: 'Unit price: High → Low' },
  { value: 'quantity-asc', label: 'Quantity: Low → High' },
  { value: 'quantity-desc', label: 'Quantity: High → Low' },
  { value: 'total-value-asc', label: 'Total value: Low → High' },
  { value: 'total-value-desc', label: 'Total value: High → Low' },
];

export function CartScreen() {
  const { cart, updateCartEntry, removeFromCart, clearCart, addToBinder } = useCollection();
  const { go } = useNav();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceLoadFailed, setReferenceLoadFailed] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [sortMode, setSortMode] = useState<CollectionSortMode>('original');
  const [binderAction, setBinderAction] = useState<{
    cardId: string;
    status: 'pending' | 'success' | 'error';
    message: string;
  } | null>(null);
  const binderActionsInProgress = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const resolved: CartLine[] = [];
      for (const entry of cart) {
        const card = await catalogService.getById(entry.cardId);
        if (card) {
          resolved.push({
            cardId: entry.cardId,
            card,
            quantity: entry.quantity,
            sellerPrice: entry.sellerPrice ?? null,
            referencePrice: null,
            addedAt: entry.addedAt,
          });
        }
      }
      if (active) {
        setLines(resolved);
        setLoading(false);
        setReferenceLoading(resolved.length > 0);
        setReferenceLoadFailed(false);
      }

      const referenceResults = await Promise.all(resolved.map(async (line) => {
        try {
          const price = await pricingService.getConsolidatedPrice(line.card);
          return { cardId: line.cardId, referencePrice: price.value, failed: false };
        } catch {
          return { cardId: line.cardId, referencePrice: null, failed: true };
        }
      }));
      if (active) {
        const pricesByCardId = new Map(referenceResults.map(({ cardId, referencePrice }) => [
          cardId,
          referencePrice,
        ]));
        setLines((currentLines) => currentLines.map((line) => ({
          ...line,
          referencePrice: pricesByCardId.get(line.cardId) ?? null,
        })));
        setReferenceLoadFailed(referenceResults.some(({ failed }) => failed));
        setReferenceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cart]);

  const sellerTotal = lines.reduce((sum, l) => sum + (l.sellerPrice ?? 0) * l.quantity, 0);
  const pricedLinesCount = lines.filter((l) => l.sellerPrice !== null && l.sellerPrice >= 0).length;
  const referenceLines = lines.filter((line) => line.referencePrice !== null);
  const comparableLines = lines.filter((line) => line.referencePrice !== null && line.sellerPrice !== null);
  const referenceTotal = referenceLines.reduce(
    (sum, line) => sum + (line.referencePrice ?? 0) * line.quantity,
    0,
  );
  const comparableReferenceTotal = comparableLines.reduce(
    (sum, line) => sum + (line.referencePrice ?? 0) * line.quantity,
    0,
  );
  const comparablePlannedTotal = comparableLines.reduce(
    (sum, line) => sum + (line.sellerPrice ?? 0) * line.quantity,
    0,
  );
  const sortedLines = sortCartLines(lines, sortMode);

  const startEditPrice = (cardId: string, current: number | null) => {
    setEditingPrice(cardId);
    setPriceInput(current !== null ? String(current) : '');
  };

  const savePrice = (cardId: string) => {
    const parsed = priceInput !== '' ? parseFloat(priceInput) : null;
    const valid = parsed === null || (!isNaN(parsed) && parsed >= 0);
    if (valid) {
      updateCartEntry(cardId, { sellerPrice: parsed });
    }
    setEditingPrice(null);
    setPriceInput('');
  };

  const markPurchased = async (line: CartLine) => {
    if (binderActionsInProgress.current.has(line.cardId)) return;
    const copies = line.quantity === 1 ? '1 copy' : `${line.quantity} copies`;
    if (!window.confirm(`Add ${copies} of ${line.card.name} to your Binder?`)) return;

    binderActionsInProgress.current.add(line.cardId);
    setBinderAction({
      cardId: line.cardId,
      status: 'pending',
      message: `Adding ${copies} of ${line.card.name} to your Binder…`,
    });
    try {
      await addToBinder(line.cardId, line.quantity);
      setBinderAction({
        cardId: line.cardId,
        status: 'success',
        message: `Added ${copies} of ${line.card.name} to your Binder. The cart item remains here.`,
      });
    } catch (error: unknown) {
      console.error(`Unable to add ${line.card.name} from the acquisition cart to the Binder.`, error);
      setBinderAction({
        cardId: line.cardId,
        status: 'error',
        message: `Could not add ${line.card.name} to your Binder. Your cart item is unchanged; please try again.`,
      });
    } finally {
      binderActionsInProgress.current.delete(line.cardId);
    }
  };

  return (
    <div className="animate-fade-in pb-4">
      <ScreenHeader
        title="Acquisition Cart"
        icon={<ShoppingCart className="w-7 h-7 text-leather-600" />}
        action={
          lines.length > 0 ? (
            <button
              onClick={() => { if (confirm('Clear all items from the cart?')) clearCart(); }}
              className="text-xs font-semibold text-fire-500 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          ) : undefined
        }
      >
        <p className="text-sm text-leather-500">Plan acquisition costs and compare them with available market references.</p>
      </ScreenHeader>

      {loading ? (
        <div className="p-12 text-center text-leather-500">Loading cart...</div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-parchment-200 flex items-center justify-center mb-3">
            <ShoppingCart className="w-8 h-8 text-leather-400" />
          </div>
          <p className="text-leather-500 text-sm mb-3">Your cart is empty.</p>
          <button
            onClick={() => go('search')}
            className="bg-leather-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-leather-500 transition-colors active:scale-95"
          >
            Browse Cards
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Line items */}
          <div className="flex-1 w-full space-y-3">
            <CollectionSortControl value={sortMode} options={CART_SORT_OPTIONS} onChange={setSortMode} />
            {sortedLines.map((line, lineIndex) => {
              const { cardId, card, quantity, sellerPrice, referencePrice } = line;
              const style = getCardTypeStyle(card);
              const lineTotal = sellerPrice !== null ? sellerPrice * quantity : null;
              const currentBinderAction = binderAction?.cardId === cardId ? binderAction : null;

              return (
                <div key={`${cardId}-${lineIndex}`} className="bg-white rounded-xl p-3 border border-parchment-200 shadow-sm flex gap-3 items-center">
                  <div className="w-16 flex-shrink-0 cursor-pointer" onClick={() => go('detail', cardId)}>
                    <CardArtwork card={card} className="aspect-[3/4] rounded-lg" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 min-w-0">
                      <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0`}>
                        {style.label}
                      </span>
                      <span className="text-xs text-leather-400 min-w-0 truncate whitespace-nowrap">{card.setCode}-{card.setNumber}</span>
                    </div>
                    <h4
                      onClick={() => go('detail', cardId)}
                      className="font-display text-base text-leather-800 truncate cursor-pointer hover:underline"
                    >
                      {card.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-leather-600">
                      <span className="whitespace-nowrap">Qty: <strong className="text-leather-800">{quantity}</strong></span>
                      {sellerPrice !== null ? (
                        <span className="whitespace-nowrap">Planned unit cost: <strong className="text-leather-800">{formatPrice(sellerPrice)}</strong></span>
                      ) : (
                        <span className="text-leather-400 italic truncate">No planned unit cost</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-leather-500">
                      Market Reference: {referenceLoading
                        ? 'Loading…'
                        : referencePrice !== null
                          ? `${formatPrice(referencePrice)} per copy`
                          : 'Unavailable'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void markPurchased(line)}
                      disabled={currentBinderAction?.status === 'pending'}
                      className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-leather-300 px-3 py-1.5 text-xs font-semibold text-leather-700 hover:bg-parchment-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <BookOpen className="h-4 w-4" />
                      {currentBinderAction?.status === 'pending' ? 'Adding…' : 'Add to Binder'}
                    </button>
                    {currentBinderAction && (
                      <p
                        role={currentBinderAction.status === 'error' ? 'alert' : 'status'}
                        className={`mt-1 text-xs ${
                          currentBinderAction.status === 'error' ? 'text-fire-600' : 'text-grass-700'
                        }`}
                      >
                        {currentBinderAction.message}
                      </p>
                    )}

                    {/* Quantity & Price Row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => updateCartEntry(cardId, { quantity: Math.max(1, quantity - 1) })}
                          className="w-10 h-10 sm:w-6 sm:h-6 rounded-full bg-parchment-200 text-leather-700 flex items-center justify-center active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-sm tabular-nums w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => updateCartEntry(cardId, { quantity: Math.min(99, quantity + 1) })}
                          className="w-10 h-10 sm:w-6 sm:h-6 rounded-full bg-leather-600 text-white flex items-center justify-center active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {editingPrice === cardId ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            className="w-20 bg-parchment-100 border border-parchment-300 rounded px-2 py-0.5 text-xs font-medium text-leather-800 focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => savePrice(cardId)} className="text-xs font-bold text-grass-600 hover:underline">Save</button>
                          <button onClick={() => setEditingPrice(null)} className="text-xs text-leather-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditPrice(cardId, sellerPrice)}
                          className="text-xs font-semibold text-gold-600 flex items-center gap-1 whitespace-nowrap hover:underline"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {sellerPrice !== null ? formatPrice(sellerPrice) : 'Set Price'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch">
                    <button
                      onClick={() => removeFromCart(cardId)}
                      className="text-leather-400 hover:text-fire-500 transition-colors p-1"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {lineTotal !== null && (
                      <span className="font-display text-base text-leather-800 tabular-nums">
                        {formatPrice(lineTotal)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="w-full lg:w-80 bg-leather-800 text-white rounded-xl p-5 shadow-card space-y-4 lg:sticky lg:top-24 flex-shrink-0">
            <h3 className="font-display text-lg text-gold-400">Acquisition Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-parchment-200">Total Items</span>
                <span className="font-bold tabular-nums">{lines.reduce((acc, l) => acc + l.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-parchment-200">Market Reference ({referenceLines.length}/{lines.length})</span>
                <span className="font-bold tabular-nums">{formatPrice(referenceTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-parchment-200">Planned acquisition ({pricedLinesCount}/{lines.length})</span>
                <span className="font-display text-xl text-gold-400 tabular-nums">{formatPrice(sellerTotal)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-leather-600 pt-2 mt-2">
                <span className="text-parchment-200">Difference ({comparableLines.length} comparable)</span>
                <span className="font-display text-xl text-gold-400 tabular-nums">
                  {comparableLines.length > 0
                    ? formatPrice(comparablePlannedTotal - comparableReferenceTotal)
                    : '—'}
                </span>
              </div>
              {referenceLoading && (
                <p role="status" className="text-xs text-parchment-300">Loading local Market Reference data…</p>
              )}
              {!referenceLoading && referenceLines.length < lines.length && (
                <p className="text-xs text-parchment-300">
                  Reference total includes only items with a fresh comparable price.
                </p>
              )}
              {!referenceLoading && comparableLines.length < Math.max(referenceLines.length, pricedLinesCount) && (
                <p className="text-xs text-parchment-300">
                  Difference uses only items with both a planned cost and a fresh Market Reference.
                </p>
              )}
              {referenceLoadFailed && (
                <p role="alert" className="text-xs text-fire-200">
                  Some Market References could not be loaded. Your local acquisition plan is unchanged.
                </p>
              )}
              <p className="text-xs text-parchment-300 pt-1 flex items-center gap-1.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-grass-400 flex-shrink-0" />
                Planned costs are stored locally; unavailable market data does not block the calculator.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
