import { describe, expect, it, vi } from 'vitest';
import { isImageFile, replacePreviewUrl, revokePreviewUrl } from '../useImageAcquisition';

describe('image acquisition', () => {
  it('accepts image files', () => {
    expect(isImageFile(new File(['card'], 'card.jpg', { type: 'image/jpeg' }))).toBe(true);
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
});
