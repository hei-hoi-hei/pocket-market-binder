import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline capabilities
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      console.log('New content available, please refresh.');
    },
    onOfflineReady() {
      console.log('App is ready for offline use.');
    },
  });
}
export {};
