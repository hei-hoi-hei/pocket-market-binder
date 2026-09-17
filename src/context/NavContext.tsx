import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ScreenId } from '@/types';

interface NavState {
  screen: ScreenId;
  /** Optional card id for the detail screen. */
  detailCardId: string | null;
  go: (screen: ScreenId, cardId?: string) => void;
}

const NavContext = createContext<NavState | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  const go = useCallback((target: ScreenId, cardId?: string) => {
    if (target === 'detail' && cardId) {
      setDetailCardId(cardId);
    } else {
      setDetailCardId(null);
    }
    setScreen(target);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <NavContext.Provider value={{ screen, detailCardId, go }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavState {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
