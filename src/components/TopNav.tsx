import React, { useEffect, useState } from 'react';
import { Home, BookOpen, Search, Heart, ShoppingCart, Sparkles, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Settings as SettingsIcon } from 'lucide-react';

import type { ScreenId } from '@/types';
import { useNav } from '@/context/NavContext';
import { useCollection } from '@/context/CollectionContext';
import { SupabaseSyncProvider } from '@/services/sync/providers/supabase/supabaseProvider';
import { ProviderStatus } from '@/services/sync/types/sync.types';

interface TopNavProps {
  onOpenSettings: () => void;
}

const ITEMS: { id: ScreenId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'binder', label: 'Binder', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
];

export function TopNav({ onOpenSettings }: TopNavProps) {
  const { screen, go } = useNav();

  const { wishlist, cart } = useCollection();
  const [syncStatus, setSyncStatus] = useState<ProviderStatus>('OFFLINE');

  useEffect(() => {
    const provider = new SupabaseSyncProvider();
    
    const updateStatus = () => {
      setSyncStatus(provider.getProviderStatus());
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const badgeFor = (id: ScreenId): number | null => {
    if (id === 'wishlist') return wishlist.length || null;
    if (id === 'cart') return cart.length || null;
    return null;
  };

  const renderSyncIndicator = () => {
    switch (syncStatus) {
      case 'SYNCED':
        return (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/50" title="Synced with Cloud">
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Synced</span>
          </div>
        );
      case 'SYNCING':
        return (
          <div className="flex items-center gap-1.5 text-gold-400 text-xs bg-gold-950/40 px-2.5 py-1 rounded-full border border-gold-800/50 animate-pulse" title="Syncing...">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden xl:inline">Syncing</span>
          </div>
        );
      case 'OFFLINE':
        return (
          <div className="flex items-center gap-1.5 text-parchment-400 text-xs bg-parchment-900/40 px-2.5 py-1 rounded-full border border-leather-600" title="Offline Mode">
            <CloudOff className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Offline</span>
          </div>
        );
      case 'UNAVAILABLE':
      case 'AUTH_ERROR':
      default:
        return (
          <div className="flex items-center gap-1.5 text-fire-400 text-xs bg-fire-950/40 px-2.5 py-1 rounded-full border border-fire-800/50" title="Sync Unavailable">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Local Only</span>
          </div>
        );
    }
  };

  return (
    <>
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

        {/* Controls: Settings & Sync Indicator */}
        <div className="flex items-center gap-3">
          {renderSyncIndicator()}
          <button
            onClick={onOpenSettings}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-parchment-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Settings & Backup"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Gold accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
    </header>
    </>
  );
}
