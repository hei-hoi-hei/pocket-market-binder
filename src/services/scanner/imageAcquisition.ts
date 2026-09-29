export type ImageAcquisitionResult =
  | { status: 'success'; blob: Blob; fileName: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export function isImageBlob(blob: Blob): boolean {
  return blob.size > 0 && blob.type.trim().toLowerCase().startsWith('image/');
}

export function createImageAcquisitionResult(
  blob: Blob | null,
  fileName = 'Captured image',
): ImageAcquisitionResult {
  if (!blob) return { status: 'cancelled' };
  if (!isImageBlob(blob)) {
    return { status: 'error', message: 'Please choose a non-empty image file.' };
  }
  return { status: 'success', blob, fileName: fileName.trim() || 'Captured image' };
}