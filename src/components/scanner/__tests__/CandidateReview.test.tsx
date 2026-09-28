import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateReview } from '../CandidateReview';
import {
  candidateReviewReducer,
  confirmCandidateReviewSelection,
  getSelectedCandidate,
  initialCandidateReviewState,
} from '../candidateReviewState';
import type { ScannerCandidate, ScannerIdentificationResult } from '@/services/scanner/types';

const pikachu: ScannerCandidate = {
  name: 'Pikachu',
  collectorNumber: '025',
  setCode: 'SVP',
  confidence: 0.42,
  evidence: [
    { label: 'printed name', value: 'Pikachu', confidence: 0.88 },
    { label: 'collector number', value: '025' },
  ],
  metadata: { sourceModel: 'fixture' },
};

const eevee: ScannerCandidate = {
  name: 'Eevee',
  confidence: 0.12,
};

const defaultActions = {
  onConfirm: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
  onManualSearch: vi.fn(),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderReview(result: ScannerIdentificationResult): string {
  return renderToStaticMarkup(createElement(CandidateReview, {
    result,
    ...defaultActions,
  }));
}

describe('CandidateReview', () => {
  it('handles zero candidates with retry and manual catalog search options', () => {
    const markup = renderReview({ status: 'no-match', candidates: [] });

    expect(markup).toContain('No recognition candidates were returned');
    expect(markup).toContain('Retry / replace picture');
    expect(markup).toContain('Cancel review');
    expect(markup).toContain('Search catalog manually');
  });

  it('renders a single candidate as an unconfirmed recognition clue', () => {
    const markup = renderReview({ status: 'success', candidates: [pikachu] });

    expect(markup).toContain('Candidate Review');
    expect(markup).toContain('Pikachu');
    expect(markup).toContain('Recognition candidate — not catalog identity');
    expect(markup).toContain('Confirm selected candidate');
    expect(markup).toContain('disabled=""');
  });

  it('renders multiple candidates independently for selection', () => {
    const markup = renderReview({ status: 'success', candidates: [pikachu, eevee] });

    expect(markup).toContain('Pikachu');
    expect(markup).toContain('Eevee');
    expect((markup.match(/type="radio"/g) ?? []).length).toBe(2);
  });

  it('tracks one selected candidate without treating selection as confirmation', () => {
    const selected = candidateReviewReducer(initialCandidateReviewState, { type: 'select', index: 1 });

    expect(selected).toEqual({ selectedIndex: 1, confirmedIndex: null, cancelled: false });
    expect(getSelectedCandidate([pikachu, eevee], selected.selectedIndex)).toBe(eevee);
  });

  it('requires explicit confirmation and returns only the selected candidate', () => {
    const unselected = candidateReviewReducer(initialCandidateReviewState, { type: 'confirm' });
    expect(unselected.confirmedIndex).toBeNull();

    const selected = candidateReviewReducer(initialCandidateReviewState, { type: 'select', index: 1 });
    const confirmed = candidateReviewReducer(selected, { type: 'confirm' });
    const output = getSelectedCandidate([pikachu, eevee], confirmed.confirmedIndex);

    expect(confirmed.confirmedIndex).toBe(1);
    expect(output).toBe(eevee);
    expect(output).not.toHaveProperty('cardId');
    expect(output).not.toHaveProperty('id');
  });

  it('emits the candidate only from the explicit confirmation action', () => {
    const onConfirm = vi.fn();

    expect(confirmCandidateReviewSelection([pikachu], null, onConfirm)).toBeUndefined();
    expect(onConfirm).not.toHaveBeenCalled();

    const confirmed = confirmCandidateReviewSelection([pikachu], 0, onConfirm);

    expect(confirmed).toBe(pikachu);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith(pikachu);
    expect(onConfirm.mock.calls[0][0]).not.toHaveProperty('cardId');
  });

  it('supports cancellation and retry/replace state transitions', () => {
    const selected = candidateReviewReducer(initialCandidateReviewState, { type: 'select', index: 0 });
    const cancelled = candidateReviewReducer(selected, { type: 'cancel' });

    expect(cancelled).toEqual({ selectedIndex: null, confirmedIndex: null, cancelled: true });
    expect(candidateReviewReducer(cancelled, { type: 'retry' })).toEqual(initialCandidateReviewState);
    expect(renderReview({ status: 'error', message: 'Recognition was cancelled.', retryable: false }))
      .toContain('Recognition was cancelled.');
  });

  it('shows provider unavailable and error states without creating candidates', () => {
    expect(renderReview({
      status: 'unavailable',
      reason: 'No offline recognition engine is configured.',
      source: 'offline',
    })).toContain('Recognition is unavailable: No offline recognition engine is configured.');
    expect(renderReview({
      status: 'error',
      message: 'Provider failed.',
      source: 'test-provider',
    })).toContain('Recognition could not be completed: Provider failed.');
  });

  it('labels incomplete candidate details as unresolved and displays low confidence informationally', () => {
    const markup = renderReview({ status: 'success', candidates: [eevee] });

    expect(markup).toContain('Name');
    expect(markup).toContain('Eevee');
    expect(markup).toContain('Not provided (unresolved)');
    expect(markup).toContain('12% (informational only)');
    expect(markup).toContain('no score confirms a card');
  });

  it('displays available name, collector number, set code, confidence, and evidence', () => {
    const markup = renderReview({ status: 'success', candidates: [pikachu] });

    expect(markup).toContain('Collector number');
    expect(markup).toContain('025');
    expect(markup).toContain('Set code');
    expect(markup).toContain('SVP');
    expect(markup).toContain('42% (informational only)');
    expect(markup).toContain('printed name');
    expect(markup).toContain('88% evidence confidence');
  });

  it('does not make network or collection callback calls while rendering candidate review', () => {
    const fetchRequest = vi.fn();
    const xhrRequest = vi.fn();
    const storageWrite = vi.fn();
    vi.stubGlobal('fetch', fetchRequest);
    vi.stubGlobal('XMLHttpRequest', xhrRequest);
    vi.stubGlobal('localStorage', { setItem: storageWrite });

    renderReview({ status: 'success', candidates: [pikachu] });

    expect(fetchRequest).not.toHaveBeenCalled();
    expect(xhrRequest).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(defaultActions.onConfirm).not.toHaveBeenCalled();
    expect(defaultActions.onRetry).not.toHaveBeenCalled();
    expect(defaultActions.onCancel).not.toHaveBeenCalled();
    expect(defaultActions.onManualSearch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
