import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type { Card } from '@/types';
import { catalogService } from '@/services/catalogService';
import { createPerceptualHashDescriptor } from '@/services/scanner/localReferenceMatcher';
import {
  scannerReferenceStore,
  type ScannerRecognitionReference,
} from '@/services/scanner/scannerReferenceStore';
import {
  confirmScannerCandidate,
  type ScannerCandidate,
} from '@/services/scanner/types';

interface ReferenceEnrollmentProps {
  image: Blob | null;
  onClose: () => void;
}

type CatalogScannerCandidate = ScannerCandidate & {
  catalogProvider: string;
  catalogId: string;
  gameKey: string;
};

const VARIANT_OPTIONS = [
  { key: 'normal', value: 'normal', label: 'Normal' },
  { key: 'reverse', value: 'reverse', label: 'Reverse holo' },
  { key: 'holo', value: 'holo', label: 'Holo' },
  { key: 'firstEdition', value: 'firstEdition', label: 'First edition' },
] as const;

function availableVariants(card: Card) {
  return VARIANT_OPTIONS.filter(({ key }) => card.variants?.[key]);
}

function getCatalogProvider(card: Card): string | undefined {
  if (card.catalogArtwork?.provider) return card.catalogArtwork.provider;
  return Object.entries(card.identity?.providerIds ?? {})
    .find(([, ids]) => ids?.includes(card.id))?.[0];
}

function candidateForCard(card: Card, variant?: string): CatalogScannerCandidate | null {
  const catalogProvider = getCatalogProvider(card);
  if (!catalogProvider) return null;
  return {
    catalogProvider,
    catalogId: card.id,
    gameKey: 'pokemon',
    name: card.name,
    collectorNumber: card.identity?.cardNumber ?? card.setNumber,
    setCode: card.identity?.setId ?? card.setCode,
    language: card.identity?.language,
    variant: variant ?? card.identity?.variant,
    provider: 'manual-catalog-search',
    providers: ['manual-catalog-search'],
  };
}

function cardSummary(card: Card): string {
  return `${card.setName ?? card.setCode} #${card.setNumber}`;
}

