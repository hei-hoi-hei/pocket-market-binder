import type { Card } from '@/types';
import { CardArtwork } from './CardArtwork';
import { getCardTypeStyle, RARITY_STYLES, rarityLabel } from '@/utils/format';
import { useCollection } from '@/context/CollectionContext';
import { useNav } from '@/context/NavContext';
import { Heart, CheckCircle2, Star } from 'lucide-react';

interface Props {
  card: Card;
  /** Show the owned-quantity badge. */
  showOwned?: boolean;
  /** Show the wishlist heart. */
  showWishlist?: boolean;
  className?: string;
}

/**
 * A binder-grid card tile — tapping opens the detail screen.
 * Displays a small owned-quantity badge and wishlist indicator.
 */
export function CardThumb({ card, showOwned = true, showWishlist = false, className = '' }: Props) {
  const { getQuantity, isInWishlist } = useCollection();
  const { go } = useNav();
  const qty = getQuantity(card.id);
  const wished = isInWishlist(card.id);
  const style = getCardTypeStyle(card);
  const rarity = RARITY_STYLES[card.rarity];

  return (
    <button
      type="button"
      onClick={() => go('detail', card.id)}
      className={`group relative block w-full text-left animate-fade-in ${className}`}
      aria-label={`${card.name}, ${rarityLabel(card.rarity)} ${style.label} type`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
        <CardArtwork card={card} quality="low" className="w-full h-full" />

        {/* Type strip */}
        <div className={`absolute left-0 top-0 ${style.bg} ${style.text} px-1.5 py-0.5 rounded-br-lg text-[10px] font-bold uppercase tracking-wide z-10 shadow-xs`}>
          {style.label}
        </div>

        {/* Rarity badge */}
        <div className={`absolute right-1 top-1 ${rarity.badge} px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 z-10 shadow-xs`}>
          {card.rarity === 'holo' || card.rarity === 'ultra' ? <Star className="w-2.5 h-2.5" /> : null}
          {rarityLabel(card.rarity)}
        </div>

        {/* Owned badge */}
        {showOwned && qty > 0 && (
          <div className="absolute bottom-1 left-1 bg-leather-800/90 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 animate-pop z-10 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-grass-400" />
            {qty}
          </div>
        )}

        {/* Wishlist badge */}
        {showWishlist && wished && (
          <div className="absolute bottom-1 right-1 bg-white/90 text-psychic-500 p-1 rounded-full shadow-sm z-10">
            <Heart className="w-3.5 h-3.5 fill-psychic-500" />
          </div>
        )}
      </div>

      {/* Name strip */}
      <div className="mt-1.5 px-0.5 min-w-0">
        <p className="text-sm font-bold text-leather-800 truncate leading-tight">{card.name}</p>
        <p className="text-[11px] text-leather-500 truncate leading-tight">
          {card.genus || (card.setCode ? `${card.setCode} #${card.setNumber}` : card.setNumber)}
        </p>
      </div>
    </button>
  );
}


