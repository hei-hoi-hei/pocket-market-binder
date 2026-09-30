import { useCallback, useEffect, useState } from 'react';
import { NavProvider, useNav } from '@/context/NavContext';
import { CollectionProvider, useCollection } from '@/context/CollectionContext';
import { BottomNav } from '@/components/BottomNav';
import { TopNav } from '@/components/TopNav';
import { SettingsModal } from '@/components/SettingsModal';
import { HomeScreen } from '@/screens/HomeScreen';
import { BinderScreen } from '@/screens/BinderScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { CardDetailScreen } from '@/screens/CardDetailScreen';
import { WishlistScreen } from '@/screens/WishlistScreen';
import { CartScreen } from '@/screens/CartScreen';
import { ScannerScreen } from '@/screens/ScannerScreen';
import { subscribeToRestoredCameraAcquisition } from '@/services/scanner/capacitorCameraAcquisition';
import { isConfirmedScannerCandidate } from '@/services/scanner/types';
import type { ConfirmedScannerCandidate } from '@/services/scanner/types';

function ScreenRouter({ onScannerCandidateConfirmed }: {
  onScannerCandidateConfirmed: (candidate: ConfirmedScannerCandidate) => void;
}) {
  const { screen } = useNav();

  switch (screen) {
    case 'home': return <HomeScreen />;
    case 'binder': return <BinderScreen />;
    case 'search': return <SearchScreen />;
    case 'scanner': return <ScannerScreen onCandidateConfirmed={onScannerCandidateConfirmed} />;
    case 'detail': return <CardDetailScreen />;
    case 'wishlist': return <WishlistScreen />;
    case 'cart': return <CartScreen />;
    default: return <HomeScreen />;
  }
}

function AppShell() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { go } = useNav();
  const { addToBinder } = useCollection();

  const handleScannerCandidateConfirmed = useCallback((candidate: ConfirmedScannerCandidate) => {
    if (
      !isConfirmedScannerCandidate(candidate) ||
      candidate.catalogProvider !== 'tcgdex'
    ) return;
    const cardId = candidate.catalogId?.trim();
    if (!cardId) return;
    void addToBinder(cardId).catch((error: unknown) => {
      console.error('Unable to add the confirmed scanner candidate to the Binder.', error);
    });
  }, [addToBinder]);

  useEffect(() => subscribeToRestoredCameraAcquisition(() => go('scanner')), [go]);

  return (
    <div className="min-h-screen binder-bg flex flex-col">
      <TopNav onOpenSettings={() => setIsSettingsOpen(true)} />
      
      {/* Top accent bar — only on mobile/tablet since TopNav has its own on desktop */}
      <div className="h-1 bg-gradient-to-r from-leather-700 via-gold-500 to-leather-700 safe-top lg:hidden" />

      {/* Main content — responsive container widths */}
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-24 flex-1 md:max-w-3xl lg:max-w-6xl lg:pb-12 xl:max-w-screen-xl 2xl:max-w-screen-2xl">
        <ScreenRouter onScannerCandidateConfirmed={handleScannerCandidateConfirmed} />
      </main>

      <BottomNav onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
