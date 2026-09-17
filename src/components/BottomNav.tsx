import { Home, BookOpen, Search, Heart, ShoppingCart } from 'lucide-react';
import type { ScreenId } from '@/types';
import { useNav } from '@/context/NavContext';
import { useCollection } from '@/context/CollectionContext';

const ITEMS: { id: ScreenId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'binder', label: 'Binder', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
];

export function BottomNav() {
  const { screen, go } = useNav();
  const { wishlist, cart } = useCollection();

  const badgeFor = (id: ScreenId): number | null => {
    if (id === 'wishlist') return wishlist.length || null;
    if (id === 'cart') return cart.length || null;
    return null;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-leather-800/95 backdrop-blur-md border-t border-leather-600 safe-bottom lg:hidden">
      <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl flex items-stretch justify-around px-2">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = screen === id;
          const badge = badgeFor(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 transition-colors ${
                active ? 'text-gold-400' : 'text-parchment-300 hover:text-parchment-100'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} strokeWidth={active ? 2.5 : 2} />
                {badge !== null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-fire-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
              {active && <div className="absolute -top-px h-0.5 w-8 bg-gold-400 rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
