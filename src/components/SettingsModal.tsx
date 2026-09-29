import React, { useState, useEffect } from 'react';
import { X, Download, Upload, Database, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { exportUserData, importUserData } from '@/services/dataPortabilityService';
import { getBinder, getWishlist, getCart } from '@/services/collectionService';
import {
  CURRENCY_OPTIONS,
  readCurrencyPreference,
  writeCurrencyPreference,
  type CurrencyPreference,
} from '@/services/currencyPreference';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [currency, setCurrency] = useState<CurrencyPreference>('USD');
  const [stats, setStats] = useState({ binderCount: 0, wishlistCount: 0, cartCount: 0 });
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getBinder(), getWishlist(), getCart()]).then(([b, w, c]) => {
        setStats({ binderCount: b.length, wishlistCount: w.length, cartCount: c.length });
      });
      setCurrency(readCurrencyPreference());
    }
  }, [isOpen]);
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);


  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pocket-market-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export completed successfully.');
    } catch {
      setMessage('Export failed.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await importUserData(content, importMode);
        setMessage('Import completed successfully.');
        const [b, w, c] = await Promise.all([getBinder(), getWishlist(), getCart()]);
        setStats({ binderCount: b.length, wishlistCount: w.length, cartCount: c.length });
      } catch (error: unknown) {
        setMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleCurrencyChange = (newCurrency: CurrencyPreference) => {
    try {
      writeCurrencyPreference(newCurrency);
      setCurrency(newCurrency);
      setMessage(null);
    } catch {
      setMessage('Could not save currency preference. Check browser storage availability and try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div 
        className="flex w-full min-w-0 max-w-md max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-leather-600 bg-leather-800 text-parchment-200 shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-leather-700 bg-leather-900/50 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <SettingsIcon className="h-5 w-5 shrink-0 text-gold-400" />
            <h2 className="min-w-0 break-words font-display text-base leading-tight text-white sm:text-lg">Settings & Data Portability</h2>
          </div>
          <button type="button" aria-label="Close settings" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-parchment-400 hover:bg-white/10 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="space-y-6">
          {message && (
            <div role="status" className="break-words rounded-lg border border-gold-500/30 bg-leather-900 p-3 text-sm text-gold-300">
              {message}
            </div>
          )}

          {/* Storage Stats */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
              <Database className="h-4 w-4 shrink-0" /> Local Storage Usage
            </label>
            <div className="grid grid-cols-3 gap-2 bg-leather-900 p-3 rounded-xl border border-leather-700 text-center text-xs">
              <div>
                <div className="text-white font-bold text-sm">{stats.binderCount}</div>
                <div className="text-parchment-400">Binder Items</div>
              </div>
              <div>
                <div className="text-white font-bold text-sm">{stats.wishlistCount}</div>
                <div className="text-parchment-400">Wishlist</div>
              </div>
              <div>
                <div className="text-white font-bold text-sm">{stats.cartCount}</div>
                <div className="text-parchment-400">Cart</div>
              </div>
            </div>
          </div>
          {/* Currency Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
              <DollarSign className="h-4 w-4 shrink-0" /> Currency Preference
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENCY_OPTIONS.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleCurrencyChange(curr)}
                  className={`min-h-11 whitespace-nowrap rounded-xl border px-2 py-2 text-xs font-bold transition-all ${
                    currency === curr 
                      ? 'bg-gold-500 text-leather-900 border-gold-400' 
                      : 'bg-leather-900 text-parchment-300 border-leather-700 hover:bg-leather-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-parchment-400">
              Your preference is saved locally. Market Reference display uses static fallback exchange rates, not live rates.
            </p>
          </div>

          {/* Export */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
              <Download className="h-4 w-4 shrink-0" /> Export Backup
            </label>
            <button
              onClick={handleExport}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-leather-600 bg-leather-900 px-4 py-2.5 text-center text-sm font-bold leading-snug text-white transition-colors hover:bg-leather-700"
            >
              <Download className="w-4 h-4 text-gold-400" /> Download Collection JSON
            </button>
          </div>

          {/* Import */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-400">
              <Upload className="h-4 w-4 shrink-0" /> Import Backup
            </label>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-parchment-400">Mode:</span>
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`min-h-11 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold ${importMode === 'merge' ? 'bg-gold-500 text-leather-900 border-gold-400' : 'bg-leather-900 text-parchment-400 border-leather-700'}`}
              >
                Merge
              </button>
              <button
                type="button"
                onClick={() => setImportMode('overwrite')}
                className={`min-h-11 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold ${importMode === 'overwrite' ? 'bg-fire-500 text-white border-fire-400' : 'bg-leather-900 text-parchment-400 border-leather-700'}`}
              >
                Overwrite
              </button>
            </div>
            <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-leather-600 bg-leather-900 px-4 py-2.5 text-center text-sm font-bold leading-snug text-white transition-colors hover:bg-leather-700">
              <Upload className="h-4 w-4 shrink-0 text-gold-400" /> <span className="break-words">Select JSON File to Import</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
