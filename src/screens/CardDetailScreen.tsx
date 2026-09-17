import { useState, useEffect } from 'react';
import {
  ArrowLeft, Heart, ShoppingCart, Trash2, Star, Coins, CheckCircle2, BookOpen,
} from 'lucide-react';
import type { CartEntry, Card } from '@/types';
import { catalogService } from '@/services/catalogService';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { CardArtwork } from '@/components/CardArtwork';
import { QuantityStepper } from '@/components/QuantityStepper';
import { RARITY_STYLES, rarityLabel, formatPrice, getCardTypeStyle } from '@/utils/format';

export function CardDetailScreen() {
  const { detailCardId, go } = useNav();
  const { getQuantity, setBinderQuantity, addToBinder, isInWishlist, addToWishlist, removeFromWishlist, addToCart, cart } = useCollection();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellerPrice, setSellerPrice] = useState<string>('');

  useEffect(() => {
    if (detailCardId) {
      catalogService.getById(detailCardId).then((c) => {
        setCard(c ?? null);
        setLoading(false);
      });
    }
  }, [detailCardId]);

  if (loading) return <div className="p-8 text-center text-leather-500">Loading...</div>;

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-leather-500 mb-3">Card not found.</p>
        <button onClick={() => go('search')} className="text-gold-600 font-semibold hover:underline">Back to Search</button>
      </div>
    );
  }

  const qty = getQuantity(card.id);
  const wished = isInWishlist(card.id);
  const style = getCardTypeStyle(card);
  const rarity = RARITY_STYLES[card.rarity];
  const cartEntry = cart.find((e: CartEntry) => e.cardId === card.id);
  const parsedSeller = sellerPrice !== '' ? parseFloat(sellerPrice) : null;
  const validSeller = parsedSeller !== null && !isNaN(parsedSeller) && parsedSeller >= 0;

  return (
    <div className="animate-fade-in pb-4 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => go('search')}
        className="flex items-center gap-1 text-sm font-semibold text-leather-600 hover:text-leather-800 mb-4 -ml-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Search
      </button>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Card artwork */}
        <div className="flex-shrink-0 mx-auto lg:mx-0 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[384px]">
          <CardArtwork card={card} quality="high" className="aspect-[3/4] w-full shadow-2xl rounded-2xl" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${rarity.badge} flex items-center gap-1 shadow-sm`}>
              {(card.rarity === 'holo' || card.rarity === 'ultra') && <Star className="w-3 h-3" />}
              {rarityLabel(card.rarity)}
            </span>
            <span className={`${style.bg} ${style.text} px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase shadow-sm`}>{style.label}</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-leather-800 leading-tight mb-1">{card.name}</h2>
          <p className="text-base text-leather-500 italic mb-6">{card.genus}</p>

          {/* Quick facts */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3 text-center border border-parchment-200 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-leather-400 mb-1">HP</p>
              <p className="text-sm font-bold text-leather-700">{card.hp ?? '-'}</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-parchment-200 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-leather-400 mb-1">Set</p>
              <p className="text-xs font-bold text-leather-700 truncate">{card.setName ?? card.setCode}</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-parchment-200 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-bold text-leather-400 mb-1">Number</p>
              <p className="text-sm font-bold text-leather-700">{card.setNumber}</p>
            </div>
          </div>

          {/* Attacks */}
          {card.attacks && card.attacks.length > 0 && (
            <div className="space-y-3 mb-6">
              {card.attacks.map((atk, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-parchment-200 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {atk.energyCost?.map((e, j) => (
                        <span key={j} className="text-[10px] bg-parchment-200 text-leather-700 px-2 py-0.5 rounded font-bold uppercase">{e}</span>
                      ))}
                      <span className="font-display text-base text-leather-800 ml-1">{atk.name}</span>
                    </div>
                    <span className="font-display text-xl text-fire-500">{atk.damage}</span>
                  </div>
                  <p className="text-xs text-leather-500 leading-relaxed">{atk.text}</p>
                </div>
              ))}
            </div>
          )}

          {card.flavor && (
            <div className="mb-6 p-4 bg-parchment-100/50 rounded-xl border border-parchment-200/50">
              <p className="text-xs text-leather-400 italic text-center">"{card.flavor}"</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {/* Binder Control */}
        <div className="bg-white rounded-2xl p-5 border border-parchment-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-parchment-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-leather-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-leather-800">In My Binder</h3>
                <p className="text-xs text-leather-400">Manage copies in collection</p>
              </div>
              {qty > 0 && (
                <span className="bg-leather-800 text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-grass-400" /> {qty} owned
                </span>
              )}
            </div>
            <QuantityStepper
              value={qty}
              min={0}
              onDecrease={() => setBinderQuantity(card.id, Math.max(0, qty - 1))}
              onIncrease={() => addToBinder(card.id, 1)}
            />
          </div>
          {qty > 0 && (
            <button
              onClick={() => setBinderQuantity(card.id, 0)}
              className="w-full mt-2 py-2 text-xs font-semibold text-fire-500 bg-fire-50 rounded-lg hover:bg-fire-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove all from binder
            </button>
          )}
        </div>

        {/* Wishlist + Cart row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => (wished ? removeFromWishlist(card.id) : addToWishlist(card.id))}
            className={`rounded-2xl p-4 border-2 font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-sm ${
              wished
                ? 'bg-psychic-500 border-psychic-500 text-white shadow-psychic-200'
                : 'bg-white border-parchment-300 text-leather-700 hover:border-psychic-400 hover:text-psychic-600'
            }`}
          >
            <Heart className={`w-5 h-5 ${wished ? 'fill-white' : ''}`} />
            {wished ? 'In Wishlist' : 'Add to Wishlist'}
          </button>

          <button
            onClick={() => addToCart(card.id, 1, validSeller ? parsedSeller : null)}
            className="rounded-2xl p-4 border-2 font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95 bg-gold-400 border-gold-400 text-leather-800 hover:bg-gold-500 hover:border-gold-500 shadow-sm shadow-gold-200"
          >
            <ShoppingCart className="w-5 h-5" /> Add to Cart
          </button>
        </div>

        {/* Seller price input */}
        <div className="bg-white rounded-2xl p-5 border border-parchment-200 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-widest text-leather-500 flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-gold-500" /> Marketplace Tracking
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-400 font-bold">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={sellerPrice}
                onChange={(e) => setSellerPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-parchment-100 border-2 border-parchment-300 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-leather-800 placeholder:text-leather-300 focus:border-gold-400 focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => validSeller && addToCart(card.id, cartEntry ? cartEntry.quantity : 1, parsedSeller)}
              disabled={!validSeller}
              className="bg-leather-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-leather-600 transition-all active:scale-95 disabled:opacity-30 shadow-md"
            >
              Save Price
            </button>
          </div>
          <p className="text-xs text-leather-400 mt-3 leading-relaxed">
            Enter a price you found from a seller. Used in the cart to compare against the market reference price.
          </p>
          {cartEntry && (
            <div className="bg-grass-50 border border-grass-100 rounded-lg p-2 mt-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-grass-500" />
              <p className="text-xs text-grass-700 font-bold">
                In cart: {cartEntry.quantity} × {cartEntry.sellerPrice != null ? formatPrice(cartEntry.sellerPrice) : 'no seller price'}
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
