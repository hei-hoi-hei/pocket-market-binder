import { useCallback, useEffect, useRef, useState } from 'react';

export interface AcquiredImage {
  file: File;
  previewUrl: string;
}

export interface ImageAcquisitionState {
  image: AcquiredImage | null;
  error: string | null;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function revokePreviewUrl(
  currentUrl: string | null,
  revokeUrl: (url: string) => void = URL.revokeObjectURL,
): null {
  if (currentUrl) revokeUrl(currentUrl);
  return null;
}

export function replacePreviewUrl(
  currentUrl: string | null,
  file: File,
  createUrl: (file: File) => string = URL.createObjectURL,
  revokeUrl: (url: string) => void = URL.revokeObjectURL,
): string {
  const nextUrl = createUrl(file);
  revokePreviewUrl(currentUrl, revokeUrl);
  return nextUrl;
}

export function useImageAcquisition(): ImageAcquisitionState & {
  selectFile: (file: File | null) => void;
  clearImage: () => void;
  handlePreviewError: () => void;
} {
  const [state, setState] = useState<ImageAcquisitionState>({ image: null, error: null });
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    previewUrlRef.current = revokePreviewUrl(previewUrlRef.current);
  }, []);

  const clearImage = useCallback(() => {
    revokePreview();
    setState({ image: null, error: null });
  }, [revokePreview]);

  const handlePreviewError = useCallback(() => {
    revokePreview();
    setState({ image: null, error: 'This image could not be displayed. Please choose another picture.' });
  }, [revokePreview]);

  const selectFile = useCallback((file: File | null) => {
    if (!file) return;

    if (!isImageFile(file)) {
      setState((current) => ({
        ...current,
        error: 'Please choose an image file.',
      }));
      return;
    }

    const previewUrl = replacePreviewUrl(previewUrlRef.current, file);
    previewUrlRef.current = previewUrl;
    setState({ image: { file, previewUrl }, error: null });
  }, []);

  useEffect(() => revokePreview, [revokePreview]);

  return { ...state, selectFile, clearImage, handlePreviewError };
}
