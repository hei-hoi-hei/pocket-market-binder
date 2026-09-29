import { App } from '@capacitor/app';
import type { RestoredListenerEvent } from '@capacitor/app';
import { Camera, CameraErrorCode, MediaType, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import type { MediaResult } from '@capacitor/camera';
import { createImageAcquisitionResult } from './imageAcquisition';
import type { ImageAcquisitionResult } from './imageAcquisition';

const CAMERA_PERMISSION_DENIED = 'Camera permission was denied. Allow camera access and try again.';
const GALLERY_PERMISSION_DENIED = 'Photo access was denied. Allow photo access and try again.';
const RESTORED_CAMERA_METHODS = new Set(['takePhoto', 'chooseFromGallery']);

let pendingRestoredAcquisition: ImageAcquisitionResult | null = null;
let restoredListenerRegistration: Promise<void> | null = null;
const restoredAcquisitionListeners = new Set<(result: ImageAcquisitionResult) => void>();

interface CameraFailure {
  code?: unknown;
  message?: unknown;
}

function failureParts(error: unknown): CameraFailure {
  if (typeof error !== 'object' || error === null) return {};
  return error as CameraFailure;
}

function errorResult(error: unknown): ImageAcquisitionResult {
  const { code, message } = failureParts(error);
  if (
    code === CameraErrorCode.TakePhotoCancelled ||
    code === CameraErrorCode.ChooseMediaCancelled ||
    (typeof message === 'string' && /cancel(?:l)?ed|cancel(?:l)?ation/i.test(message))
  ) {
    return { status: 'cancelled' };
  }
  if (code === CameraErrorCode.CameraPermissionDenied) {
    return { status: 'error', message: CAMERA_PERMISSION_DENIED };
  }
  if (code === CameraErrorCode.GalleryPermissionDenied) {
    return { status: 'error', message: GALLERY_PERMISSION_DENIED };
  }
  return {
    status: 'error',
    message: typeof message === 'string' && message.trim()
      ? message
      : 'The camera could not provide an image. Please try again or choose a picture.',
  };
}

function imageMimeType(media: MediaResult, blob: Blob): string {
  if (blob.type.toLowerCase().startsWith('image/')) return blob.type;
  const format = media.metadata?.format?.trim().toLowerCase().replace(/^image\//, '');
  if (!format || !/^[a-z0-9.+-]+$/.test(format)) return '';
  return `image/${format === 'jpg' ? 'jpeg' : format}`;
}

async function toAcquisitionResult(media: MediaResult): Promise<ImageAcquisitionResult> {
  if (media.type !== MediaType.Photo) {
    return { status: 'error', message: 'The selected media is not a photo.' };
  }

  const imageUrl = media.webPath ?? (media.uri ? Capacitor.convertFileSrc(media.uri) : undefined);
  if (!imageUrl) {
    return { status: 'error', message: 'The camera did not provide a readable photo.' };
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { status: 'error', message: 'The captured photo could not be read.' };
    }
    const blob = await response.blob();
    const mimeType = imageMimeType(media, blob);
    const imageBlob = blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.replace('image/', '');
    return createImageAcquisitionResult(imageBlob, `camera-photo.${extension}`);
  } catch {
    return { status: 'error', message: 'The captured photo could not be read.' };
  }
}

function isMediaResult(value: unknown): value is MediaResult {
  return typeof value === 'object' && value !== null &&
    'type' in value && (value.type === MediaType.Photo || value.type === MediaType.Video);
}

async function handleRestoredCameraResult(event: RestoredListenerEvent): Promise<void> {
  if (event.pluginId !== 'Camera' || !RESTORED_CAMERA_METHODS.has(event.methodName)) return;

  const result = event.success
    ? isMediaResult(event.data)
      ? await toAcquisitionResult(event.data)
      : { status: 'error' as const, message: 'The restored camera result did not contain a photo.' }
    : errorResult(event.error);

  pendingRestoredAcquisition = result;
  restoredAcquisitionListeners.forEach((listener) => listener(result));
}

export function consumeRestoredCameraAcquisition(): ImageAcquisitionResult | null {
  const result = pendingRestoredAcquisition;
  pendingRestoredAcquisition = null;
  return result;
}

export function subscribeToRestoredCameraAcquisition(
  listener: (result: ImageAcquisitionResult) => void,
): () => void {
  restoredAcquisitionListeners.add(listener);
  if (pendingRestoredAcquisition) listener(pendingRestoredAcquisition);
  return () => restoredAcquisitionListeners.delete(listener);
}

export function registerNativeCameraRestoration(): Promise<void> {
  if (!isNativeCameraAvailable() || !Capacitor.isPluginAvailable('App')) {
    return Promise.resolve();
  }
  if (!restoredListenerRegistration) {
    restoredListenerRegistration = App.addListener('appRestoredResult', (event) => {
      void handleRestoredCameraResult(event);
    })
      .then(() => undefined)
      .catch(() => {
        restoredListenerRegistration = null;
      });
  }
  return restoredListenerRegistration;
}

export function isNativeCameraAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Camera');
}

export async function takeNativePhoto(): Promise<ImageAcquisitionResult> {
  if (!isNativeCameraAvailable()) {
    return { status: 'error', message: 'Native camera support is unavailable on this device.' };
  }
  try {
    const media = await Camera.takePhoto({
      quality: 100,
      correctOrientation: true,
      saveToGallery: false,
      includeMetadata: true,
    });
    return await toAcquisitionResult(media);
  } catch (error) {
    return errorResult(error);
  }
}

export async function chooseNativePhotoFromGallery(): Promise<ImageAcquisitionResult> {
  if (!isNativeCameraAvailable()) {
    return { status: 'error', message: 'Native photo selection is unavailable on this device.' };
  }
  try {
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: false,
      includeMetadata: true,
    });
    const photo = results[0];
    return photo ? await toAcquisitionResult(photo) : { status: 'cancelled' };
  } catch (error) {
    return errorResult(error);
  }
}