import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaResult } from '@capacitor/camera';
import type { RestoredListenerEvent } from '@capacitor/app';

const cameraMocks = vi.hoisted(() => ({
  takePhoto: vi.fn(),
  chooseFromGallery: vi.fn(),
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn(() => true),
  convertFileSrc: vi.fn((uri: string) => `http://localhost/_capacitor_file_/${uri}`),
}));

const appMocks = vi.hoisted(() => ({
  addListener: vi.fn<[
    eventName: 'appRestoredResult',
    listener: (event: RestoredListenerEvent) => void,
  ], Promise<{ remove: () => Promise<void> }>>(),
}));

vi.mock('@capacitor/app', () => ({
  App: { addListener: appMocks.addListener },
}));

vi.mock('@capacitor/camera', () => ({
  Camera: {
    takePhoto: cameraMocks.takePhoto,
    chooseFromGallery: cameraMocks.chooseFromGallery,
  },
  CameraErrorCode: {
    CameraPermissionDenied: 'OS-PLUG-CAMR-0003',
    GalleryPermissionDenied: 'OS-PLUG-CAMR-0005',
    TakePhotoCancelled: 'OS-PLUG-CAMR-0006',
    ChooseMediaCancelled: 'OS-PLUG-CAMR-0020',
  },
  MediaType: { Photo: 0 },
  MediaTypeSelection: { Photo: 0 },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: cameraMocks.isNativePlatform,
    isPluginAvailable: cameraMocks.isPluginAvailable,
    convertFileSrc: cameraMocks.convertFileSrc,
  },
}));

import {
  consumeRestoredCameraAcquisition,
  chooseNativePhotoFromGallery,
  isNativeCameraAvailable,
  registerNativeCameraRestoration,
  subscribeToRestoredCameraAcquisition,
  takeNativePhoto,
} from '../capacitorCameraAcquisition';

function mediaResult(overrides: Partial<MediaResult> = {}): MediaResult {
  return {
    type: 0,
    saved: false,
    uri: 'file:///capture/card.jpg',
    webPath: 'http://localhost/_capacitor_file_/capture/card.jpg',
    metadata: { format: 'jpg' },
    ...overrides,
  };
}

