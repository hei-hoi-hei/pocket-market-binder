import { Home, BookOpen, Search, Heart, ShoppingCart, Sparkles } from 'lucide-react';
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

export function TopNav() {
  const { screen, go } = useNav();
  const { wishlist, cart } = useCollection();

  const badgeFor = (id: ScreenId): number | null => {
    if (id === 'wishlist') return wishlist.length || null;
    if (id === 'cart') return cart.length || null;
    return null;
  };

  return (
    <header className="hidden lg:block sticky top-0 z-50 bg-leather-800 border-b border-leather-600 shadow-md">
      <div className="mx-auto max-w-screen-2xl px-6 h-16 flex items-center justify-between">
        {/* Logo/Brand */}
        <button 
          onClick={() => go('home')}
          className="flex items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="bg-gold-500 p-1.5 rounded-lg group-hover:bg-gold-400 transition-colors">
            <Sparkles className="w-5 h-5 text-leather-800" />
          </div>
          <span className="font-display text-xl text-white tracking-wide">
            Pocket Market <span className="text-gold-400">Binder</span>
          </span>
        </button>

        {/* Desktop Links */}
        <nav className="flex items-center gap-1 h-full">
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = screen === id;
            const badge = badgeFor(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className={`relative px-4 h-16 flex items-center gap-2 font-bold text-sm transition-all group ${
                  active 
                    ? 'text-gold-400' 
                    : 'text-parchment-300 hover:text-white hover:bg-white/5'
                }`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 ${active ? 'scale-110' : ''} transition-transform`} strokeWidth={active ? 2.5 : 2} />
                  {badge !== null && badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-fire-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 ring-2 ring-leather-800">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
                {active && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gold-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
      {/* Gold accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
    </header>
  );
}
