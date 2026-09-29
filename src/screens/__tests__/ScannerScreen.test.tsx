// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isConfirmedScannerCandidate } from '@/services/scanner/types';
import { ScannerScreen } from '../ScannerScreen';

const scannerMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  go: vi.fn(),
  provider: { name: 'local-reference' },
}));

vi.mock('@/services/scanner/scannerOrchestration', () => ({
  identifyImageWithProviders: scannerMocks.identify,
}));

vi.mock('@/services/scanner/localReferenceMatcher', () => ({
  createLocalReferenceScannerProvider: () => scannerMocks.provider,
}));

vi.mock('@/hooks/useImageAcquisition', async () => {
  const { useState } = await import('react');
  return {
    useImageAcquisition: () => {
      const [image, setImage] = useState<{ file: File; previewUrl: string } | null>(null);
      return {
        image,
        error: null,
        selectFile: (file: File | null) => {
          if (file) {
            setImage({
              file,
              previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
            });
          }
        },
        clearImage: () => setImage(null),
        handlePreviewError: () => undefined,
      };
    },
  };
});

vi.mock('@/context/NavContext', () => ({
  useNav: () => ({ go: scannerMocks.go }),
}));

const candidate = {
  catalogProvider: 'catalog-a',
  catalogId: 'card-25',
  gameKey: 'pokemon',
  name: 'Pikachu',
  providers: ['local-reference'],
};

const matchResult = {
  status: 'success' as const,
  candidates: [candidate],
};

describe('ScannerScreen interactions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    scannerMocks.identify.mockReset().mockResolvedValue(matchResult);
    scannerMocks.go.mockReset();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderScreen(onCandidateConfirmed = vi.fn()) {
    await act(async () => {
      root.render(createElement(ScannerScreen, { onCandidateConfirmed }));
    });
    return onCandidateConfirmed;
  }

  async function provideImage() {
    const file = new File(['local image bytes'], 'card.png', { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('Scanner image input was not rendered.');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return file;
  }

  it('requires image selection, an explicit match action, candidate selection, and confirmation', async () => {
    const onCandidateConfirmed = await renderScreen();
    expect(container.textContent).toContain('Prefer manual catalog search? Browse cards');
    expect([...container.querySelectorAll('button')]
      .some((button) => button.textContent?.includes('Match Local References'))).toBe(false);
    expect(scannerMocks.identify).not.toHaveBeenCalled();

    const file = await provideImage();
    expect(container.textContent).toContain('Selected: card.png');
    expect(container.textContent).toContain(
      'This image is temporary and is not uploaded, retained, or added to your binder.',
    );
    expect(scannerMocks.identify).not.toHaveBeenCalled();
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Match Local References'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });

    expect(scannerMocks.identify).toHaveBeenCalledWith(
      [scannerMocks.provider],
      file,
      expect.any(AbortSignal),
    );
    expect(container.textContent).toContain('Candidate Review');
    expect(container.textContent).toContain('Pikachu');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    const confirmButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Confirm selected candidate'));
    if (!confirmButton) throw new Error('Candidate confirmation action was not rendered.');
    expect(confirmButton.disabled).toBe(true);
    const candidateRadio = container.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!candidateRadio) throw new Error('Candidate selection control was not rendered.');
    await act(async () => candidateRadio.click());
    expect(confirmButton.disabled).toBe(false);
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    await act(async () => confirmButton.click());
    expect(onCandidateConfirmed).toHaveBeenCalledOnce();
    expect(onCandidateConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ catalogId: 'card-25' }),
    );
    expect(isConfirmedScannerCandidate(onCandidateConfirmed.mock.calls[0][0])).toBe(true);
  });

  it('clearing a selected image removes its candidate review and prevents stale confirmation', async () => {
    const onCandidateConfirmed = await renderScreen();
    await provideImage();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Match Local References'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Candidate Review');

    const removeButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Remove Picture'));
    if (!removeButton) throw new Error('Remove picture action was not rendered.');
    await act(async () => removeButton.click());

    expect(container.textContent).not.toContain('Selected: card.png');
    expect(container.textContent).not.toContain('Candidate Review');
    expect([...container.querySelectorAll('button')]
      .some((button) => button.textContent?.includes('Confirm selected candidate'))).toBe(false);
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
    expect(scannerMocks.identify).toHaveBeenCalledOnce();
  });

  it('aborts an in-flight match and ignores its late result after the image is cleared', async () => {
    let resolveMatch!: (result: typeof matchResult) => void;
    scannerMocks.identify.mockImplementation(() => new Promise((resolve) => {
      resolveMatch = resolve;
    }));
    const onCandidateConfirmed = await renderScreen();
    await provideImage();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Match Local References'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
    const signal = scannerMocks.identify.mock.calls[0][2];
    expect(signal.aborted).toBe(false);

    const removeButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Remove Picture'));
    if (!removeButton) throw new Error('Remove picture action was not rendered.');
    await act(async () => removeButton.click());
    expect(signal.aborted).toBe(true);
    expect(container.textContent).not.toContain('Selected: card.png');
    expect(container.textContent).not.toContain('Candidate Review');

    await act(async () => {
      resolveMatch(matchResult);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('Candidate Review');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });
});
