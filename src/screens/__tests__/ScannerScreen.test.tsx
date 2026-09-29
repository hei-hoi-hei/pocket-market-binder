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
      const [image, setImage] = useState<{ blob: Blob; fileName: string; previewUrl: string } | null>(null);
      return {
        image,
        error: null,
        selectFile: (file: File | null) => {
          if (file) {
            setImage({
              blob: file,
              fileName: file.name,
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

  async function provideImage(fileName = 'card.png') {
    const file = new File(['local image bytes'], fileName, { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('Scanner image input was not rendered.');
    expect(input.accept).toBe('image/*');
    expect(input.getAttribute('capture')).toBe('environment');
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

  it('ignores image A recognition after replacing it with image B', async () => {
    let resolveImageA!: (result: typeof matchResult) => void;
    let resolveImageB!: (result: typeof matchResult) => void;
    scannerMocks.identify
      .mockImplementationOnce(() => new Promise((resolve) => { resolveImageA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveImageB = resolve; }));
    const onCandidateConfirmed = await renderScreen();
    const imageA = await provideImage('image-a.png');

    const findMatchButton = () => [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Match Local References'));
    const matchImageA = findMatchButton();
    if (!matchImageA) throw new Error('Local matching action was not rendered for image A.');
    await act(async () => {
      matchImageA.click();
      await Promise.resolve();
    });
    const signalA = scannerMocks.identify.mock.calls[0][2];

    const imageB = await provideImage('image-b.png');
    expect(signalA.aborted).toBe(true);
    expect(container.textContent).toContain('Selected: image-b.png');

    const matchImageB = findMatchButton();
    if (!matchImageB) throw new Error('Local matching action was not rendered for image B.');
    await act(async () => {
      matchImageB.click();
      await Promise.resolve();
    });
    const signalB = scannerMocks.identify.mock.calls[1][2];
    expect(signalB.aborted).toBe(false);

    await act(async () => {
      resolveImageA({ status: 'success', candidates: [{ ...candidate, name: 'Late image A' }] });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Selected: image-b.png');
    expect(container.textContent).not.toContain('Late image A');
    expect(container.textContent).toContain('Matching Local References...');

    await act(async () => {
      resolveImageB({ status: 'success', candidates: [{ ...candidate, name: 'Image B result' }] });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Selected: image-b.png');
    expect(container.textContent).toContain('Image B result');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
    expect(scannerMocks.identify.mock.calls[0][1]).toBe(imageA);
    expect(scannerMocks.identify.mock.calls[1][1]).toBe(imageB);
  });
});
