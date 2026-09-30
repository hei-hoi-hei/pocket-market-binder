# Scanner Feedback and Diagnostic Reports

## Current tester flow

After a scanner result, the tester can explicitly choose **Correct**, **Wrong card**, **No match**, **Error**, or (when Candidate Review is cancelled) **Cancelled**. The tester then chooses **Download feedback JSON**. Nothing is recorded before that explicit download action. A wrong-card report may optionally include a catalog identity selected from the existing manual catalog search; selecting it does not add the card to Binder, Wishlist, or Cart.

The feedback taxonomy describes the tester's assessment:

- `correct`: the suggested result was the card the tester intended to scan.
- `incorrect`: a returned candidate was wrong; a manually selected correct catalog identity is optional.
- `no-match`: no usable candidate matched the tester's card.
- `processing-error`: recognition failed or was unavailable, or the tester reports an error.
- `cancelled`: the tester cancelled Candidate Review. Replacing/removing an image during an in-flight match still follows the existing cancellation lifecycle and does not emit a result automatically.

## Report schema

The downloaded JSON uses schema version 1:

```json
{
  "schemaVersion": 1,
  "reportedAt": "2026-09-30T12:34:56.000Z",
  "scannerVersion": "local-reference-phash-dct-64-v1",
  "matcherId": "local-reference",
  "outcome": "incorrect",
  "resultType": "success",
  "predictedCatalogId": "catalog-id-suggested-by-matcher",
  "predictedCatalogProvider": "tcgdex",
  "confirmedIdentity": {
    "catalogProvider": "tcgdex",
    "catalogId": "manually-selected-catalog-id",
    "gameKey": "pokemon",
    "language": "en",
    "variant": "normal"
  },
  "candidateCount": 1,
  "processingDurationMs": 18,
  "imageDimensions": { "width": 1200, "height": 1600 }
}
```

Fields are omitted when unavailable. `confirmedIdentity` is present only for `incorrect` feedback when the tester explicitly selects a catalog entry. `errorCategory`, when relevant, is a fixed category; raw error messages are not included. Browser/runtime, capture mode, filename, file size, and raw OCR text are not currently included because the acquisition/matcher path does not need to expose them for this report.

`resultType` mirrors the scanner statuses `success`, `no-match`, `unavailable`, or `error`. `errorCategory` is one of `recognition-unavailable`, `recognition-failed`, `recognition-cancelled`, `user-cancelled-review`, or `tester-reported-error`.

## Privacy and storage

Feedback is an explicit local JSON download. The report builder accepts only normalized result metadata, not an image `Blob`; photos, preview URLs, filenames, candidate names, personal names, account identifiers, and raw error strings are excluded. Reports are not written to IndexedDB and are not uploaded or sent to a service. The selected photo remains under the existing transient scanner lifecycle and is not attached to feedback. The optional correction search is a separate user-initiated request to the existing catalog service; it does not transmit the scanner photo.

A future beta endpoint could consume the same versioned report schema behind a separate explicit submission and privacy decision. No endpoint, cloud storage, authentication, or submission control exists in this checkpoint.

## Live feedback versus benchmark evidence

A live tester report is a subjective diagnostic signal and contains no photo. It can help triage a failure category or identify a candidate mismatch, but it is not an adjudicated prediction and does not count toward benchmark accuracy, the physical-photo corpus, or the held-out evidence gate.

To turn a report into a future regression specimen, a curator would need a separately and explicitly contributed photo, permission to retain/use it, verified ground-truth card identity and capture metadata, a private manifest row, and a split assignment that prevents reference/held-out leakage. That work stays outside the app's automatic feedback flow and outside Git unless the data is separately approved for repository distribution. Controlled benchmark procedures and thresholds remain defined in [SCANNER_BENCHMARK.md](SCANNER_BENCHMARK.md).
