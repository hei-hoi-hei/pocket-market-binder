import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { useImageAcquisition } from '@/hooks/useImageAcquisition';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNav } from '@/context/NavContext';
import { CandidateReview } from '@/components/scanner/CandidateReview';
import { ReferenceEnrollment } from '@/components/scanner/ReferenceEnrollment';
import { ScannerFeedback } from '@/components/scanner/ScannerFeedback';
import { identifyImageWithProviders } from '@/services/scanner/scannerOrchestration';
import { createScannerProviders } from '@/services/scanner/scannerProviders';
import {
  chooseNativePhotoFromGallery,
  consumeRestoredCameraAcquisition,
  isNativeCameraAvailable,
  subscribeToRestoredCameraAcquisition,
  takeNativePhoto,
} from '@/services/scanner/capacitorCameraAcquisition';
import type { ImageAcquisitionResult } from '@/services/scanner/imageAcquisition';
import type {
  ConfirmedScannerCandidate,
  ScannerIdentificationResult,
} from '@/services/scanner/types';
import { getScannerFeedbackMatcherId } from '@/services/scanner/scannerFeedback';

interface ScannerScreenProps {
  reviewResult?: ScannerIdentificationResult | null;
  onCandidateConfirmed?: (candidate: ConfirmedScannerCandidate) => void;
}

