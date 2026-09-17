import { useState, useEffect } from 'react';
import {
  ShoppingCart, Trash2, Coins, CheckCircle2, Minus, Plus,
} from 'lucide-react';
import type { Card } from '@/types';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { catalogService } from '@/services/catalogService';
import { CardArtwork } from '@/components/CardArtwork';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatPrice, getCardTypeStyle } from '@/utils/format';

interface CartLine {
  cardId: string;
  card: Card;
  quantity: number;
  sellerPrice: number | null;
}

export function CartScreen() {
  const { cart, updateCartEntry, removeFromCart, clearCart } = useCollection();
  const { go } = useNav();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

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
          });
        }
      }
      if (active) {
        setLines(resolved);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cart]);

  const sellerTotal = lines.reduce((sum, l) => sum + (l.sellerPrice ?? 0) * l.quantity, 0);
  const pricedLinesCount = lines.filter((l) => l.sellerPrice !== null && l.sellerPrice >= 0).length;

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

  return (
    <div className="animate-fade-in pb-4">
      <ScreenHeader
        title="Shopping Cart"
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
        <p className="text-sm text-leather-500">Track prospective purchases and seller offers.</p>
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
        <>
          {/* Line items */}
          <div className="space-y-3 mb-4">
            {lines.map(({ cardId, card, quantity, sellerPrice }) => {
              const style = getCardTypeStyle(card);
              const lineTotal = sellerPrice !== null ? sellerPrice * quantity : null;

              return (
                <div key={cardId} className="bg-white rounded-xl p-3 border border-parchment-200 shadow-sm flex gap-3 items-center">
                  <div className="w-16 flex-shrink-0 cursor-pointer" onClick={() => go('detail', cardId)}>
                    <CardArtwork card={card} className="aspect-[3/4] rounded-lg" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded-full text-[9px] font-bold uppercase`}>
                        {style.label}
                      </span>
                      <span className="text-xs text-leather-400">{card.setCode}-{card.setNumber}</span>
                    </div>
                    <h4
                      onClick={() => go('detail', cardId)}
                      className="font-display text-base text-leather-800 truncate cursor-pointer hover:underline"
                    >
                      {card.name}
                    </h4>

                    <div className="flex items-center gap-3 mt-1 text-xs text-leather-600">
                      <span>Qty: <strong className="text-leather-800">{quantity}</strong></span>
                      {sellerPrice !== null ? (
                        <span>Price: <strong className="text-leather-800">{formatPrice(sellerPrice)}</strong></span>
                      ) : (
                        <span className="text-leather-400 italic">No seller price set</span>
                      )}
                    </div>

                    {/* Quantity & Price Row */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => updateCartEntry(cardId, { quantity: Math.max(1, quantity - 1) })}
                          className="w-6 h-6 rounded-full bg-parchment-200 text-leather-700 flex items-center justify-center active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-sm tabular-nums w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => updateCartEntry(cardId, { quantity: Math.min(99, quantity + 1) })}
                          className="w-6 h-6 rounded-full bg-leather-600 text-white flex items-center justify-center active:scale-90"
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
                          className="text-xs font-semibold text-gold-600 flex items-center gap-1 hover:underline"
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
          <div className="bg-leather-800 text-white rounded-xl p-4 shadow-card space-y-3 sticky bottom-16">
            <h3 className="font-display text-lg text-gold-400">Cart Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-parchment-200">Total Items</span>
                <span className="font-bold tabular-nums">{lines.reduce((acc, l) => acc + l.quantity, 0)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-leather-600 pt-2 mt-2">
                <span className="text-parchment-200">Seller Total ({pricedLinesCount}/{lines.length} priced)</span>
                <span className="font-display text-xl text-gold-400 tabular-nums">{formatPrice(sellerTotal)}</span>
              </div>
              <p className="text-xs text-parchment-300 pt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-grass-400" />
                Track offers from local or online card shops.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
