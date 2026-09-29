# Scanner Recognition Benchmark (Development Only)

## Current implementation

The scanner service is provider-neutral: `ScannerProvider.identify` receives a transient image `Blob` and returns an untrusted result that is normalized to `ScannerIdentificationResult`. Successful results contain ordered `ScannerCandidate` values with optional canonical catalog-ID suggestions, name/set/collector clues, confidence, evidence, normalized image region, and primitive provider metadata. The provider name is attached to the result. A catalog-ID suggestion remains unverified; it is not a `Card` and does not assign identity.

`CandidateReview` requires explicit user confirmation and emits `ConfirmedScannerCandidate`. The separate catalog-identity boundary accepts only that confirmed type and currently requires name, set code, and collector number to resolve against catalog results; it does not use an ID-only suggestion as an identity decision. Neither boundary mutates collection state. Manual catalog search remains available.

Image acquisition is a browser file input with `accept="image/*"` and `capture="environment"` plus a temporary object-URL preview. Browser/device picker behavior varies. There is no `getUserMedia`, `MediaDevices`, `ImageCapture`, native camera plugin, configured recognition provider, or production recognition path. The explicit offline provider returns unavailable; it does not recognize images.

The development runner under `scripts/` is narrower than the contract: it runs Tesseract English OCR, crops name/collector regions, queries TCGdex with OCR text, and ranks catalog cards. It is not a production integration or multi-provider benchmark. The six checked-in fixtures are clean TCGdex scans, not phone photographs. The runner requires network for TCGdex matching and may fetch Tesseract's English language data on first use. OCR images are read locally and are not uploaded by that OCR step; matching sends the OCR name to TCGdex. Request failures currently become empty search results, so an empty result cannot reliably distinguish provider failure from a true no-match.

## Local photo manifests

Use a private manifest and local image directory outside the repository:

```text
npm run benchmark:scanner -- --fixtures C:\path\to\scanner-fixtures.json
```

Example schema (descriptive tags are labels, not a prescribed corpus):

```json
[
  {
    "id": "sv03.5-006",
    "name": "Charizard ex",
    "collectorNumber": "006",
    "setCode": "sv03.5",
    "layout": "modern ex",
    "condition": "front-facing, indoor light, sleeved",
    "captureConditions": ["lighting-good", "perspective-straight", "background-busy", "sleeved"],
    "cardCharacteristics": ["modern-pokemon", "special-art", "similar-name-neighbor"],
    "language": "en",
    "imagePath": "photos/card-01.jpg",
    "imageWidth": 3024,
    "imageHeight": 4032,
    "nameRegion": { "left": 0.08, "top": 0.04, "width": 0.84, "height": 0.16 },
    "collectorNumberRegion": { "left": 0.04, "top": 0.82, "width": 0.92, "height": 0.14 }
  }
]
```

For a catalog-match example, `id` is the expected existing TCGdex catalog ID and `expectedOutcome` may be omitted or set to `"match"`. A local no-match/unsupported example sets `"expectedOutcome": "no-match"`, omits `id`, and supplies its actual local `imagePath`; the expected name, collector number, and set code fields remain required ground-truth labels even if the ID is not in TCGdex. The current text matcher counts any returned candidate on a no-match example as a false positive. `imagePath` is relative to the manifest unless absolute. Local image rows require pixel dimensions and may include normalized `[0,1]` crop rectangles. The runner uses these regions for OCR and otherwise applies the existing upper-name/lower-collector defaults. Do not digitally clean, sharpen, rectify, or otherwise improve photos for the initial evidence pass. Keep images genuine and retain capture-condition labels.

`captureConditions` and `cardCharacteristics` are optional searchable labels. Use condition labels that allow per-condition reports, for example:

- Capture: `perspective-straight`, `perspective-slight`, `perspective-significant`; `lighting-good`, `lighting-dim`, `glare`, `shadow`; `background-clean`, `background-busy`; `sleeved`, `unsleeved`; `crop-complete`, `crop-partial`, `obstructed`.
- Card: `modern-pokemon`, `older-pokemon`, `common-uncommon`, `holo`, `reverse-holo`, `special-art`, `similar-name-neighbor`, `similar-art-neighbor`, `similar-number-neighbor`.

Choose labels that describe the actual photo/card, not a quality judgment. Include Japanese or other language only as a separately labeled exploratory subset: the current catalog path is English TCGdex, so cross-language exact catalog matching is not established and those images must not inflate English-scope accuracy.

No representative real card photographs or real-photo recognition results are checked into the repository. Do not commit private collection photos or manifests containing sensitive collection details. Keep generated reports and OCR caches in the ignored `benchmark-results/` and `benchmark-cache/` directories; custom image paths/manifests remain the contributor's responsibility to keep out of Git. Reports identify local images by filename only, but OCR text and expected identities may still be sensitive.

## Provider-neutral result and review contract

When additional providers are evaluated, preserve the same labeled image corpus and record one result per image/provider using the existing normalized `ScannerIdentificationResult` shape:

- `success`: ordered candidates, each with only evidenced fields, candidate evidence, optional `catalogId` suggestion/region, and provider metadata; result `source` identifies the provider.
- `no-match`: the provider completed and returned no candidates.
- `unavailable` or `error`: record distinctly; do not count either as a correct no-match.
- Keep the expected catalog identity in the manifest, not in the provider result.
- A catalog-ID suggestion is a proposed candidate clue only. Candidate review and explicit confirmation remain required; identity resolution and collection mutation stay separate.

