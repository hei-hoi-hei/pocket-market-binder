import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ScannerScreen } from '../ScannerScreen';

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

describe('ScannerScreen', () => {
  it('keeps manual catalog search available while identification is unavailable', () => {
    const markup = renderToStaticMarkup(createElement(ScannerScreen));

    expect(markup).toContain('Identification is not available yet.');
    expect(markup).toContain('Prefer manual catalog search? Browse cards');
  });
});
