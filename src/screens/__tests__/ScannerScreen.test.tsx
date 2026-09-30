// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isConfirmedScannerCandidate } from '@/services/scanner/types';
import type { ImageAcquisitionResult } from '@/services/scanner/imageAcquisition';
import { ScannerScreen } from '../ScannerScreen';

const scannerMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  go: vi.fn(),
  nativeCameraAvailable: vi.fn(() => false),
  takeNativePhoto: vi.fn(),
  chooseNativePhotoFromGallery: vi.fn(),
  acceptAcquisition: vi.fn(),
  consumeRestoredCameraAcquisition: vi.fn<[], ImageAcquisitionResult | null>(() => null),
  restoredListeners: [] as Array<(result: ImageAcquisitionResult) => void>,
  provider: { name: 'local-reference' },
}));

vi.mock('@/services/scanner/scannerOrchestration', () => ({
  identifyImageWithProviders: scannerMocks.identify,
}));

vi.mock('@/services/scanner/scannerProviders', () => ({
  createScannerProviders: () => [scannerMocks.provider],
}));

vi.mock('@/services/scanner/capacitorCameraAcquisition', () => ({
  isNativeCameraAvailable: scannerMocks.nativeCameraAvailable,
  takeNativePhoto: scannerMocks.takeNativePhoto,
  chooseNativePhotoFromGallery: scannerMocks.chooseNativePhotoFromGallery,
  consumeRestoredCameraAcquisition: scannerMocks.consumeRestoredCameraAcquisition,
  subscribeToRestoredCameraAcquisition: (listener: (result: ImageAcquisitionResult) => void) => {
    scannerMocks.restoredListeners.push(listener);
    return () => {
      scannerMocks.restoredListeners = scannerMocks.restoredListeners
        .filter((current) => current !== listener);
    };
  },
}));

