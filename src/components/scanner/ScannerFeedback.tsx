import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, Search } from 'lucide-react';
import type { Card } from '@/types';
import { catalogService } from '@/services/catalogService';
import type { ScannerIdentificationResult } from '@/services/scanner/types';
import {
  createScannerFeedbackReport,
  scannerFeedbackFilename,
  serializeScannerFeedbackReport,
} from '@/services/scanner/scannerFeedback';
import type {
  ScannerFeedbackCatalogIdentity,
  ScannerFeedbackImageDimensions,
  ScannerFeedbackOutcome,
} from '@/services/scanner/scannerFeedback';

interface ScannerFeedbackProps {
  result: ScannerIdentificationResult;
  matcherId: string;
  processingDurationMs?: number;
  imageDimensions?: ScannerFeedbackImageDimensions;
  allowCancelled?: boolean;
}

const OUTCOME_OPTIONS: Array<{ outcome: ScannerFeedbackOutcome; label: string }> = [
  { outcome: 'correct', label: 'Correct' },
  { outcome: 'incorrect', label: 'Wrong card' },
  { outcome: 'no-match', label: 'No match' },
  { outcome: 'processing-error', label: 'Error' },
];

const VARIANT_OPTIONS = [
  { key: 'normal', value: 'normal', label: 'Normal' },
  { key: 'reverse', value: 'reverse', label: 'Reverse holo' },
  { key: 'holo', value: 'holo', label: 'Holo' },
  { key: 'firstEdition', value: 'firstEdition', label: 'First edition' },
] as const;

function getCatalogProvider(card: Card): string | undefined {
  if (card.catalogArtwork?.provider) return card.catalogArtwork.provider;
  return Object.entries(card.identity?.providerIds ?? {})
    .find(([, ids]) => ids?.includes(card.id))?.[0];
}

function getCardSummary(card: Card): string {
  return `${card.setName ?? card.setCode} #${card.setNumber}`;
}

