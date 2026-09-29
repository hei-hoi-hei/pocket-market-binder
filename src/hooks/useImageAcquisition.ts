import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createImageAcquisitionResult,
  isImageBlob,
} from '@/services/scanner/imageAcquisition';
import type { ImageAcquisitionResult } from '@/services/scanner/imageAcquisition';

export { createImageAcquisitionResult } from '@/services/scanner/imageAcquisition';
export type { ImageAcquisitionResult } from '@/services/scanner/imageAcquisition';

export interface AcquiredImage {
  blob: Blob;
  fileName: string;
  previewUrl: string;
}

export interface ImageAcquisitionState {
  image: AcquiredImage | null;
  error: string | null;
}

export function isImageFile(file: Blob): boolean {
  return isImageBlob(file);
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
  file: Blob,
  createUrl: (file: Blob) => string = URL.createObjectURL,
  revokeUrl: (url: string) => void = URL.revokeObjectURL,
): string {
  const nextUrl = createUrl(file);
  revokePreviewUrl(currentUrl, revokeUrl);
  return nextUrl;
}

export function useImageAcquisition(): ImageAcquisitionState & {
  acceptAcquisition: (result: ImageAcquisitionResult) => void;
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

  const acceptAcquisition = useCallback((result: ImageAcquisitionResult) => {
    if (result.status === 'cancelled') {
      setState((current) => ({ ...current, error: null }));
      return;
    }

    if (result.status === 'error') {
      setState((current) => ({
        ...current,
        error: result.message,
      }));
      return;
    }

    if (!isImageBlob(result.blob)) {
      setState((current) => ({
        ...current,
        error: 'Please choose a non-empty image file.',
      }));
      return;
    }

    const previewUrl = replacePreviewUrl(previewUrlRef.current, result.blob);
    previewUrlRef.current = previewUrl;
    setState({
      image: { blob: result.blob, fileName: result.fileName.trim() || 'Captured image', previewUrl },
      error: null,
    });
  }, []);

  const selectFile = useCallback((file: File | null) => {
    acceptAcquisition(createImageAcquisitionResult(file, file?.name));
  }, [acceptAcquisition]);

  useEffect(() => revokePreview, [revokePreview]);

  return { ...state, acceptAcquisition, selectFile, clearImage, handlePreviewError };
}