vi.mock('@/hooks/useImageAcquisition', async () => {
  const { useState } = await import('react');
  return {
    useImageAcquisition: () => {
      const [image, setImage] = useState<{ blob: Blob; fileName: string; previewUrl: string } | null>(null);
      const [error, setError] = useState<string | null>(null);
      const acceptAcquisition = (result: {
        status: 'success'; blob: Blob; fileName: string;
      } | { status: 'cancelled' } | { status: 'error'; message: string }) => {
        scannerMocks.acceptAcquisition(result);
        if (result.status === 'success') {
          setImage({
            blob: result.blob,
            fileName: result.fileName,
            previewUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
          });
          setError(null);
        } else if (result.status === 'error') {
          setError(result.message);
        } else {
          setError(null);
        }
      };
      return {
        image,
        error,
        acceptAcquisition,
        selectFile: (file: File | null) => {
          if (file) {
            acceptAcquisition({ status: 'success', blob: file, fileName: file.name });
          }
        },
        clearImage: () => { setImage(null); setError(null); },
        handlePreviewError: () => { setImage(null); setError('Preview failed'); },
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
  let rootMounted: boolean;

  beforeEach(() => {
    scannerMocks.identify.mockReset().mockResolvedValue(matchResult);
    scannerMocks.go.mockReset();
    scannerMocks.nativeCameraAvailable.mockReset().mockReturnValue(false);
    scannerMocks.takeNativePhoto.mockReset();
    scannerMocks.chooseNativePhotoFromGallery.mockReset();
    scannerMocks.consumeRestoredCameraAcquisition.mockReset().mockReturnValue(null);
    scannerMocks.restoredListeners.length = 0;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    rootMounted = true;
  });

  afterEach(async () => {
    if (rootMounted) await act(async () => root.unmount());
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

  async function provideImage(fileName = 'card.png', inputId = 'scanner-camera-input') {
    const file = new File(['local image bytes'], fileName, { type: 'image/png' });
    const input = container.querySelector<HTMLInputElement>(`#${inputId}`);
    if (!input) throw new Error('Scanner image input was not rendered.');
    expect(input.accept).toBe('image/*');
    expect(input.getAttribute('capture')).toBe(inputId === 'scanner-camera-input' ? 'environment' : null);
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
      .some((button) => button.textContent?.includes('Recognize Card'))).toBe(false);
    expect(scannerMocks.identify).not.toHaveBeenCalled();

    const file = await provideImage();
    expect(container.textContent).toContain('Selected: card.png');
    expect(container.textContent).toContain(
      'This image is temporary and is not uploaded, retained, or added to your binder.',
    );
    expect(scannerMocks.identify).not.toHaveBeenCalled();
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
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
    expect(confirmButton.disabled).toBe(true);
    expect(candidateRadio.disabled).toBe(true);
    await act(async () => confirmButton.click());
    expect(onCandidateConfirmed).toHaveBeenCalledOnce();
  });

  it('routes a gallery-selected PWA photo through the same local matcher and confirmation flow', async () => {
    const onCandidateConfirmed = await renderScreen();
    const galleryInput = container.querySelector<HTMLInputElement>('#scanner-gallery-input');
    if (!galleryInput) throw new Error('Gallery image input was not rendered.');
    const pickerClick = vi.spyOn(galleryInput, 'click').mockImplementation(() => {});
    const galleryButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Choose from Gallery'));
    if (!galleryButton) throw new Error('Choose from Gallery action was not rendered.');
    await act(async () => galleryButton.click());
    expect(pickerClick).toHaveBeenCalledOnce();

    const file = await provideImage('gallery-card.png', 'scanner-gallery-input');
    expect(container.textContent).toContain('Selected: gallery-card.png');
    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered for gallery photo.');
    await act(async () => { matchButton.click(); await Promise.resolve(); });

    expect(scannerMocks.identify).toHaveBeenCalledWith(
      [scannerMocks.provider],
      file,
      expect.any(AbortSignal),
    );
    expect(container.textContent).toContain('Candidate Review');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });

  it('offers explicit local feedback after candidate results without confirming the candidate', async () => {
    const onCandidateConfirmed = await renderScreen();
    await provideImage();
    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => { matchButton.click(); await Promise.resolve(); });

    expect(container.textContent).toContain('Candidate Review');
    expect(container.textContent).toContain('Report this scanner result');
    expect(container.textContent).toContain('The photo is not attached, stored, or sent.');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent))
      .toContain('Correct');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent))
      .toContain('Wrong card');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    const cancelReview = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Cancel review'));
    if (!cancelReview) {
      throw new Error(`Candidate review cancel action was not rendered. Buttons: ${[...container.querySelectorAll('button')].map((button) => button.textContent).join(' | ')}`);
    }
    await act(async () => cancelReview.click());
    expect(container.textContent).not.toContain('Candidate Review');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent))
      .toContain('Cancelled');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });

  it('surfaces a normalized processing-error result with explicit feedback after a matcher exception', async () => {
    scannerMocks.identify.mockRejectedValueOnce(new Error('private raw matcher failure'));
    await renderScreen();
    await provideImage();
    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => { matchButton.click(); await Promise.resolve(); });

    expect(container.textContent).toContain('Recognition could not be completed: Recognition could not be completed.');
    expect(container.textContent).not.toContain('private raw matcher failure');
    expect(container.textContent).toContain('Report this scanner result');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent))
      .toContain('Error');
  });

  it('opens local reference enrollment for the selected image without running matching or adding to Binder', async () => {
    const onCandidateConfirmed = await renderScreen();
    await provideImage('reference-card.png');

    const saveButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Save as recognition reference'));
    if (!saveButton) throw new Error('Reference enrollment action was not rendered.');
    await act(async () => saveButton.click());

    expect(container.textContent).toContain('Selected: reference-card.png');
    expect(container.textContent).toContain('This helps Pocket Market Binder recognize this card in future scans.');
    expect(scannerMocks.identify).not.toHaveBeenCalled();
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });

  it('clearing a selected image removes its candidate review and prevents stale confirmation', async () => {
    const onCandidateConfirmed = await renderScreen();
    await provideImage();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
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
      .find((button) => button.textContent?.includes('Recognize Card'));
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

  it('aborts an in-flight match and discards its result when the preview fails', async () => {
    let resolveMatch!: (result: typeof matchResult) => void;
    scannerMocks.identify.mockImplementation(() => new Promise((resolve) => {
      resolveMatch = resolve;
    }));
    const onCandidateConfirmed = await renderScreen();
    await provideImage();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
    const signal = scannerMocks.identify.mock.calls[0][2];
    expect(signal.aborted).toBe(false);

    const preview = container.querySelector('img[alt="Selected card preview"]');
    if (!preview) throw new Error('Selected image preview was not rendered.');
    await act(async () => {
      preview.dispatchEvent(new Event('error'));
    });
    expect(signal.aborted).toBe(true);
    expect(container.textContent).toContain('Preview failed');
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
      .find((button) => button.textContent?.includes('Recognize Card'));
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
    expect(container.textContent).toContain('Recognizing Card...');

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

  it('sends a native camera Blob through the existing match and explicit confirmation flow', async () => {
    const photo = new Blob(['native photo'], { type: 'image/jpeg' });
    scannerMocks.nativeCameraAvailable.mockReturnValue(true);
    scannerMocks.takeNativePhoto.mockResolvedValue({
      status: 'success',
      blob: photo,
      fileName: 'camera-photo.jpg',
    });
    const onCandidateConfirmed = await renderScreen();

    const takePhotoButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Take Photo'));
    if (!takePhotoButton) throw new Error('Native Take Photo action was not rendered.');
    await act(async () => {
      takePhotoButton.click();
      await Promise.resolve();
    });

    expect(scannerMocks.takeNativePhoto).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Selected: camera-photo.jpg');
    expect(scannerMocks.identify).not.toHaveBeenCalled();
    expect(onCandidateConfirmed).not.toHaveBeenCalled();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered for the native photo.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });

    expect(scannerMocks.identify).toHaveBeenCalledWith(
      [scannerMocks.provider],
      photo,
      expect.any(AbortSignal),
    );
    expect(container.textContent).toContain('Candidate Review');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });

  it('applies a restored native result through the existing Blob acquisition boundary', async () => {
    const photo = new Blob(['restored native photo'], { type: 'image/jpeg' });
    await renderScreen();
    const restoredListener = scannerMocks.restoredListeners[0];
    if (!restoredListener) throw new Error('Restored camera listener was not registered.');

    await act(async () => restoredListener({
      status: 'success',
      blob: photo,
      fileName: 'camera-photo.jpg',
    }));

    expect(container.textContent).toContain('Selected: camera-photo.jpg');
    expect(scannerMocks.identify).not.toHaveBeenCalled();

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered for the restored photo.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
    expect(scannerMocks.identify).toHaveBeenCalledWith(
      [scannerMocks.provider],
      photo,
      expect.any(AbortSignal),
    );
  });

  it('keeps the current preview and review when native replacement is cancelled or fails', async () => {
    scannerMocks.nativeCameraAvailable.mockReturnValue(true);
    const onCandidateConfirmed = await renderScreen();
    await provideImage('current-card.png');

    const matchButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Recognize Card'));
    if (!matchButton) throw new Error('Local matching action was not rendered.');
    await act(async () => {
      matchButton.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Candidate Review');

    const takeNewPhoto = () => [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Take New Photo'));
    scannerMocks.takeNativePhoto.mockResolvedValueOnce({ status: 'cancelled' });
    const cancelButton = takeNewPhoto();
    if (!cancelButton) throw new Error('Native replacement action was not rendered.');
    await act(async () => {
      cancelButton.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Selected: current-card.png');
    expect(container.textContent).toContain('Candidate Review');

    scannerMocks.takeNativePhoto.mockResolvedValueOnce({
      status: 'error',
      message: 'Camera permission was denied.',
    });
    const retryButton = takeNewPhoto();
    if (!retryButton) throw new Error('Native replacement action was not rendered after cancellation.');
    await act(async () => {
      retryButton.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Selected: current-card.png');
    expect(container.textContent).toContain('Candidate Review');
    expect(container.textContent).toContain('Camera permission was denied.');
    expect(onCandidateConfirmed).not.toHaveBeenCalled();
  });

  it('ignores pending native acquisitions after clear and unmount', async () => {
    let resolveAfterClear!: (result: ImageAcquisitionResult) => void;
    let resolveAfterUnmount!: (result: ImageAcquisitionResult) => void;
    scannerMocks.nativeCameraAvailable.mockReturnValue(true);
    scannerMocks.takeNativePhoto
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAfterClear = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAfterUnmount = resolve; }));
    await renderScreen();
    await provideImage('existing.png');
    scannerMocks.acceptAcquisition.mockClear();

    const takeNewPhoto = () => [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Take New Photo'));
    const takeBeforeClear = takeNewPhoto();
    if (!takeBeforeClear) throw new Error('Native replacement action was not rendered.');
    await act(async () => {
      takeBeforeClear.click();
      await Promise.resolve();
    });
    const removeButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Remove Picture'));
    if (!removeButton) throw new Error('Remove picture action was not rendered.');
    await act(async () => removeButton.click());
    await act(async () => {
      resolveAfterClear({
        status: 'success',
        blob: new Blob(['late after clear'], { type: 'image/jpeg' }),
        fileName: 'late-after-clear.jpg',
      });
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('Selected: late-after-clear.jpg');
    expect(scannerMocks.acceptAcquisition).not.toHaveBeenCalled();

    const takeBeforeUnmount = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Take Photo'));
    if (!takeBeforeUnmount) throw new Error('Native capture action was not rendered after clear.');
    await act(async () => {
      takeBeforeUnmount.click();
      await Promise.resolve();
    });
    await act(async () => root.unmount());
    rootMounted = false;
    await act(async () => {
      resolveAfterUnmount({
        status: 'success',
        blob: new Blob(['late after unmount'], { type: 'image/jpeg' }),
        fileName: 'late-after-unmount.jpg',
      });
      await Promise.resolve();
    });
    expect(scannerMocks.acceptAcquisition).not.toHaveBeenCalled();
  });
});
