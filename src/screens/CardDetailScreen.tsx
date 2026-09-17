import { useState } from 'react';
import {
  ArrowLeft, Heart, ShoppingCart, BookOpen, Trash2, Plus, Minus, CheckCircle2, Star, Coins,
} from 'lucide-react';
import type { CartEntry } from '@/types';
import { catalogService } from '@/services/catalogService';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { CardArtwork } from '@/components/CardArtwork';
import { EnergyBadge } from '@/components/EnergyBadge';
import { QuantityStepper } from '@/components/QuantityStepper';
import { ENERGY_STYLES, RARITY_STYLES, rarityLabel, formatPrice } from '@/utils/format';

export function CardDetailScreen() {
  const { detailCardId, go } = useNav();
  const card = detailCardId ? catalogService.getById(detailCardId) : undefined;
  const { getQuantity, setBinderQuantity, addToBinder, isInWishlist, addToWishlist, removeFromWishlist, addToCart, cart } = useCollection();
  const [sellerPrice, setSellerPrice] = useState<string>('');

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
  const style = ENERGY_STYLES[card.energyType];
  const rarity = RARITY_STYLES[card.rarity];
  const cartEntry = cart.find((e: CartEntry) => e.cardId === card.id);
  const parsedSeller = sellerPrice !== '' ? parseFloat(sellerPrice) : null;
  const validSeller = parsedSeller !== null && !isNaN(parsedSeller) && parsedSeller >= 0;

  return (
    <div className="animate-fade-in pb-4">
      {/* Back */}
      <button
        onClick={() => go('search')}
        className="flex items-center gap-1 text-sm font-semibold text-leather-600 hover:text-leather-800 mb-3 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row gap-5">
        {/* Card artwork */}
        <div className="flex-shrink-0 mx-auto sm:mx-0 w-48 sm:w-56">
          <CardArtwork card={card} className="aspect-[3/4] w-full" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rarity.badge} flex items-center gap-0.5`}>
              {(card.rarity === 'holo' || card.rarity === 'ultra') && <Star className="w-2.5 h-2.5" />}
              {rarityLabel(card.rarity)}
            </span>
            <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase`}>{style.label}</span>
          </div>
          <h2 className="font-display text-2xl text-leather-800 leading-tight">{card.name}</h2>
          <p className="text-sm text-leather-500 italic mb-3">{card.genus}</p>

          {/* Quick facts */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white rounded-lg p-2 text-center border border-parchment-200">
              <p className="text-[10px] uppercase font-semibold text-leather-400">HP</p>
              <p className="font-display text-lg text-leather-800">{card.hp}</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-parchment-200">
              <p className="text-[10px] uppercase font-semibold text-leather-400">Ref Price</p>
              <p className="font-display text-lg text-gold-600">{formatPrice(card.refPrice)}</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-parchment-200">
              <p className="text-[10px] uppercase font-semibold text-leather-400">Set</p>
              <p className="font-display text-sm text-leather-800">{card.setCode}-{card.setNumber}</p>
            </div>
          </div>

          {/* Attacks */}
          <div className="space-y-2 mb-4">
            {card.attacks.map((atk, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-parchment-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {atk.energyCost.map((e, j) => <EnergyBadge key={j} type={e} size="sm" />)}
                    <span className="font-bold text-sm text-leather-800 ml-1">{atk.name}</span>
                  </div>
                  <span className="font-display text-lg text-fire-500">{atk.damage}</span>
                </div>
                <p className="text-xs text-leather-500">{atk.text}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-leather-400 italic mb-4">"{card.flavor}"</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 space-y-3">
        {/* Binder quantity */}
        <div className="bg-white rounded-xl p-4 border border-parchment-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-leather-600" />
              <span className="font-bold text-sm text-leather-800">In Binder</span>
              {qty > 0 && (
                <span className="bg-leather-800 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
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
              className="mt-2 text-xs font-semibold text-fire-500 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Remove from binder
            </button>
          )}
        </div>

        {/* Wishlist + Cart row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => (wished ? removeFromWishlist(card.id) : addToWishlist(card.id))}
            className={`rounded-xl p-3 border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
              wished
                ? 'bg-psychic-500 border-psychic-500 text-white'
                : 'bg-white border-parchment-300 text-leather-700 hover:border-psychic-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${wished ? 'fill-white' : ''}`} />
            {wished ? 'Wishlisted' : 'Add to Wishlist'}
          </button>

          <button
            onClick={() => addToCart(card.id, 1, validSeller ? parsedSeller : null)}
            className="rounded-xl p-3 border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-gold-400 border-gold-400 text-leather-800 hover:bg-gold-500 hover:border-gold-500"
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </button>
        </div>

        {/* Seller price input */}
        <div className="bg-white rounded-xl p-4 border border-parchment-200 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-wide text-leather-500 flex items-center gap-1.5 mb-2">
            <Coins className="w-4 h-4 text-gold-500" /> Optional Seller Price
          </label>
          <div className="flex items-center gap-2">
            <span className="text-leather-500 font-bold">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={sellerPrice}
              onChange={(e) => setSellerPrice(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-parchment-100 border-2 border-parchment-300 rounded-lg px-3 py-2 text-sm font-medium text-leather-800 placeholder:text-leather-400 focus:border-gold-400 focus:outline-none"
            />
            <button
              onClick={() => validSeller && addToCart(card.id, cartEntry ? cartEntry.quantity : 1, parsedSeller)}
              disabled={!validSeller}
              className="bg-leather-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-leather-500 transition-colors active:scale-95 disabled:opacity-30"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-leather-400 mt-1.5">
            Enter a price you found from a seller. Used in the cart to compare against the reference price.
          </p>
          {cartEntry && (
            <p className="text-[11px] text-grass-600 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> In cart: {cartEntry.quantity} × {cartEntry.sellerPrice != null ? formatPrice(cartEntry.sellerPrice) : 'no seller price'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
