# Scanner Recognition Benchmark (Development Only)

The scanner benchmark under `scripts/` is isolated development tooling. It does not configure or call a production scanner provider. The default fixture set contains six clean TCGdex card scans and is not representative of phone photographs.

## Supplying local card photographs

Create a private JSON manifest and image directory outside source control. Run:

```text
npm run benchmark:scanner -- --fixtures C:\path\to\scanner-fixtures.json
```

The following is a schema example only; the image, capture description, and measurements are not supplied benchmark data. Each real manifest row identifies the expected catalog record, the clues to check, and a local image path relative to the manifest:

```json
[
  {
    "id": "sv03.5-006",
    "name": "Charizard ex",
    "collectorNumber": "006",
    "setCode": "sv03.5",
    "layout": "modern ex",
    "condition": "indoor warm light, slight rotation, dark background",
    "imagePath": "photos/card-01.jpg",
    "imageWidth": 3024,
    "imageHeight": 4032,
    "nameRegion": { "left": 0.08, "top": 0.04, "width": 0.84, "height": 0.16 },
    "collectorNumberRegion": { "left": 0.04, "top": 0.82, "width": 0.92, "height": 0.14 }
  }
]
```

Local fixtures require pixel dimensions as decoded and optional normalized `[0,1]` crop rectangles for the name and collector-number areas. If omitted, the existing upper 22.5% / lower 21.9% crop proportions are scaled to the image dimensions. Choose rectangles that cover the relevant printed text while preserving realistic capture conditions; do not digitally clean, sharpen, rectify, or otherwise improve the photo for this initial benchmark. `layout` and `condition` are descriptive labels only.

The expected `id` must be an existing catalog ID and is used only to score whether that record appears in search results. The matcher queries TCGdex using the OCR name, so benchmark runs require network access for matching; a first run may also fetch Tesseract's English language data. Image files are read locally and are not uploaded by the OCR stage. Reports identify local images by filename only.

## Measurements and limitations

Per-fixture OCR/matching records raw name-region, collector-region, and whole-image OCR text; exact and normalized name/number comparisons; whether normalized OCR output contains any non-empty name or collector-number text (`ocrUsable`); TCGdex candidate count; whether and where the expected catalog ID appeared; OCR timings; and worker initialization time. `ocrUsable` is only a non-empty output indicator; correctness is represented by the exact/normalized comparison fields. Per-fixture matching passes OCR name, collector number, and raw OCR text; it does not pass an OCR set-code clue. Separate controlled text-matcher cases exercise matching with and without supplied set-code clues. The benchmark does not measure set-code OCR extraction or report an ambiguity rate. Because the current TCGdex adapter turns request failures into empty search results, an empty match list cannot be distinguished from a genuine no-match.

These measurements do not estimate production accuracy, confidence calibration, camera permission behavior, or collection safety. Per-fixture candidate matching searches by OCR name and ranks returned catalog cards using name and collector-number evidence; controlled cases separately exercise set-code matching. Tesseract's fixed English language/model is the only OCR evaluated. The benchmark does not compare providers and cannot establish statistical significance from a small corpus.

## Minimum evidence before provider selection

Collect at least 60 distinct physical card photographs from multiple collectors/devices, with a predefined held-out set of at least 20 images. Include at least 10 examples in each material capture condition (mixed lighting, rotation/perspective, clutter/background, and reduced image quality), spanning at least 6 card layouts/eras. Include readable and partially obscured text, while retaining labels for the expected card ID and capture conditions. Avoid repeated photos of the same card as independent examples.

Report the sample size and per-condition as well as aggregate name, collector-number, and exact-catalog-match rates; ambiguity/no-match and OCR failure rates; and timings. Provider selection should require repeatable held-out results, a documented error review, and an explicit product/privacy/terms decision—not a single aggregate score or this small sample alone. Do not claim statistical significance unless the sample and analysis support it.

The manifests, photographs, downloaded cache, and generated reports may contain private collection imagery or labels. `.gitignore` excludes the default `benchmark-cache/` and `benchmark-results/` output directories; custom fixture manifests and image directories remain the user's responsibility to keep private and out of Git.