export function ScannerFeedback({
  result,
  matcherId,
  processingDurationMs,
  imageDimensions,
  allowCancelled = false,
}: ScannerFeedbackProps) {
  const [outcome, setOutcome] = useState<ScannerFeedbackOutcome | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRequest = useRef(0);

  const variants = selectedCard
    ? VARIANT_OPTIONS.filter(({ key }) => selectedCard.variants?.[key])
    : [];
  const catalogProvider = selectedCard ? getCatalogProvider(selectedCard) : undefined;
  const confirmedIdentity: ScannerFeedbackCatalogIdentity | undefined = selectedCard && catalogProvider
    ? {
        catalogProvider,
        catalogId: selectedCard.id,
        ...(selectedCard.category === 'pokemon' ? { gameKey: 'pokemon' } : {}),
        ...(selectedCard.identity?.language ? { language: selectedCard.identity.language } : {}),
        ...(selectedVariant ? { variant: selectedVariant } : {}),
      }
    : undefined;

  useEffect(() => () => {
    searchRequest.current += 1;
  }, []);

  useEffect(() => {
    setOutcome(null);
    setQuery('');
    setResults([]);
    setSelectedCard(null);
    setSelectedVariant('');
    setSubmitted(false);
    setError(null);
    searchRequest.current += 1;
  }, [result]);

  const chooseOutcome = (nextOutcome: ScannerFeedbackOutcome) => {
    setOutcome(nextOutcome);
    setError(null);
    if (nextOutcome !== 'incorrect') {
      setSelectedCard(null);
      setSelectedVariant('');
    }
  };

  const searchCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchText = query.trim();
    if (!searchText) {
      setError('Enter a name, set, or collector number to search the catalog.');
      return;
    }
    const requestId = ++searchRequest.current;
    setSearching(true);
    setResults([]);
    setSelectedCard(null);
    setSelectedVariant('');
    setError(null);
    try {
      const cards = await catalogService.search({ query: searchText });
      if (requestId === searchRequest.current) setResults(cards);
    } catch {
      if (requestId === searchRequest.current) {
        setError('Catalog search is unavailable. Feedback can still be exported without a confirmed card ID.');
      }
    } finally {
      if (requestId === searchRequest.current) setSearching(false);
    }
  };

  const downloadReport = () => {
    if (!outcome) return;
    try {
      const report = createScannerFeedbackReport({
        result,
        outcome,
        matcherId,
        ...(outcome === 'incorrect' && confirmedIdentity ? { confirmedIdentity } : {}),
        processingDurationMs,
        imageDimensions,
      });
      const blob = new Blob([serializeScannerFeedbackReport(report)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = scannerFeedbackFilename(report);
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setSubmitted(true);
      setError(null);
    } catch {
      setError('Could not create the feedback file. No photo was saved or sent.');
    }
  };

  if (submitted) {
    return (
      <section className="mt-4 border-t border-parchment-200 pt-4" aria-label="Scanner feedback">
        <p className="text-sm font-semibold text-grass-700" role="status">
          Feedback JSON downloaded locally. It was not uploaded and contains no photo.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 border-t border-parchment-200 pt-4" aria-labelledby="scanner-feedback-title">
      <h2 id="scanner-feedback-title" className="text-sm font-bold text-leather-800">Report this scanner result</h2>
      <p className="mt-1 text-xs text-leather-600">
        Export a metadata-only JSON file. The photo is not attached, stored, or sent.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Scanner result feedback">
        {[...OUTCOME_OPTIONS, ...(allowCancelled ? [{ outcome: 'cancelled' as const, label: 'Cancelled' }] : [])]
          .map(({ outcome: option, label }) => (
            <button
              key={option}
              type="button"
              aria-pressed={outcome === option}
              onClick={() => chooseOutcome(option)}
              className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${outcome === option
                ? 'border-leather-700 bg-leather-700 text-white'
                : 'border-parchment-300 bg-white text-leather-700 hover:bg-parchment-100'}`}
            >
              {label}
            </button>
          ))}
      </div>

      {outcome === 'incorrect' && (
        <div className="mt-3">
          <p className="text-xs text-leather-600">Optionally select the correct catalog printing. This does not change your collection.</p>
          <form onSubmit={(event) => void searchCatalog(event)} className="mt-2 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="scanner-feedback-catalog-search">Search catalog for the correct card</label>
            <input
              id="scanner-feedback-catalog-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Card name, set, or number"
              className="min-w-0 flex-1 rounded-lg border border-parchment-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-parchment-200 px-3 text-sm font-semibold text-leather-700 disabled:opacity-60"
            >
              <Search className="h-4 w-4" /> Search catalog
            </button>
          </form>
          {results.length > 0 && (
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto" aria-label="Catalog results for feedback">
              {results.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    aria-pressed={selectedCard?.id === card.id}
                    onClick={() => {
                      setSelectedCard(card);
                      const available = VARIANT_OPTIONS.filter(({ key }) => card.variants?.[key]);
                      setSelectedVariant(card.identity?.variant ?? (available.length === 1 ? available[0].value : ''));
                    }}
                    className="w-full rounded-lg border border-parchment-200 px-3 py-2 text-left text-sm hover:bg-parchment-50"
                  >
                    <span className="font-semibold text-leather-800">{card.name}</span>
                    <span className="ml-2 text-xs text-leather-500">{getCardSummary(card)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedCard && (
            <div className="mt-2 rounded-lg bg-parchment-50 p-3">
              <p className="text-sm font-semibold text-leather-800">Selected: {selectedCard.name} · {getCardSummary(selectedCard)}</p>
              {variants.length > 1 && (
                <label className="mt-2 block text-xs font-semibold text-leather-600">
                  Printing / variant
                  <select
                    aria-label="Feedback printing / variant"
                    value={selectedVariant}
                    onChange={(event) => setSelectedVariant(event.target.value)}
                    className="mt-1 block min-h-10 w-full rounded-lg border border-parchment-300 bg-white px-3 text-sm"
                  >
                    <option value="">Unspecified</option>
                    {variants.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-fire-700" role="alert">{error}</p>}
      <button
        type="button"
        disabled={!outcome}
        onClick={downloadReport}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-leather-700 px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        <Download className="h-4 w-4" /> Download feedback JSON
      </button>
    </section>
  );
}
