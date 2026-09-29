import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { useImageAcquisition } from '@/hooks/useImageAcquisition';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNav } from '@/context/NavContext';
import { CandidateReview } from '@/components/scanner/CandidateReview';
import { identifyImageWithProviders } from '@/services/scanner/scannerOrchestration';
import { createLocalReferenceScannerProvider } from '@/services/scanner/localReferenceMatcher';
import type {
  ConfirmedScannerCandidate,
  ScannerIdentificationResult,
} from '@/services/scanner/types';

interface ScannerScreenProps {
  reviewResult?: ScannerIdentificationResult | null;
  onCandidateConfirmed?: (candidate: ConfirmedScannerCandidate) => void;
}

export function ScannerScreen(props: ScannerScreenProps) {
  const { go } = useNav();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionController = useRef<AbortController | null>(null);
  const { image, error, selectFile, clearImage, handlePreviewError } = useImageAcquisition();
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [localResult, setLocalResult] = useState<ScannerIdentificationResult | null>(null);
  const [matching, setMatching] = useState(false);
  const reviewResult = props.reviewResult === undefined ? localResult : props.reviewResult;

  useEffect(() => {
    setReviewDismissed(false);
  }, [reviewResult]);

  useEffect(() => () => recognitionController.current?.abort(), []);

  const openFilePicker = () => inputRef.current?.click();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    recognitionController.current?.abort();
    setLocalResult(null);
    setMatching(false);
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const handleClearImage = () => {
    recognitionController.current?.abort();
    setLocalResult(null);
    setMatching(false);
    clearImage();
  };

  const handleIdentify = async () => {
    if (!image) return;
    recognitionController.current?.abort();
    const controller = new AbortController();
    recognitionController.current = controller;
    setMatching(true);
    setLocalResult(null);
    try {
      const provider = createLocalReferenceScannerProvider();
      const result = await identifyImageWithProviders([provider], image.file, controller.signal);
      if (!controller.signal.aborted) setLocalResult(result);
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
          Match against local references from previously confirmed cards. First-time cards can be found with manual catalog search.
        </p>
      </ScreenHeader>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Choose a card picture"
      />

      {!image ? (
        <section className="bg-white rounded-xl p-6 shadow-sm border border-parchment-200 text-center">
          <ImagePlus className="w-10 h-10 mx-auto mb-3 text-leather-400" />
          <h2 className="font-display text-xl text-leather-800 mb-1">Provide a card picture</h2>
          <p className="text-sm text-leather-500 mb-5">
            Your browser may offer the camera, gallery, or a desktop file picker.
          </p>
          <button
            type="button"
            onClick={openFilePicker}
            className="bg-leather-700 text-white font-bold text-sm px-4 py-2.5 rounded-lg inline-flex items-center gap-2 hover:bg-leather-800 transition-colors active:scale-95"
          >
            <Camera className="w-4 h-4" /> Take Photo / Choose Picture
          </button>
        </section>
      ) : (
        <section className="bg-white rounded-xl p-4 shadow-sm border border-parchment-200">
          <div className="relative bg-parchment-100 rounded-lg overflow-hidden aspect-[3/4] max-w-sm mx-auto">
            <img
              src={image.previewUrl}
              alt="Selected card preview"
              className="w-full h-full object-contain"
              onError={handlePreviewError}
            />
          </div>
          <p className="text-xs text-leather-500 mt-3 truncate" title={image.file.name}>
            Selected: {image.file.name}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={openFilePicker}
              className="bg-parchment-200 text-leather-700 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Replace Picture
            </button>
            <button
              type="button"
              onClick={handleClearImage}
              className="bg-parchment-200 text-fire-600 font-bold text-sm px-3 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-parchment-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Remove Picture
            </button>
          </div>
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
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Matching Local References...</>
              : <><AlertCircle className="w-4 h-4" /> Match Local References</>}
          </button>
        </section>
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
            openFilePicker();
          }}
          onCancel={() => setReviewDismissed(true)}
          onManualSearch={() => go('search')}
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
