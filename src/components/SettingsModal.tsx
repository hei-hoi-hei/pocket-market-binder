import React, { useState, useEffect } from 'react';
import { X, Download, Upload, Database, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { exportUserData, importUserData } from '@/services/dataPortabilityService';
import { getBinder, getWishlist, getCart } from '@/services/collectionService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [currency, setCurrency] = useState<string>('USD');
  const [stats, setStats] = useState({ binderCount: 0, wishlistCount: 0, cartCount: 0 });
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getBinder(), getWishlist(), getCart()]).then(([b, w, c]) => {
        setStats({ binderCount: b.length, wishlistCount: w.length, cartCount: c.length });
      });
      const savedCurrency = localStorage.getItem('pmb:currency') || 'USD';
      setCurrency(savedCurrency);
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
    } catch (e) {
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
      } catch (err: any) {
        setMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleCurrencyChange = (newCurr: string) => {
    setCurrency(newCurr);
    localStorage.setItem('pmb:currency', newCurr);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-leather-800 border border-leather-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-parchment-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-leather-700 bg-leather-900/50">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-gold-400" />
            <h2 className="font-display text-lg text-white">Settings & Data Portability</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-parchment-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <div className="p-3 rounded-lg bg-leather-900 border border-gold-500/30 text-gold-300 text-sm">
              {message}
            </div>
          )}

          {/* Storage Stats */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Local Storage Usage
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
            <label className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Currency Preference
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['USD', 'EUR', 'PHP', 'JPY'].map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleCurrencyChange(curr)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    currency === curr 
                      ? 'bg-gold-500 text-leather-900 border-gold-400' 
                      : 'bg-leather-900 text-parchment-300 border-leather-700 hover:bg-leather-700'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Export Backup
            </label>
            <button
              onClick={handleExport}
              className="w-full py-2.5 px-4 bg-leather-900 hover:bg-leather-700 border border-leather-600 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-gold-400" /> Download Collection JSON
            </button>
          </div>

          {/* Import */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Import Backup
            </label>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-parchment-400">Mode:</span>
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${importMode === 'merge' ? 'bg-gold-500 text-leather-900 border-gold-400' : 'bg-leather-900 text-parchment-400 border-leather-700'}`}
              >
                Merge
              </button>
              <button
                type="button"
                onClick={() => setImportMode('overwrite')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${importMode === 'overwrite' ? 'bg-fire-500 text-white border-fire-400' : 'bg-leather-900 text-parchment-400 border-leather-700'}`}
              >
                Overwrite
              </button>
            </div>
            <label className="w-full py-2.5 px-4 bg-leather-900 hover:bg-leather-700 border border-leather-600 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Upload className="w-4 h-4 text-gold-400" /> Select JSON File to Import
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