export function ReferenceEnrollment({ image, onClose }: ReferenceEnrollmentProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [references, setReferences] = useState<ScannerRecognitionReference[]>([]);
  const [checkingReferences, setCheckingReferences] = useState(false);
  const [referenceLookupFailed, setReferenceLookupFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const searchRequest = useRef(0);
  const referenceRequest = useRef(0);

  const variants = selectedCard ? availableVariants(selectedCard) : [];
  const selectedCandidate = selectedCard
    ? candidateForCard(selectedCard, selectedVariant || undefined)
    : null;
  const activeReference = references.find((reference) => reference.state === 'active');
  const inactiveReferences = references.filter((reference) => reference.state === 'retired');

  useEffect(() => () => {
    searchRequest.current += 1;
    referenceRequest.current += 1;
  }, []);

  const clearSelection = () => {
    referenceRequest.current += 1;
    setSelectedCard(null);
    setSelectedVariant('');
    setReferences([]);
    setCheckingReferences(false);
    setReferenceLookupFailed(false);
    setError(null);
    setMessage(null);
  };

  const loadReferences = async (card: Card, variant?: string) => {
    const requestId = ++referenceRequest.current;
    const candidate = candidateForCard(card, variant);
    setReferences([]);
    setError(null);
    setMessage(null);
    setReferenceLookupFailed(false);
    if (!candidate) {
      setCheckingReferences(false);
      setReferenceLookupFailed(true);
      setError('This catalog card cannot be used as a recognition reference.');
      return;
    }
    if (availableVariants(card).length > 1 && !variant) {
      setCheckingReferences(false);
      return;
    }

    setCheckingReferences(true);
    try {
      const found = await scannerReferenceStore.listByIdentity(candidate);
      if (requestId === referenceRequest.current) setReferences(found);
    } catch {
      if (requestId === referenceRequest.current) {
        setReferenceLookupFailed(true);
        setError('Could not check for an existing recognition reference. Please try again.');
      }
    } finally {
      if (requestId === referenceRequest.current) setCheckingReferences(false);
    }
  };

  const searchCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchText = query.trim();
    if (!searchText) {
      setError('Enter a card name, set, or number to search the catalog.');
      return;
    }
    const requestId = ++searchRequest.current;
    setSearching(true);
    setResults([]);
    clearSelection();
    try {
      const cards = await catalogService.search({ query: searchText });
      if (requestId === searchRequest.current) {
        setResults(cards);
        if (cards.length === 0) setMessage('No catalog cards matched that search.');
      }
    } catch {
      if (requestId === searchRequest.current) setError('Catalog search is unavailable. Please try again.');
    } finally {
      if (requestId === searchRequest.current) setSearching(false);
    }
  };

  const selectCard = (card: Card) => {
    const options = availableVariants(card);
    const variant = card.identity?.variant ?? (options.length === 1 ? options[0].value : '');
    setSelectedCard(card);
    setSelectedVariant(variant);
    setReferences([]);
    setError(null);
    setMessage(null);
    if (options.length <= 1 || variant) void loadReferences(card, variant || undefined);
  };

  const handleVariantChange = (variant: string) => {
    setSelectedVariant(variant);
    if (selectedCard) void loadReferences(selectedCard, variant || undefined);
  };

  const refreshReferences = async (candidate: CatalogScannerCandidate) => {
    const found = await scannerReferenceStore.listByIdentity(candidate);
    setReferences(found);
    return found;
  };

  const saveReference = async () => {
    if (!image || image.size === 0 || !image.type.toLowerCase().startsWith('image/')) {
      setError('Choose a valid card photo before saving a recognition reference.');
      return;
    }
    if (!selectedCard || !selectedCandidate || (variants.length > 1 && !selectedVariant)) {
      setError('Select the exact catalog card and printing before saving a reference.');
      return;
    }
    if (checkingReferences || referenceLookupFailed) return;
    if (activeReference) {
      setMessage('This card already has a recognition reference.');
      return;
    }
    if (references.length > 0) {
      setMessage('An inactive recognition reference exists. Reactivate or replace it explicitly.');
      return;
    }
    if (!window.confirm(`Confirm ${selectedCard.name} (${cardSummary(selectedCard)}) is the exact card in the photo and save it as a recognition reference?`)) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const descriptor = await createPerceptualHashDescriptor(image);
      const saved = await scannerReferenceStore.saveConfirmedReference(
        confirmScannerCandidate(selectedCandidate),
        descriptor,
        { confirmationMethod: 'manual-catalog-search', ownershipScope: 'local' },
      );
      setReferences([saved]);
      setMessage('Recognition reference saved.');
    } catch {
      try {
        const found = await refreshReferences(selectedCandidate);
        if (found.some((reference) => reference.state === 'active')) {
          setMessage('This card already has a recognition reference.');
          return;
        }
        if (found.length > 0) {
          setMessage('An inactive recognition reference exists. Reactivate or replace it explicitly.');
          return;
        }
      } catch {
        // The save failure remains the useful user-facing error when lookup fails too.
      }
      setError('Could not save the recognition reference. No photo was retained; please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reactivateReference = async (reference: ScannerRecognitionReference) => {
    if (!selectedCard || !window.confirm(`Reactivate the existing recognition reference for ${selectedCard.name}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await scannerReferenceStore.reactivate(reference.referenceId);
      if (selectedCandidate) await refreshReferences(selectedCandidate);
      setMessage('Recognition reference reactivated.');
    } catch {
      setError('Could not reactivate the recognition reference. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const replaceReference = async (reference: ScannerRecognitionReference) => {
    if (!image || !selectedCard || !selectedCandidate) return;
    if (!window.confirm(`Replace the existing recognition reference for ${selectedCard.name} with this photo?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const descriptor = await createPerceptualHashDescriptor(image);
      await scannerReferenceStore.replace(
        reference.referenceId,
        confirmScannerCandidate(selectedCandidate),
        descriptor,
        { confirmationMethod: 'manual-catalog-search', ownershipScope: 'local' },
      );
      if (selectedCandidate) await refreshReferences(selectedCandidate);
      setMessage('Recognition reference replaced.');
    } catch {
      setError('Could not replace the recognition reference. The existing reference was kept.');
    } finally {
      setBusy(false);
    }
  };

  if (!image || image.size === 0 || !image.type.toLowerCase().startsWith('image/')) {
    return (
      <section className="mt-4 rounded-xl border border-fire-200 bg-fire-50 p-4" aria-label="Save as recognition reference">
        <p role="alert" className="text-sm text-fire-700">Choose a valid card photo before saving a recognition reference.</p>
        <button type="button" onClick={onClose} className="mt-3 text-sm font-semibold text-leather-700">Cancel</button>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-parchment-200 bg-white p-4 shadow-sm" aria-labelledby="reference-enrollment-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="reference-enrollment-title" className="font-display text-lg text-leather-800">Save as recognition reference</h2>
          <p className="mt-1 text-sm text-leather-600">This helps Pocket Market Binder recognize this card in future scans.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cancel reference enrollment" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-leather-500 hover:bg-parchment-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={(event) => void searchCatalog(event)} className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="reference-catalog-search" className="sr-only">Search catalog for the exact card</label>
        <input
          id="reference-catalog-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Card name, set, or number"
          className="min-w-0 flex-1 rounded-lg border border-parchment-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={searching} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-parchment-200 px-3 text-sm font-semibold text-leather-700 disabled:opacity-60">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search cards
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto" aria-label="Catalog results">
          {results.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                aria-label={`Select ${card.name}, ${cardSummary(card)}`}
                onClick={() => selectCard(card)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-parchment-200 px-3 py-2 text-left hover:bg-parchment-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-leather-800">{card.name}</span>
                  <span className="block truncate text-xs text-leather-500">{cardSummary(card)}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-gold-700">Select</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedCard && (
        <div className="mt-4 border-t border-parchment-200 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-leather-800">Confirm the exact card</h3>
              <p className="mt-1 text-sm text-leather-700">{selectedCard.name} · {cardSummary(selectedCard)}</p>
            </div>
            <button type="button" onClick={clearSelection} className="text-xs font-semibold text-gold-700 hover:underline">Choose another card</button>
          </div>
          {variants.length > 1 && (
            <label className="mt-3 block text-xs font-semibold text-leather-600">
              Printing / variant
              <select
                aria-label="Printing / variant"
                value={selectedVariant}
                onChange={(event) => handleVariantChange(event.target.value)}
                className="mt-1 block min-h-10 w-full rounded-lg border border-parchment-300 bg-white px-3 text-sm"
              >
                <option value="">Select the exact printing</option>
                {variants.map((variant) => <option key={variant.value} value={variant.value}>{variant.label}</option>)}
              </select>
            </label>
          )}
          <p className="mt-3 text-xs text-leather-500">Confirm that this is the exact card and printing in your photo. Only a compact reference is saved; the photo itself is temporary.</p>

          {checkingReferences ? (
            <p className="mt-3 text-sm text-leather-500" role="status">Checking existing references...</p>
          ) : referenceLookupFailed ? (
            <button type="button" onClick={() => void loadReferences(selectedCard, selectedVariant || undefined)} className="mt-3 min-h-10 rounded-lg bg-parchment-200 px-3 text-sm font-semibold text-leather-700">
              Retry reference check
            </button>
          ) : activeReference ? (
            <p className="mt-3 rounded-lg border border-gold-300 bg-gold-50 p-3 text-sm text-leather-800" role="status">
              This card already has a recognition reference.
            </p>
          ) : inactiveReferences.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-leather-700">An inactive recognition reference exists. Choose whether to reactivate it or replace it.</p>
              {inactiveReferences.map((reference) => (
                <div key={reference.referenceId} className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void reactivateReference(reference)} className="min-h-10 rounded-lg bg-parchment-200 px-3 text-sm font-semibold text-leather-700 disabled:opacity-60">
                    Reactivate existing reference
                  </button>
                  <button type="button" disabled={busy} onClick={() => void replaceReference(reference)} className="min-h-10 rounded-lg border border-fire-300 px-3 text-sm font-semibold text-fire-700 disabled:opacity-60">
                    Replace existing recognition reference
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || checkingReferences || referenceLookupFailed || !selectedCandidate || (variants.length > 1 && !selectedVariant)}
              onClick={() => void saveReference()}
              className="mt-3 min-h-10 rounded-lg bg-leather-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving reference...' : 'Confirm card and save reference'}
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-fire-700" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm text-grass-700" role="status">{message}</p>}
    </section>
  );
}
