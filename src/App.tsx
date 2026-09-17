import { NavProvider, useNav } from '@/context/NavContext';
import { CollectionProvider } from '@/context/CollectionContext';
import { BottomNav } from '@/components/BottomNav';
import { TopNav } from '@/components/TopNav';
import { HomeScreen } from '@/screens/HomeScreen';
import { BinderScreen } from '@/screens/BinderScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { CardDetailScreen } from '@/screens/CardDetailScreen';
import { WishlistScreen } from '@/screens/WishlistScreen';
import { CartScreen } from '@/screens/CartScreen';

function ScreenRouter() {
  const { screen } = useNav();

  switch (screen) {
    case 'home': return <HomeScreen />;
    case 'binder': return <BinderScreen />;
    case 'search': return <SearchScreen />;
    case 'detail': return <CardDetailScreen />;
    case 'wishlist': return <WishlistScreen />;
    case 'cart': return <CartScreen />;
    default: return <HomeScreen />;
  }
}

function AppShell() {
  return (
    <div className="min-h-screen binder-bg flex flex-col">
      <TopNav />
      
      {/* Top accent bar — only on mobile/tablet since TopNav has its own on desktop */}
      <div className="h-1 bg-gradient-to-r from-leather-700 via-gold-500 to-leather-700 safe-top lg:hidden" />

      {/* Main content — responsive container widths */}
      <main className="mx-auto w-full max-w-md md:max-w-3xl lg:max-w-6xl xl:max-w-screen-xl 2xl:max-w-screen-2xl px-4 pt-4 pb-24 lg:pb-12 flex-1">
        <ScreenRouter />
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <NavProvider>
      <CollectionProvider>
        <AppShell />
      </CollectionProvider>
    </NavProvider>
  );
}
