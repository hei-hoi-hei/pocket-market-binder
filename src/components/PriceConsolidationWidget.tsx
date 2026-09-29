import { useState, useEffect } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, ShieldAlert, Layers, Coins } from 'lucide-react';
import type { Card } from '@/types';
import type { ConsolidatedPrice } from '@/services/engine/types';
import { pricingService } from '@/services/pricingService';
import {
  formatCanonicalPriceForDisplay,
  formatCurrency,
  isSupportedCurrency,
} from '@/services/currencyService';
import {
  CURRENCY_PREFERENCE_CHANGE_EVENT,
  readCurrencyPreference,
  type CurrencyPreference,
} from '@/services/currencyPreference';

interface Props {
  card: Card;
}

export function PriceConsolidationWidget({ card }: Props) {
  const [data, setData] = useState<ConsolidatedPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyPreference>(readCurrencyPreference);

  useEffect(() => {
    const updateCurrency = () => setDisplayCurrency(readCurrencyPreference());
    window.addEventListener(CURRENCY_PREFERENCE_CHANGE_EVENT, updateCurrency);
    window.addEventListener('storage', updateCurrency);
    return () => {
      window.removeEventListener(CURRENCY_PREFERENCE_CHANGE_EVENT, updateCurrency);
      window.removeEventListener('storage', updateCurrency);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    pricingService.getConsolidatedPrice(card).then((res) => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [card]);

  if (loading) {
    return <div className="p-4 bg-white rounded-xl border border-parchment-200">Loading price reference...</div>;
  }

  const isDivergent = data?.status === 'high_divergence' || data?.status === 'review';
  const displayPrice = data?.value !== null && data?.value !== undefined
    ? formatCanonicalPriceForDisplay(data.value, displayCurrency)
    : null;
  const displayConversion = displayPrice?.conversion ?? null;
  const displayStatements = data ? [
    ...data.explanation.statements,
    `Display currency: ${displayCurrency}.`,
    displayConversion?.status === 'converted' && displayCurrency !== data.currency
      ? `Final Market Reference converted from ${data.currency} using ${displayConversion.exchangeRate.rate.toPrecision(6)} ${displayConversion.exchangeRate.quoteCurrency} per ${displayConversion.exchangeRate.baseCurrency}; rate source: ${displayConversion.exchangeRate.source} (${displayConversion.exchangeRate.kind}).`
      : data.value === null
        ? 'No Market Reference amount is available to convert.'
        : `No final currency conversion was required; calculation and display currency are ${data.currency}.`,
    ...(displayConversion?.status === 'converted' && displayConversion.exchangeRate.effectiveAt
      ? [`Rate effective: ${new Date(displayConversion.exchangeRate.effectiveAt).toLocaleString()}.`]
      : []),
    ...(displayConversion?.status === 'converted' && displayConversion.exchangeRate.fetchedAt
      ? [`Rate fetched: ${new Date(displayConversion.exchangeRate.fetchedAt).toLocaleString()}.`]
      : []),
    ...(displayConversion?.status === 'unsupported'
      ? [`Display conversion unavailable: ${displayConversion.reason}`]
      : []),
  ] : [];

  return (
    <div className="bg-white rounded-2xl p-5 border border-parchment-200 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-gold-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-leather-600">Market Reference</span>
            {data && data.status === 'high_divergence' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-fire-100 text-fire-700 border border-fire-200">
                <AlertTriangle className="w-3 h-3 text-fire-500" /> High Variation
              </span>
            )}
            {data && data.status === 'review' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-100 text-leather-800 border border-gold-300">
                <Info className="w-3 h-3 text-gold-600" /> Moderate Spread
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            {data && data.value !== null && displayConversion?.status === 'converted' ? (
              <>
                <span className="font-display text-3xl font-bold text-leather-800">{displayPrice?.formatted}</span>
                <span className="text-xs text-leather-500 font-semibold">
                  {data.method === 'single_source' ? 'Single comparable observation' : `Based on ${data.comparableObservationCount} comparable observations`}
                </span>
              </>
            ) : data && data.value !== null ? (
              <span className="text-sm font-bold text-fire-700">
                Display price unavailable in {displayCurrency}: {displayConversion?.status === 'unsupported' ? displayConversion.reason : 'conversion failed'}
              </span>
            ) : (
              <span className="text-sm font-bold text-leather-500">No fresh comparable market data available</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm ${
            isDivergent ? 'bg-fire-50 text-fire-700 hover:bg-fire-100 border border-fire-200' : 'bg-parchment-100 text-leather-700 hover:bg-parchment-200 border border-parchment-300'
          }`}
        >
          {open ? <>Hide details <ChevronUp className="w-4 h-4" /></> : <>{isDivergent ? '⚠ Why this price?' : 'Why this price?'} <ChevronDown className="w-4 h-4" /></>}
        </button>
      </div>

      {open && (
        <div className="mt-5 pt-4 border-t border-parchment-200 space-y-4 animate-fade-in">
          {data && data.status === 'high_divergence' && (
            <div className="p-3 bg-fire-50 border border-fire-200 rounded-xl flex items-start gap-3 text-fire-800 text-xs">
              <ShieldAlert className="w-5 h-5 text-fire-500 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block mb-0.5">High Source Variation Detected</strong>
                Price references vary significantly across available sources. The displayed consolidated price represents the central reference calculated by Pocket Market Binder; individual source values are retained below for transparency.
              </div>
            </div>
          )}

          {data && (
            <>
              <div className="bg-parchment-50 rounded-xl p-3 border border-parchment-200 text-xs">
                <h4 className="font-bold text-leather-700 mb-2">Why this price?</h4>
                <ul className="space-y-1 text-leather-600">
                  {displayStatements.map((statement, index) => <li key={index}>{statement}</li>)}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-leather-500 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-leather-400" /> All Provider Observations ({data.observations.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {data.observations.map((obs, idx) => {
                    const exclusion = data.excludedObservations.find((item) => item.observation === obs);
                    const listingId = obs.metadata?.providerListingId ?? obs.metadata?.idProduct;
                    return (
                      <div key={idx} className="p-2.5 rounded-xl border bg-white border-parchment-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-leather-800 capitalize">{obs.source}</span>
                            <span className="text-parchment-400">•</span>
                            <span className="text-leather-600 capitalize">{obs.market}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-parchment-100 text-leather-600 font-medium capitalize">{obs.priceType}</span>
                          </div>
                          <div className="font-mono font-bold text-leather-800">
                            {isSupportedCurrency(obs.currency)
                              ? formatCurrency(obs.price, obs.currency)
                              : `${obs.currency} ${obs.price.toFixed(2)}`}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-leather-400">
                          {obs.observedAt > 0 && <span>Observed: {new Date(obs.observedAt).toLocaleDateString()}</span>}
                          {obs.fetchedAt > 0 && <span>Fetched: {new Date(obs.fetchedAt).toLocaleDateString()}</span>}
                          {obs.variant && <span>Variant: {obs.variant}</span>}
                          {obs.condition && <span>Condition: {obs.condition}</span>}
                          {obs.isGraded !== undefined && <span>{obs.isGraded ? 'Graded' : 'Raw'}</span>}
                          {listingId !== undefined && <span>Listing: {String(listingId)}</span>}
                        </div>
                        <div className={`mt-1 text-[10px] font-semibold ${exclusion ? 'text-fire-600' : 'text-emerald-700'}`}>
                          {exclusion
                            ? `Excluded: ${exclusion.reason.replace(/-/g, ' ')}${exclusion.detail ? ` — ${exclusion.detail}` : ''}`
                            : 'Included in reference'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
