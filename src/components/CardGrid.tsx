import type { Card } from '@/types';
import { CardThumb } from './CardThumb';

interface Props {
  cards: Card[];
  showOwned?: boolean;
  showWishlist?: boolean;
  emptyMessage?: string;
}

/** Responsive binder-style grid of card tiles. */
export function CardGrid({ cards, showOwned = true, showWishlist = false, emptyMessage = 'No cards yet.' }: Props) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-parchment-200 flex items-center justify-center mb-3">
          <span className="text-2xl text-leather-400">?</span>
        </div>
        <p className="text-leather-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {cards.map((card) => (
        <CardThumb
          key={card.id}
          card={card}
          showOwned={showOwned}
          showWishlist={showWishlist}
        />
      ))}
    </div>
  );
}
