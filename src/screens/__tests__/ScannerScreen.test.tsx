import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ScannerCandidate } from '@/services/scanner/types';
import { ScannerScreen } from '../ScannerScreen';

const reviewFixture = vi.hoisted(() => ({
  candidate: { name: 'Pikachu', confidence: 0.5 },
}));

vi.mock('@/hooks/useImageAcquisition', () => ({
  useImageAcquisition: () => ({
    image: null,
    error: null,
    selectFile: vi.fn(),
    clearImage: vi.fn(),
    handlePreviewError: vi.fn(),
  }),
}));

vi.mock('@/context/NavContext', () => ({
  useNav: () => ({ go: vi.fn() }),
}));

vi.mock('@/components/scanner/CandidateReview', () => ({
  CandidateReview: ({
    result,
    onConfirm,
  }: {
    result: { status: string };
    onConfirm: (candidate: ScannerCandidate) => void;
  }) => {
    if (result.status === 'success') onConfirm(reviewFixture.candidate);
    return createElement('section', null, 'Candidate Review');
  },
}));

describe('ScannerScreen', () => {
  it('keeps manual catalog search available while identification is unavailable', () => {
    const markup = renderToStaticMarkup(createElement(ScannerScreen));

    expect(markup).toContain('Identification is not available yet.');
    expect(markup).toContain('Prefer manual catalog search? Browse cards');
  });

  it('renders Candidate Review only for an explicitly supplied normalized result and forwards confirmation', () => {
    const onCandidateConfirmed = vi.fn();
    const markup = renderToStaticMarkup(createElement(ScannerScreen, {
      reviewResult: {
        status: 'success',
        candidates: [{ name: 'Pikachu', confidence: 0.5 }],
      },
      onCandidateConfirmed,
    }));

    expect(markup).toContain('Candidate Review');
    expect(markup).toContain('Identification is not available yet.');
    expect(onCandidateConfirmed).toHaveBeenCalledOnce();
    expect(onCandidateConfirmed).toHaveBeenCalledWith(reviewFixture.candidate);
  });
});
