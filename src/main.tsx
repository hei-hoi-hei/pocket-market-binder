import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './pwa'; // Import PWA registration
import { v1ToV2Migrator } from './services/sync/migration/v1ToV2Migrator';
import { SyncEngine } from './services/sync/engine/syncEngine';
import { SupabaseSyncProvider } from './services/sync/providers/supabase/supabaseProvider';

// App Boot Initialization
async function initializeApp() {
  try {
    // 1. Run migration idempotently on boot
    await v1ToV2Migrator.migrate();

    // 2. Setup background sync engine & network listeners
    const provider = new SupabaseSyncProvider();
    const engine = new SyncEngine(provider);

    // Initial sync attempt
    engine.sync().catch(() => {});

    window.addEventListener('online', () => {
      engine.sync().catch(() => {});
    });
  } catch (e) {
    console.error('App initialization sync/migration error:', e);
  }
}

initializeApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