export function ScannerScreen(props: ScannerScreenProps) {
  const { go } = useNav();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recognitionController = useRef<AbortController | null>(null);
  const acquisitionRequest = useRef(0);
  const { image, error, selectFile, acceptAcquisition, clearImage, handlePreviewError } = useImageAcquisition();
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [reviewCancelled, setReviewCancelled] = useState(false);
  const [localResult, setLocalResult] = useState<ScannerIdentificationResult | null>(null);
  const [localResultDurationMs, setLocalResultDurationMs] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    previewUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [matching, setMatching] = useState(false);
  const [acquiringImage, setAcquiringImage] = useState(false);
  const [enrollingReference, setEnrollingReference] = useState(false);
  const nativeCameraAvailable = isNativeCameraAvailable();
  const reviewResult = props.reviewResult === undefined ? localResult : props.reviewResult;

  useEffect(() => {
    setReviewDismissed(false);
    setReviewCancelled(false);
  }, [reviewResult]);

  useEffect(() => () => {
    acquisitionRequest.current += 1;
    recognitionController.current?.abort();
  }, []);

  useEffect(() => {
    const applyRestoredAcquisition = (result: ImageAcquisitionResult) => {
      consumeRestoredCameraAcquisition();
      if (result.status === 'cancelled') return;
      if (result.status === 'success') {
        acquisitionRequest.current += 1;
        recognitionController.current?.abort();
        setMatching(false);
        setLocalResult(null);
        setEnrollingReference(false);
      }
      acceptAcquisition(result);
    };

    const restored = consumeRestoredCameraAcquisition();
    if (restored) applyRestoredAcquisition(restored);
    return subscribeToRestoredCameraAcquisition(applyRestoredAcquisition);
  }, [acceptAcquisition]);

  const openCameraPicker = () => {
    acquisitionRequest.current += 1;
    setAcquiringImage(false);
    cameraInputRef.current?.click();
  };

  const openGalleryPicker = () => {
    acquisitionRequest.current += 1;
    setAcquiringImage(false);
    galleryInputRef.current?.click();
  };

  const acquireCamera = () => {
    if (nativeCameraAvailable) {
      void handleNativeAcquisition(takeNativePhoto);
    } else {
      openCameraPicker();
    }
  };

  const acquireGallery = () => {
    if (nativeCameraAvailable) {
      void handleNativeAcquisition(chooseNativePhotoFromGallery);
    } else {
      openGalleryPicker();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acquisitionRequest.current += 1;
    setAcquiringImage(false);
    setEnrollingReference(false);
    recognitionController.current?.abort();
    setLocalResult(null);
    setLocalResultDurationMs(null);
    setMatching(false);
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const handleClearImage = () => {
    acquisitionRequest.current += 1;
    setAcquiringImage(false);
    setEnrollingReference(false);
    recognitionController.current?.abort();
    setLocalResult(null);
    setLocalResultDurationMs(null);
    setMatching(false);
    clearImage();
  };

  const handleImagePreviewError = () => {
    recognitionController.current?.abort();
    setLocalResult(null);
    setLocalResultDurationMs(null);
    setMatching(false);
    setEnrollingReference(false);
    handlePreviewError();
  };

  const handleNativeAcquisition = async (
    acquire: () => Promise<ImageAcquisitionResult>,
  ) => {
    const requestId = ++acquisitionRequest.current;
    setAcquiringImage(true);
    try {
      const result = await acquire();
      if (requestId === acquisitionRequest.current) {
        if (result.status === 'success') {
          recognitionController.current?.abort();
          setMatching(false);
          setLocalResult(null);
          setEnrollingReference(false);
        }
        acceptAcquisition(result);
      }
    } catch (acquisitionError) {
      if (requestId === acquisitionRequest.current) {
        acceptAcquisition({
          status: 'error',
          message: acquisitionError instanceof Error && acquisitionError.message
            ? acquisitionError.message
            : 'The image could not be acquired. Please try again.',
        });
      }
    } finally {
      if (requestId === acquisitionRequest.current) setAcquiringImage(false);
    }
  };

  const handleIdentify = async () => {
    if (!image) return;
    recognitionController.current?.abort();
    const controller = new AbortController();
    recognitionController.current = controller;
    const startedAt = performance.now();
    setMatching(true);
    setLocalResult(null);
    setLocalResultDurationMs(null);
    try {
      const result = await identifyImageWithProviders(
        createScannerProviders(),
        image.blob,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setLocalResult(result);
        setLocalResultDurationMs(Math.max(0, Math.round(performance.now() - startedAt)));
      }
    } catch {
      if (!controller.signal.aborted) {
        setLocalResult({
          status: 'error',
          message: 'Recognition could not be completed.',
          retryable: true,
          source: 'fusion',
        });
        setLocalResultDurationMs(Math.max(0, Math.round(performance.now() - startedAt)));
      }
    } finally {
      if (!controller.signal.aborted) setMatching(false);
    }
  };

  const handleCandidateConfirmed = (candidate: ConfirmedScannerCandidate) => {
    props.onCandidateConfirmed?.(candidate);
  };

  return (
    <div className="animate-fade-in">
      <ScreenHeader
        title="Scan Card"
        icon={<Camera className="w-7 h-7 text-leather-600" />}
        action={
          <button
            type="button"
            onClick={() => go('home')}
            className="p-2 text-leather-500 hover:text-leather-800 rounded-lg"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        }
      >
        <p className="text-sm text-leather-500">
          Run available recognition providers on a card photo. If no candidate is found, search the catalog manually.
        </p>
      </ScreenHeader>

      <input
        id="scanner-camera-input"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Take a card photo"
      />
      <input
        id="scanner-gallery-input"
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Choose a card photo from the gallery"
      />

      {!image ? (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-parchment-200 text-center">
          <ImagePlus className="w-10 h-10 mx-auto mb-3 text-leather-400" />
          <h2 className="font-display text-xl text-leather-800 mb-1">Provide a card picture</h2>
          <p className="text-sm text-leather-500 mb-5">
            Your browser may offer the camera, gallery, or a desktop file picker.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={acquireCamera}
              disabled={acquiringImage}
              className="bg-leather-700 text-white font-bold text-sm px-4 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-leather-800 disabled:opacity-60"
            >
              <Camera className="w-4 h-4" /> {acquiringImage ? 'Opening Camera...' : 'Take Photo'}
            </button>
            <button
              type="button"
              onClick={acquireGallery}
              disabled={acquiringImage}
              className="bg-parchment-200 text-leather-700 font-bold text-sm px-4 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-parchment-300 disabled:opacity-60"
            >
              <ImagePlus className="w-4 h-4" /> Choose from Gallery
            </button>
            {nativeCameraAvailable && (
              <button
                type="button"
                onClick={openGalleryPicker}
                className="bg-parchment-200 text-leather-700 font-bold text-sm px-4 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-parchment-300"
              >
                <ImagePlus className="w-4 h-4" /> Use File Picker
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-xl p-4 shadow-sm border border-parchment-200">
          <div className="relative bg-parchment-100 rounded-lg overflow-hidden aspect-[3/4] max-w-sm mx-auto">
            <img
              src={image.previewUrl}
              alt="Selected card preview"
              className="w-full h-full object-contain"
              onLoad={(event) => setImageDimensions({
                previewUrl: image.previewUrl,
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
              onError={handleImagePreviewError}
            />
          </div>
          <p className="text-xs text-leather-500 mt-3 truncate" title={image.fileName}>
            Selected: {image.fileName}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={acquireCamera}
              disabled={acquiringImage}
              className="bg-parchment-200 text-leather-700 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300 transition-colors disabled:opacity-60"
            >
              <Camera className="w-4 h-4" /> {acquiringImage ? 'Opening Camera...' : 'Take New Photo'}
            </button>
            <button
              type="button"
              onClick={acquireGallery}
              disabled={acquiringImage}
              className="bg-parchment-200 text-leather-700 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300 disabled:opacity-60"
            >
              <ImagePlus className="w-4 h-4" /> Choose from Gallery
            </button>
            {nativeCameraAvailable && (
              <button
                type="button"
                onClick={openGalleryPicker}
                className="bg-parchment-200 text-leather-700 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300"
              >
                <RefreshCw className="w-4 h-4" /> Use File Picker
              </button>
            )}
            <button
              type="button"
              onClick={handleClearImage}
              className="bg-parchment-200 text-fire-600 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Remove Picture
            </button>
          </div>
          {!enrollingReference && (
            <button
              type="button"
              onClick={() => setEnrollingReference(true)}
              className="mt-3 text-sm font-semibold text-gold-700 hover:underline"
            >
              Save as recognition reference
            </button>
          )}
          <div className="mt-5 rounded-lg border border-gold-300 bg-gold-50 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-gold-700 shrink-0" />
              <div>
                <p className="text-sm font-bold text-leather-800">Picture ready for the scanner pipeline</p>
                <p className="text-xs text-leather-600 mt-1">
                  Matching runs locally against saved references. This image is temporary and is not uploaded, retained, or added to your binder.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleIdentify}
            disabled={matching}
            className="mt-4 w-full bg-leather-700 text-white font-bold text-sm px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 hover:bg-leather-800 disabled:cursor-wait disabled:opacity-70"
          >
            {matching
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Recognizing Card...</>
              : <><AlertCircle className="w-4 h-4" /> Recognize Card</>}
          </button>
        </section>
      )}

      {enrollingReference && (
        <ReferenceEnrollment
          image={image?.blob ?? null}
          onClose={() => setEnrollingReference(false)}
        />
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-fire-200 bg-fire-50 p-3 text-sm text-fire-700">
          {error}
        </div>
      )}

      {reviewResult && !reviewDismissed && (
        <CandidateReview
          result={reviewResult}
          onConfirm={handleCandidateConfirmed}
          onRetry={() => {
            setReviewDismissed(true);
            setLocalResult(null);
            setLocalResultDurationMs(null);
            openGalleryPicker();
          }}
          onCancel={() => {
            setReviewDismissed(true);
            setReviewCancelled(true);
          }}
          onManualSearch={() => go('search')}
        />
      )}

      {reviewResult && (
        <ScannerFeedback
          result={reviewResult}
          matcherId={getScannerFeedbackMatcherId(reviewResult)}
          processingDurationMs={props.reviewResult === undefined ? localResultDurationMs ?? undefined : undefined}
          imageDimensions={image && imageDimensions?.previewUrl === image.previewUrl
            ? { width: imageDimensions.width, height: imageDimensions.height }
            : undefined}
          allowCancelled={reviewCancelled || (
            reviewResult.status === 'error' && reviewResult.message === 'Recognition was cancelled.'
          )}
        />
      )}

      <button
        type="button"
        onClick={() => go('search')}
        className="mt-5 text-sm font-semibold text-gold-700 hover:underline"
      >
        Prefer manual catalog search? Browse cards
      </button>
    </div>
  );
}
