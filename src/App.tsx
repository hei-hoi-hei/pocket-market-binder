import { NavProvider, useNav } from '@/context/NavContext';
import { CollectionProvider } from '@/context/CollectionContext';
import { BottomNav } from '@/components/BottomNav';
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
    <div className="min-h-screen binder-bg">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-leather-700 via-gold-500 to-leather-700 safe-top" />

      {/* Main content — constrained for mobile, centered on larger screens */}
      <main className="mx-auto max-w-md px-4 pt-4 pb-24 min-h-screen">
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