The current OCR runner does not yet run arbitrary `ScannerProvider` implementations, emit this full provider-neutral result record, or classify unavailable/error separately from empty matches. Its no-match fixture support applies only to local photos scored against the current TCGdex text matcher. These are benchmark-runner limitations to resolve when there is a real recognition provider to compare; this document does not claim those capabilities already exist.

## Evaluation method

Report raw counts and denominators alongside every rate, both aggregate and by capture-condition/card-characteristic tag. Do not collapse results into an arbitrary provider score.

- **Top-1 accuracy:** among labeled catalog-match images, the first candidate is the exact expected catalog ID.
- **Top-3 candidate recall:** among labeled catalog-match images, the expected catalog ID appears in the first three review candidates. This is the most important initial Binder usefulness metric; there is no silent auto-add.
- **No-match rate:** fraction of completed inputs explicitly returned as `no-match`; report separately for known catalog matches and labeled no-match/unsupported inputs.
- **Uncertain rate:** report provider-declared uncertainty or human-adjudicated ambiguous/unusable outcomes separately. Do not invent a confidence threshold after seeing results; define any threshold and review rule before evaluation.
- **False-positive rate:** for labeled no-match/unsupported inputs, fraction for which the provider presents at least one concrete catalog candidate. Also report wrong top-1 IDs on known-match images separately.
- **Latency:** report cold initialization/model load separately from per-image warm latency; include median and p95 where sample size supports it.
- **Offline/on-device:** record whether image recognition succeeds with networking disabled after install, and whether model/language data must first be downloaded. Separate recognition networking from catalog lookup networking.
- **Network and privacy:** record image bytes sent off-device, destinations, OCR/result transmission, image persistence/retention, and whether consent is required. Verify from provider behavior/network observation, not marketing claims.
- **Resource requirements:** record runtime/browser/device constraints, model or language-data downloads, approximate memory/CPU use, and any device limitations observed.
- **Bundle/application size:** measure production JavaScript/WASM and separately report model/language assets and their download size; the OCR development dependency alone does not establish production bundle cost.
- **Licensing:** record code/model/data licenses and attribution, redistribution, commercial-use, and training-data constraints before selection.

For a first comparative evidence set, collect at least 60 distinct physical card photographs from multiple devices/collectors, with at least 20 held out from any tuning or preprocessing choices. Keep held-out card identities disjoint from any tuning examples where feasible. Include at least 10 examples in each material capture condition (mixed/dim lighting, glare/shadow, rotation/perspective, clutter/background, and reduced image quality), spanning at least six supported card layouts/eras. Include readable and partially obscured text, finishes/variants, and similar-name/art/number neighbors. Include explicitly labeled no-match/unsupported examples before measuring false positives. Avoid treating repeated captures of one physical card as independent cards.

Report exact and normalized name/collector-number accuracy in addition to catalog-ID metrics. Review errors by condition; a large aggregate result must not conceal a failure on a practical capture subgroup. A small corpus is directional evidence, not statistical significance. Provider selection requires repeatable held-out results, documented error review, and separate product, privacy, licensing, and cost decisions.

## Feasibility based on this repository

No option is selected. Evaluate only after obtaining the real-photo corpus:

| Approach category | Repository evidence and feasibility questions |
|---|---|
| OCR/text extraction | `tesseract.js` is already installed and used by the development benchmark only. It is a realistic comparison baseline for printed name/number clues, but benchmark English results do not establish mobile performance, production bundle impact, or a complete identity. |
| Image similarity / perceptual matching | `Card` carries TCGdex low/high artwork URLs, and artwork resolution preserves source/canonical-identity metadata. These could seed a later local/hybrid reference index, but no image embeddings, matching index, full-card dataset, or rights-cleared offline catalog corpus exists. Exact printing, variants, and near-duplicate art require evidence. |
| Local ML/image recognition | The app is a React/Vite PWA and has browser image acquisition; no production ML runtime/model is configured. Browser CPU/WASM/WebGPU availability, model delivery/size, device memory/latency, licensing, and offline behavior must be measured on target phones. |
| Remote recognition | The current `ScannerProvider` contract explicitly requires transient processing without upload or persistence. Supporting a remote service would require a deliberate privacy-contract change, clear user consent, endpoint/credential review, and cost approval; none exists. An image upload cannot be introduced by implication. |
| Hybrid recognition | Local OCR/image clues could be combined with the current TCGdex catalog search/resolver boundary, but candidate ranking, ambiguity, provider errors, and online/offline transitions need held-out photo results. TCGdex search availability is supplemental; IndexedDB collection remains authoritative. |
| Metadata-assisted identification | The current TCGdex catalog provides canonical IDs, names, set/collector identifiers, and artwork URLs; the separate catalog-identity boundary can check name, set code, and collector number after explicit candidate confirmation. Coverage is currently one Pokémon catalog provider and no production scanner emits usable clues. |

TCGdex artwork is reference data, not a bundled image-recognition dataset. Catalog/artwork coverage, exact-printing evidence, offline availability, terms, and usage eligibility must be checked before any derived local index or cached training/reference corpus is distributed. Keep pricing separate from recognition/identity and preserve the future PMB shared-reference backend as an optional source/cache path, not collection authority.