describe('Capacitor camera acquisition', () => {
  beforeEach(() => {
    cameraMocks.takePhoto.mockReset();
    cameraMocks.chooseFromGallery.mockReset();
    cameraMocks.isNativePlatform.mockReturnValue(true);
    cameraMocks.isPluginAvailable.mockReturnValue(true);
    cameraMocks.convertFileSrc.mockClear();
    appMocks.addListener.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is available only when running natively with the Camera plugin', () => {
    expect(isNativeCameraAvailable()).toBe(true);
    cameraMocks.isNativePlatform.mockReturnValue(false);
    expect(isNativeCameraAvailable()).toBe(false);
    cameraMocks.isNativePlatform.mockReturnValue(true);
    cameraMocks.isPluginAvailable.mockReturnValue(false);
    expect(isNativeCameraAvailable()).toBe(false);
  });

  it('returns a clear unavailable result when native camera support is missing', async () => {
    cameraMocks.isNativePlatform.mockReturnValue(false);

    await expect(takeNativePhoto()).resolves.toEqual({
      status: 'error',
      message: 'Native camera support is unavailable on this device.',
    });
    await expect(chooseNativePhotoFromGallery()).resolves.toEqual({
      status: 'error',
      message: 'Native photo selection is unavailable on this device.',
    });
    expect(cameraMocks.takePhoto).not.toHaveBeenCalled();
    expect(cameraMocks.chooseFromGallery).not.toHaveBeenCalled();
  });

  it('converts a native camera webPath to the common Blob acquisition result', async () => {
    const image = new Blob(['captured pixels'], { type: 'image/jpeg' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => image,
    }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    cameraMocks.takePhoto.mockResolvedValue(mediaResult());

    const result = await takeNativePhoto();

    expect(cameraMocks.takePhoto).toHaveBeenCalledWith({
      quality: 100,
      correctOrientation: true,
      saveToGallery: false,
      includeMetadata: true,
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/_capacitor_file_/capture/card.jpg');
    expect(result).toEqual({ status: 'success', blob: image, fileName: 'camera-photo.jpg' });
  });

  it('converts a gallery photo to the common Blob result and distinguishes an empty selection', async () => {
    const image = new Blob(['gallery pixels'], { type: 'image/jpeg' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => image,
    }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    cameraMocks.chooseFromGallery.mockResolvedValueOnce({ results: [mediaResult()] });

    await expect(chooseNativePhotoFromGallery()).resolves.toEqual({
      status: 'success',
      blob: image,
      fileName: 'camera-photo.jpg',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/_capacitor_file_/capture/card.jpg');

    cameraMocks.chooseFromGallery.mockResolvedValueOnce({ results: [] });

    await expect(chooseNativePhotoFromGallery()).resolves.toEqual({ status: 'cancelled' });
    expect(cameraMocks.chooseFromGallery).toHaveBeenCalledWith({
      mediaType: 0,
      allowMultipleSelection: false,
      includeMetadata: true,
    });
  });

  it('distinguishes native capture cancellation and permission denial', async () => {
    cameraMocks.takePhoto.mockRejectedValueOnce({
      code: 'OS-PLUG-CAMR-0006',
      message: 'Capture cancelled',
    });
    await expect(takeNativePhoto()).resolves.toEqual({ status: 'cancelled' });

    cameraMocks.takePhoto.mockRejectedValueOnce({
      code: 'OS-PLUG-CAMR-0003',
      message: 'Permission denied',
    });
    await expect(takeNativePhoto()).resolves.toEqual({
      status: 'error',
      message: 'Camera permission was denied. Allow camera access and try again.',
    });
  });

  it('converts a native URI when the plugin omits webPath and reports unreadable images', async () => {
    const image = new Blob(['captured pixels'], { type: 'image/jpeg' });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => image,
    }) as Response);
    vi.stubGlobal('fetch', fetchMock);
    cameraMocks.takePhoto.mockResolvedValue(mediaResult({ webPath: undefined }));

    await expect(takeNativePhoto()).resolves.toMatchObject({ status: 'success', blob: image });
    expect(cameraMocks.convertFileSrc).toHaveBeenCalledWith('file:///capture/card.jpg');

    fetchMock.mockResolvedValueOnce({ ok: false, blob: async () => image } as Response);
    await expect(takeNativePhoto()).resolves.toEqual({
      status: 'error',
      message: 'The captured photo could not be read.',
    });
  });

  it('restores native camera results through the shared acquisition result queue', async () => {
    const image = new Blob(['restored pixels'], { type: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      blob: async () => image,
    }) as Response));
    let onRestored!: (event: RestoredListenerEvent) => void;
    appMocks.addListener.mockImplementation(async (_eventName, listener) => {
      onRestored = listener;
      return { remove: async () => undefined };
    });
    const received: unknown[] = [];
    const unsubscribe = subscribeToRestoredCameraAcquisition((result) => received.push(result));

    await registerNativeCameraRestoration();
    expect(appMocks.addListener).toHaveBeenCalledWith('appRestoredResult', expect.any(Function));
    onRestored({
      pluginId: 'Camera',
      methodName: 'takePhoto',
      success: true,
      data: mediaResult(),
    });

    await vi.waitFor(() => expect(received).toEqual([{
      status: 'success',
      blob: image,
      fileName: 'camera-photo.jpg',
    }]));
    expect(consumeRestoredCameraAcquisition()).toEqual(received[0]);
    unsubscribe();
  });

  it('returns a user-visible error for restored photos whose native URI cannot be converted', async () => {
    vi.resetModules();
    const {
      consumeRestoredCameraAcquisition: consumeFreshRestoredAcquisition,
      registerNativeCameraRestoration: registerFreshCameraRestoration,
      subscribeToRestoredCameraAcquisition: subscribeFreshToRestoredAcquisition,
    } = await import('../capacitorCameraAcquisition');
    cameraMocks.convertFileSrc.mockImplementation(() => {
      throw new Error('Invalid native URI.');
    });
    let onRestored!: (event: RestoredListenerEvent) => void;
    appMocks.addListener.mockImplementation(async (_eventName, listener) => {
      onRestored = listener;
      return { remove: async () => undefined };
    });
    const received: unknown[] = [];
    const unsubscribe = subscribeFreshToRestoredAcquisition((result) => received.push(result));
    await registerFreshCameraRestoration();

    onRestored({
      pluginId: 'Camera',
      methodName: 'takePhoto',
      success: true,
      data: mediaResult({ webPath: undefined }),
    });

    await vi.waitFor(() => expect(received).toEqual([{
      status: 'error',
      message: 'The captured photo could not be read.',
    }]));
    expect(consumeFreshRestoredAcquisition()).toEqual(received[0]);
    unsubscribe();
  });

  it('reports and retries failed native restoration-listener registration', async () => {
    vi.resetModules();
    const { registerNativeCameraRestoration: registerFreshCameraRestoration } =
      await import('../capacitorCameraAcquisition');
    const registrationError = new Error('Registration failed.');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    appMocks.addListener
      .mockRejectedValueOnce(registrationError)
      .mockResolvedValueOnce({ remove: async () => undefined });

    await expect(registerFreshCameraRestoration()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      'Unable to register native camera restoration. Use the browser file picker if camera results are not restored.',
      registrationError,
    );

    await expect(registerFreshCameraRestoration()).resolves.toBeUndefined();
    expect(appMocks.addListener).toHaveBeenCalledTimes(2);
  });
});
