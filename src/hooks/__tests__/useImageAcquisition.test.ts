// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  createImageAcquisitionResult,
  isImageFile,
  replacePreviewUrl,
  revokePreviewUrl,
  useImageAcquisition,
} from '../useImageAcquisition';

describe('image acquisition', () => {
  it('accepts image files', () => {
    expect(isImageFile(new File(['card'], 'card.jpg', { type: 'image/jpeg' }))).toBe(true);
  });

  it('creates a successful acquisition result for a Blob and preserves its display name', () => {
    const blob = new Blob(['card'], { type: 'image/jpeg' });

    expect(createImageAcquisitionResult(blob, 'camera-photo.jpg')).toEqual({
      status: 'success',
      blob,
      fileName: 'camera-photo.jpg',
    });
  });

  it('represents cancellation and rejects empty or non-image inputs', () => {
    expect(createImageAcquisitionResult(null)).toEqual({ status: 'cancelled' });
    expect(createImageAcquisitionResult(new File(['text'], 'notes.txt', { type: 'text/plain' })))
      .toMatchObject({ status: 'error' });
    expect(createImageAcquisitionResult(new Blob([], { type: 'image/jpeg' })))
      .toMatchObject({ status: 'error' });
  });

  it('rejects non-image files', () => {
    expect(isImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('revokes the previous preview when replacing an image', () => {
    const image = new File(['new card'], 'new-card.jpg', { type: 'image/jpeg' });
    const revokeUrl = vi.fn();

    const nextUrl = replacePreviewUrl('blob:old-card', image, () => 'blob:new-card', revokeUrl);

    expect(nextUrl).toBe('blob:new-card');
    expect(revokeUrl).toHaveBeenCalledWith('blob:old-card');
  });

  it.each([
    ['clearing the image', 'blob:clear-me'],
    ['a preview error', 'blob:preview-failed'],
    ['unmounting the scanner', 'blob:unmount-me'],
  ])('revokes the active preview after %s', (_action, currentUrl) => {
    const revokeUrl = vi.fn();

    const nextUrl = revokePreviewUrl(currentUrl, revokeUrl);

    expect(nextUrl).toBeNull();
    expect(revokeUrl).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith(currentUrl);
  });

  it('leaves replacement state consistent when the old preview is absent', () => {
    const image = new File(['replacement'], 'replacement.png', { type: 'image/png' });
    const revokeUrl = vi.fn();

    const nextUrl = replacePreviewUrl(null, image, () => 'blob:replacement', revokeUrl);

    expect(nextUrl).toBe('blob:replacement');
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it('preserves the current image on cancellation and revokes previews on replace, clear, and unmount', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const createUrl = vi.fn()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
      .mockReturnValueOnce('blob:third');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });

    let acquisition!: ReturnType<typeof useImageAcquisition>;
    function HookProbe() {
      acquisition = useImageAcquisition();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(HookProbe)));

      const first = new Blob(['first'], { type: 'image/jpeg' });
      await act(async () => acquisition.acceptAcquisition(
        createImageAcquisitionResult(first, 'first.jpg'),
      ));
      await act(async () => acquisition.acceptAcquisition({
        status: 'error',
        message: 'Camera permission was denied.',
      }));
      expect(acquisition.image?.blob).toBe(first);
      expect(acquisition.error).toBe('Camera permission was denied.');

      await act(async () => acquisition.acceptAcquisition({ status: 'cancelled' }));
      expect(acquisition.image?.blob).toBe(first);
      expect(acquisition.error).toBeNull();
      expect(revokeUrl).not.toHaveBeenCalled();

      const second = new Blob(['second'], { type: 'image/png' });
      await act(async () => acquisition.acceptAcquisition(
        createImageAcquisitionResult(second, 'second.png'),
      ));
      expect(revokeUrl).toHaveBeenCalledWith('blob:first');

      await act(async () => acquisition.clearImage());
      expect(acquisition.image).toBeNull();
      expect(revokeUrl).toHaveBeenCalledWith('blob:second');

      await act(async () => acquisition.acceptAcquisition(
        createImageAcquisitionResult(new Blob(['third'], { type: 'image/jpeg' }), 'third.jpg'),
      ));
      await act(async () => root.unmount());
      expect(revokeUrl).toHaveBeenCalledWith('blob:third');
    } finally {
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
