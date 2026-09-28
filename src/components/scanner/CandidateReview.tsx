import { useEffect, useReducer } from 'react';
import { CheckCircle2, RefreshCw, Search, X } from 'lucide-react';
import type {
  ConfirmedScannerCandidate,
  ScannerCandidate,
  ScannerIdentificationResult,
} from '@/services/scanner/types';
import {
  candidateReviewReducer,
  confirmCandidateReviewSelection,
  getSelectedCandidate,
  initialCandidateReviewState,
} from './candidateReviewState';

interface CandidateReviewProps {
  result: ScannerIdentificationResult;
  onConfirm: (candidate: ConfirmedScannerCandidate) => void;
  onRetry: () => void;
  onCancel: () => void;
  onManualSearch: () => void;
}

function CandidateDetails({ candidate, index }: { candidate: ScannerCandidate; index: number }) {
  const fields = [
    ['Name', candidate.name],
    ['Collector number', candidate.collectorNumber],
    ['Set code', candidate.setCode],
  ] as const;

  return (
    <>
      <h3 className="font-bold text-leather-800">
        {candidate.name ?? `Recognition candidate ${index + 1}`}
      </h3>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-leather-500">{label}</dt>
            <dd className="text-leather-800">{value ?? 'Not provided (unresolved)'}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-leather-500">Confidence</dt>
          <dd className="text-leather-800">
            {candidate.confidence === undefined
              ? 'Not provided'
              : `${Math.round(candidate.confidence * 100)}% (informational only)`}
          </dd>
        </div>
      </dl>
      {candidate.evidence && candidate.evidence.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-leather-500">Recognition evidence</h4>
          <ul className="mt-1 space-y-1 text-sm text-leather-700">
            {candidate.evidence.map((item, evidenceIndex) => (
              <li key={`${item.label}-${evidenceIndex}`}>
                <span className="font-semibold">{item.label}:</span> {item.value}
                {item.confidence !== undefined && (
                  <span className="text-leather-500"> ({Math.round(item.confidence * 100)}% evidence confidence)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function StatusMessage({ result }: { result: ScannerIdentificationResult }) {
  if (result.status === 'no-match' || (result.status === 'success' && result.candidates.length === 0)) {
    return <p role="status">No recognition candidates were returned. You can retry or search the catalog manually.</p>;
  }
  if (result.status === 'unavailable') {
    return <p role="status">Recognition is unavailable: {result.reason}</p>;
  }
  if (result.status === 'error') {
    return result.message === 'Recognition was cancelled.'
      ? <p role="status">Recognition was cancelled.</p>
      : <p role="alert">Recognition could not be completed: {result.message}</p>;
  }
  return null;
}

export function CandidateReview({
  result,
  onConfirm,
  onRetry,
  onCancel,
  onManualSearch,
}: CandidateReviewProps) {
  const [state, dispatch] = useReducer(candidateReviewReducer, initialCandidateReviewState);
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [result]);

  const candidates = result.status === 'success' ? result.candidates : [];
  const selectedCandidate = getSelectedCandidate(candidates, state.selectedIndex);

  const confirmSelection = () => {
    if (!confirmCandidateReviewSelection(candidates, state.selectedIndex, onConfirm)) return;
    dispatch({ type: 'confirm' });
  };

  const cancelReview = () => {
    dispatch({ type: 'cancel' });
    onCancel();
  };

  const retryReview = () => {
    dispatch({ type: 'retry' });
    onRetry();
  };

  return (
    <section className="mt-5 rounded-xl border border-parchment-200 bg-white p-4 shadow-sm" aria-labelledby="candidate-review-title">
      <h2 id="candidate-review-title" className="font-display text-xl text-leather-800">Candidate Review</h2>
      <p className="mt-1 text-sm text-leather-600">
        Review recognition clues only. These are not confirmed catalog identities or collection entries.
      </p>

      {state.cancelled ? (
        <p className="mt-4 rounded-lg bg-parchment-100 p-3 text-sm text-leather-700" role="status">
          Candidate review cancelled.
        </p>
      ) : candidates.length > 0 ? (
        <>
          <fieldset className="mt-4 space-y-3">
            <legend className="mb-2 text-sm font-semibold text-leather-700">
              Select one candidate to review its recognition information
            </legend>
            {candidates.map((candidate, index) => (
              <label
                key={index}
                className={`block cursor-pointer rounded-lg border p-3 ${
                  state.selectedIndex === index
                    ? 'border-gold-500 bg-gold-50'
                    : 'border-parchment-200 hover:border-leather-300'
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="scanner-candidate"
                    value={index}
                    checked={state.selectedIndex === index}
                    onChange={() => dispatch({ type: 'select', index })}
                    className="mt-1 accent-leather-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mb-2 inline-block rounded-full bg-parchment-100 px-2 py-0.5 text-xs font-semibold text-leather-600">
                      Recognition candidate — not catalog identity
                    </span>
                    <CandidateDetails candidate={candidate} index={index} />
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="mt-3 text-xs text-leather-500">
            Confidence is informational; no score confirms a card or replaces your review.
          </p>
          <button
            type="button"
            onClick={confirmSelection}
            disabled={!selectedCandidate}
            className="mt-4 w-full rounded-lg bg-leather-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-leather-800 disabled:cursor-not-allowed disabled:bg-leather-300"
          >
            Confirm selected candidate
          </button>
          {state.confirmedIndex !== null && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-gold-300 bg-gold-50 p-3 text-sm text-leather-700" role="status">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gold-700" />
              Candidate confirmed for a future catalog identity step. No catalog ID was assigned and no collection was changed.
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-lg bg-parchment-100 p-3 text-sm text-leather-700">
          <StatusMessage result={result} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={retryReview}
          className="inline-flex items-center gap-2 rounded-lg bg-parchment-200 px-3 py-2 text-sm font-semibold text-leather-700 hover:bg-parchment-300"
        >
          <RefreshCw className="h-4 w-4" /> Retry / replace picture
        </button>
        <button
          type="button"
          onClick={cancelReview}
          className="inline-flex items-center gap-2 rounded-lg bg-parchment-200 px-3 py-2 text-sm font-semibold text-leather-700 hover:bg-parchment-300"
        >
          <X className="h-4 w-4" /> Cancel review
        </button>
        <button
          type="button"
          onClick={onManualSearch}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gold-700 hover:underline"
        >
          <Search className="h-4 w-4" /> Search catalog manually
        </button>
      </div>
    </section>
  );
}
