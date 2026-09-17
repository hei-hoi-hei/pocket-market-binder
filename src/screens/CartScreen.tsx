import { useState } from 'react';
import {
  ShoppingCart, Trash2, X, Coins, TrendingUp, TrendingDown, Minus, Plus, CheckCircle2,
} from 'lucide-react';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { catalogService } from '@/services/catalogService';
import { CardArtwork } from '@/components/CardArtwork';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ENERGY_STYLES, formatPrice } from '@/utils/format';

interface CartLine {
  cardId: string;
  name: string;
  genus: string;
  energyType: keyof typeof ENERGY_STYLES;
  refPrice: number;
  quantity: number;
  sellerPrice: number | null;
}

export function CartScreen() {
  const { cart, updateCartEntry, removeFromCart, clearCart } = useCollection();
  const { go } = useNav();
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const lines: CartLine[] = cart
    .map((e) => {
      const card = catalogService.getById(e.cardId);
      if (!card) return null;
      return {
        cardId: e.cardId,
        name: card.name,
        genus: card.genus,
        energyType: card.energyType,
        refPrice: card.refPrice,
        quantity: e.quantity,
        sellerPrice: e.sellerPrice ?? null,
      };
    })
    .filter((l): l is CartLine => l !== null);

  const refTotal = lines.reduce((sum, l) => sum + l.refPrice * l.quantity, 0);
  const sellerLines = lines.filter((l) => l.sellerPrice !== null && l.sellerPrice >= 0);
  const sellerTotal = sellerLines.reduce((sum, l) => sum + (l.sellerPrice ?? 0) * l.quantity, 0);
  const difference = sellerTotal - refTotal;
  const hasSellerPrices = sellerLines.length > 0;

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
        <p className="text-sm text-leather-500">Compare reference prices with seller offers.</p>
      </ScreenHeader>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-parchment-200 flex items-center justify-center mb-3">
            <ShoppingCart className="w-8 h-8 text-leather-400" />
          </div>
          <p className="text-leather-500 text-sm mb-3">Your cart is empty.</p>
          <button
            onClick={() => go('search')}
            className="bg-leather-600 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-leather-500 transition-colors active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" /> Browse Cards
          </button>
        </div>
      ) : (
        <>
          {/* Line items */}
          <div className="space-y-2.5 mb-4">
            {lines.map((line) => {
              const style = ENERGY_STYLES[line.energyType];
              const lineRef = line.refPrice * line.quantity;
              const lineSeller = line.sellerPrice !== null ? line.sellerPrice * line.quantity : null;
              const lineDiff = lineSeller !== null ? lineSeller - lineRef : null;
              const card = catalogService.getById(line.cardId)!;

              return (
                <div key={line.cardId} className="bg-white rounded-xl p-3 border border-parchment-200 shadow-sm">
                  <div className="flex gap-3">
                    {/* Mini artwork */}
                    <button onClick={() => go('detail', line.cardId)} className="flex-shrink-0">
                      <CardArtwork card={card} bare className="w-16 h-20 rounded-lg overflow-hidden border border-parchment-300" />
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button onClick={() => go('detail', line.cardId)} className="font-bold text-sm text-leather-800 hover:underline truncate block">
                            {line.name}
                          </button>
                          <p className="text-[11px] text-leather-400 truncate">{line.genus}</p>
                          <span className={`inline-block mt-0.5 ${style.bg} ${style.text} px-1.5 py-0.5 rounded text-[9px] font-bold uppercase`}>
                            {style.label}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFromCart(line.cardId)}
                          className="text-leather-400 hover:text-fire-500 transition-colors flex-shrink-0"
                          aria-label="Remove from cart"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartEntry(line.cardId, { quantity: Math.max(1, line.quantity - 1) })}
                            className="w-7 h-7 rounded-full bg-parchment-200 text-leather-700 flex items-center justify-center active:scale-90 hover:bg-parchment-300 transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-display text-base text-leather-800 min-w-[1.5em] text-center tabular-nums">{line.quantity}</span>
                          <button
                            onClick={() => updateCartEntry(line.cardId, { quantity: Math.min(99, line.quantity + 1) })}
                            className="w-7 h-7 rounded-full bg-leather-600 text-white flex items-center justify-center active:scale-90 hover:bg-leather-500 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Seller price editor */}
                      <div className="mt-2">
                        {editingPrice === line.cardId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-leather-500 text-xs font-bold">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={priceInput}
                              onChange={(e) => setPriceInput(e.target.value)}
                              autoFocus
                              className="w-20 bg-parchment-100 border border-parchment-300 rounded px-2 py-1 text-xs font-medium text-leather-800 focus:border-gold-400 focus:outline-none"
                            />
                            <button onClick={() => savePrice(line.cardId)} className="text-xs font-bold text-grass-600 hover:underline">Save</button>
                            <button onClick={() => setEditingPrice(null)} className="text-xs font-semibold text-leather-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPrice(line.cardId, line.sellerPrice)}
                            className="text-xs font-semibold text-leather-500 hover:text-gold-600 flex items-center gap-1"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            Seller: {line.sellerPrice !== null ? formatPrice(line.sellerPrice) : 'set price'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line totals */}
                  <div className="mt-2 pt-2 border-t border-parchment-200 flex items-center justify-between text-xs">
                    <span className="text-leather-500">
                      Ref: <span className="font-bold text-leather-700">{formatPrice(lineRef)}</span>
                    </span>
                    {lineSeller !== null && (
                      <span className="text-leather-500">
                        Seller: <span className="font-bold text-leather-700">{formatPrice(lineSeller)}</span>
                      </span>
                    )}
                    {lineDiff !== null && (
                      <span className={`font-bold flex items-center gap-0.5 ${lineDiff < 0 ? 'text-grass-600' : lineDiff > 0 ? 'text-fire-500' : 'text-leather-500'}`}>
                        {lineDiff < 0 ? <TrendingDown className="w-3 h-3" /> : lineDiff > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                        {lineDiff < 0 ? 'Save ' : lineDiff > 0 ? '+ ' : ''}
                        {formatPrice(Math.abs(lineDiff))}
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
                <span className="text-parchment-200">Reference Total</span>
                <span className="font-bold tabular-nums">{formatPrice(refTotal)}</span>
              </div>

              {hasSellerPrices ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-parchment-200">Seller Total {sellerLines.length < lines.length && `(${sellerLines.length}/${lines.length} priced)`}</span>
                    <span className="font-bold tabular-nums">{formatPrice(sellerTotal)}</span>
                  </div>
                  <div className="border-t border-leather-600 pt-2 flex justify-between items-center">
                    <span className="text-parchment-200">Difference</span>
                    <span className={`font-display text-lg tabular-nums flex items-center gap-1 ${difference < 0 ? 'text-grass-400' : difference > 0 ? 'text-fire-400' : 'text-parchment-200'}`}>
                      {difference < 0 ? <TrendingDown className="w-4 h-4" /> : difference > 0 ? <TrendingUp className="w-4 h-4" /> : null}
                      {difference < 0 ? '-' : difference > 0 ? '+' : ''}
                      {formatPrice(Math.abs(difference))}
                    </span>
                  </div>
                  {difference < 0 && (
                    <p className="text-xs text-grass-400 flex items-center gap-1 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> You're saving {formatPrice(Math.abs(difference))} vs. reference prices.
                    </p>
                  )}
                  {difference > 0 && (
                    <p className="text-xs text-fire-400 flex items-center gap-1 pt-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Seller prices are {formatPrice(difference)} above reference.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-parchment-300 pt-1">
                  Set seller prices on individual items to see a seller total and price comparison.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
