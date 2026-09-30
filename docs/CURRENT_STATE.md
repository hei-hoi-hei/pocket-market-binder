# Pocket Market Binder — Authoritative Current State

**Status:** Current baseline and roadmap authority
**Last reconciled:** 2026-09-21

This document is authoritative for the current repository state and near-term roadmap. It supersedes conflicting release claims in older handoff documents without deleting their historical context.

## Documentation hierarchy

1. `CURRENT_STATE.md` — authoritative implementation state and lifecycle classification.
2. `POCKET_MARKET_BINDER_BUILD_PLAN.md` — authoritative development order and phase gates.
3. `POCKET_MARKET_BINDER_ARCHITECTURE_DECISIONS.md` — authoritative architectural invariants.
4. `POCKET_MARKET_BINDER_PRODUCT_SPEC.md` — product intent and constraints; historical scope statements remain useful where not superseded here.
5. `ARCHITECTURE.md`, `DATA_SOURCES.md`, and `PROJECT_CONTEXT.md` — supporting descriptions that must be read against this baseline.
6. `AI_HANDOFF.md` — historical release handoff; it is not the current implementation authority.

## Classification rules

- **IMPLEMENTED:** Working and present in the repository.
- **PARTIAL:** A foundation exists, but important behavior is incomplete.
- **IN PROGRESS:** Uncommitted work currently exists in the working tree.
- **DEFERRED:** Explicitly intended but postponed, with a documented boundary or reason.
- **MISSING / COMMITTED:** Part of the intended architecture or product but not implemented.
- **OPTIONAL / FUTURE:** Useful possibility, not a committed requirement.
- **UNKNOWN:** Discussed or plausible, but commitment cannot be established from repository evidence.
- **INTENTIONALLY REMOVED:** Use only when an explicit removal decision exists.

## V1 scope rule

The authoritative V1 boundary is **Card Reference + Market Value + Acquisition Calculator**. V1 includes exact card reference, artwork/reference information, attributed market observations and normalized market value/range, local-first binder state, and the existing virtual cart as an offline acquisition-cost planner. The cart does not discover sellers or listings. Marketplace acquisition discovery (active listings, sellers/stores, asking prices, purchase links, and “find another copy”) is V2. V1 does not require a backend, login, paid APIs, or marketplace scraping.

## V1 local reference and backup boundary

V1 uses provider adapters and local IndexedDB caches directly. A PMB backend/API
and shared reference cache are optional future extensions, not V1 dependencies.
They do not own or replace a user's Binder.

```text
External Providers
(TCGdex / pricing / artwork / future providers)
             ↓
      Optional Future Backend / API
             ↓
     Shared Reference Cache
             ↓
        User Device
             ↓
       Local IndexedDB
             ↓
             UI
```

If implemented later, a backend could normalize provider responses, retain
source/provenance and freshness/version metadata, deduplicate upstream requests,
apply rate limits, and serve shared cached data. Such a backend is not required
for V1. Current request paths are:

```text
Cold:              User → Provider adapter → User/device cache
Warm device cache: User → IndexedDB → User
```

The optional backend is not implemented and no vendor is selected. External
providers supply data but are not the application's source of truth.

### Local-first state and cache separation

- **User-owned durable data:** Binder, Wishlist, Cart, quantities, notes/user metadata, and preferences remain in local IndexedDB and usable offline or during provider outages.
- **Local reference cache:** reusable catalog metadata, eligible artwork, and normalized provider/reference information may be cached locally. A shared server cache is optional future work.
- **Temporary/request cache:** search responses, transient provider results, short-lived price lookups, and recognition attempts/results are disposable and must not be confused with user-owned records.
- IndexedDB collection state is durable user data, not disposable cache. Existing local reference caches remain distinct from collection records.
- Shared artwork may only be cached/served when source terms and technical conditions permit. Provider hosting does not itself grant redistribution rights; preserve exact-printing evidence, provenance, and explicit eligible/unresolved/ineligible usage status.

### V1 backup/restore boundary

Manual export/import is independent of reference caching. Backups primarily preserve user-owned data: Binder, Wishlist, Cart, quantities, notes/user metadata, preferences, and any schema version needed for restoration. Automatic or remote backup is optional future work and must not require a V1 backend or login. External images, reference records, and disposable provider responses can be fetched again where available.

**A shared cache is not user backup. IndexedDB collection state is not disposable cache.** No backend or remote backup service is implemented.

## Current baseline

### IMPLEMENTED

- React 18 + TypeScript + Vite mobile-first PWA shell.
- Responsive navigation, binder, search, card detail, wishlist, and cart flows.
- Manual catalog search and manual binder addition.
- IndexedDB persistence with isolated user/catalog/pricing key spaces.
- Legacy `localStorage` migration.
- Binder quantities, wishlist, and the virtual acquisition cart with local planned-cost and `price-guide` Market Reference totals/comparison.
- TCGdex-backed Pokémon catalog search/detail mapping and catalog caching.
- High/low catalog artwork URL selection and UI/procedural fallback behavior where applicable.
- Collection JSON export, merge import, and overwrite import.
- Pricing observation types, provider interface, caching, aggregation, normalization, median/outlier logic, and confidence statuses.
- Basic sync contracts, outbox storage, migration scaffolding, Supabase adapter, and conflict-resolution components.
- PWA manifest, service-worker registration, Workbox configuration, and offline shell support.

### PARTIAL

- **Catalog:** Provider abstraction and category registry exist, but only one live Pokémon provider is registered. There is no source resolver, provider priority, fallback, or enrichment pipeline.
- **Canonical identity:** Identity types and verification service exist, but no identity provider is registered and no user-facing verification flow exists. Identity verification is not image recognition.
- **Pricing:** Architecture is substantially present. The TCGdex adapter maps guide metrics into attributed observations; default market-value consolidation uses only `price-guide` class data. Other transaction classes require explicit selection, while most secondary providers remain stubs and practical live source coverage remains limited. Pricing remains separate from canonical `Card`.
- **Artwork:** A provider-list resolver normalizes candidates and provenance, isolates provider failures, and selects deterministically. Exact-printing status requires evidence; candidates without exact status are not selected. Eligible usage is selectable; unresolved usage is selectable only with explicit provider compatibility; ineligible usage is always rejected. TCGdex alone is configured for unresolved-usage compatibility to preserve existing display, without a rights determination; secondary integration and artwork-specific caching are absent.
- **Shared-reference backend/cache:** Optional future architecture extension, not implemented or required for V1.
- **Synchronization:** Contracts, outbox, push/provider scaffolding, and migration components exist. Pulled changes, cursor persistence, conflict wiring, account lifecycle, and truthful user-facing sync state are incomplete.
- **Backup/restore:** Manual collection export/import validates version 1.0.0 payloads and writes Binder, Wishlist, and Cart in one atomic local transaction. Backup migration support remains incomplete; automatic/remote backup is optional future work and is separate from reference caches and collection sync.
- **Mobile UI:** The application is responsive/mobile-capable, but some components become squeezed or compressed at narrow widths. This is targeted UI hardening, not a reason for visual redesign.
- **Capacitor:** Android platform project and camera acquisition foundation exist (Capacitor/Android 8.5.2, Camera 8.2.4, App 8.1.1). `appRestoredResult` recovers camera/gallery results after process recreation into transient memory. No APK build/device validation or iOS project exists. The Android photo-picker/camera flows add no camera or broad storage permission; photos are not saved by the plugin.

### PARTIAL — ACTIVE PRODUCT TRACK

- Scanner/recognition is an active product requirement and implementation track. Browser file input (`accept="image/*"`, `capture="environment"`) remains available; on mobile web, `capture` is a picker hint. Android Capacitor adds camera capture and gallery selection through a source-neutral Blob acquisition result and temporary preview. Camera results delivered after Android process recreation are routed through that same acquisition boundary; previous source images are not persisted/restored. Both paths feed the same local descriptor/reference matcher; raw photos are not uploaded or stored in IndexedDB. `App` routes only an explicitly confirmed local-reference TCGdex catalog ID through the existing Binder action; no candidate is added automatically. Wishlist/Cart scanner actions, a live identity resolver, and general recognition of unseen cards remain unavailable.
- The isolated development benchmark currently evaluates Tesseract English OCR plus TCGdex text matching; it is not a provider comparison or production recognizer. Its local-photo manifests support capture-condition/card-characteristic labels, pixel dimensions, and per-image crop metadata. No representative real card photographs/results are present in the repository; private photos must be supplied locally and excluded from Git. See [SCANNER_BENCHMARK.md](./SCANNER_BENCHMARK.md) for the provider-neutral evaluation contract and evidence gate. No production OCR/ML or network recognition provider has been selected.

The production screen configures a local perceptual-hash matcher against user-confirmed references already stored on the device. It can return advisory candidates for those references; it does not identify unseen cards. No OCR/ML or network recognition engine is selected, and no live catalog resolver is configured. The provider-neutral service boundary normalizes untrusted results; its explicit offline fallback performs no network access and returns unavailable rather than fabricating recognition. Candidate Review displays clues and emits a candidate only after explicit user confirmation. A separate catalog-identity service accepts that confirmed type and normalizes exact existing catalog matches without choosing among ambiguous records or mutating collections/persistence. The current App action routes only an explicitly confirmed local-reference TCGdex ID to the Binder; unsupported and ID-less candidates do not mutate it. Browser file acquisition and Android Capacitor camera/gallery acquisition feed the same temporary Blob path. Manual catalog search remains available.

**Implemented service-level fallback:** a provider-chain boundary that can try configured recognition providers and then the `offline` provider. This boundary is not the production ScannerScreen recognition path; ScannerScreen uses the local-reference matcher described above. The offline provider requires no API credentials, makes no HTTP/API request, uploads or persists no image, and returns a normalized `unavailable` result with a clear reason because no local engine is configured. Cancellation is handled at the orchestration boundary, including when an in-flight provider does not settle after cancellation.

**Deferred:** an OCR/ML engine for recognizing unseen cards, production network-provider selection, production catalog-resolver selection/integration, native iOS project/device validation, and scanner Wishlist/Cart actions. Android camera/gallery acquisition is implemented through Capacitor but is not yet device-validated or release-packaged. Binder insertion is limited to an explicitly confirmed local-reference TCGdex ID; the local matcher is not a general card-recognition or catalog-identity provider. The offline fallback is not a recognition engine.

### ARTWORK — ACTIVE FOUNDATION

- Artwork uses TCGdex-provided URLs today. The resolver now supports a provider pool, candidate provenance, failure isolation, and deterministic selection; production configuration contains only TCGdex. Its artwork usage status remains unresolved without a rights conclusion; explicit provider compatibility preserves existing display. Candidates without evidenced exact-printing verification and candidates explicitly marked ineligible are not selected. Other providers require eligible usage unless explicitly configured for unresolved-usage compatibility; the procedural SVG remains a UI-only placeholder.
- No secondary artwork provider is approved or integrated. A bounded live TCGdex audit of 38 card IDs found missing `image` fields for all 30 sampled `30th-c` cards (`30th-c-001` through `30th-c-030`); eight control URLs returned HTTP 200. Re-run `node scripts/audit-tcgdex-artwork.mjs` to refresh the sample results.
- The source investigation in [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md) found no confirmed or eligible secondary candidate for these records. The audit checks only a curated sample and known placeholder URL patterns; neither it nor public image access establishes full-catalog coverage or image-use rights.

### MULTI-SOURCE EXTERNAL DATA — ARCHITECTURE DIRECTION

- The principle is **multiple external sources, one canonical local truth**. Binder/Wishlist/Cart remain locally owned; TCGdex is the current configured catalog provider, not the permanent identity authority. External artwork and pricing must not silently replace source-neutral canonical identity.
- Additional artwork providers remain future work. The selection foundation enforces exact-printing evidence and rejects explicit usage ineligibility before comparing observable quality/stability. Unresolved usage is not selectable by default; TCGdex alone has explicit compatibility. No secondary provider is approved or integrated.
- Pricing providers supply attributable observations for an application-derived Binder estimate. Approximately three or four reliable sources may be compared when available, but source participation varies per card and no fixed minimum is required. One observation is a single-source indication, not a robust average.
- Preserve raw pricing observations and determine comparability before transparent outlier treatment. The future statistical method is undecided; current implemented median/outlier behavior is unchanged.
- Provider outages, rate limits, API/terms changes, credentials, and per-card coverage are external-data conditions; they must not invalidate local collection data. Generalized dynamic source orchestration/failover is not implemented.

### DEFERRED

- Paid/authenticated pricing providers: deferred because of credentials, terms, cost, or client-side security constraints.
- Native release packaging: Android project and Camera plugin are scaffolded, but APK build/signing and device validation remain deferred. No iOS project exists.

### UNFINISHED V1 / MISSING

- Modular source/provider registry spanning catalog, pricing, artwork, and identification.
- Distinct provider fallback and enrichment semantics.
- Multiple live catalog providers and catalog resolver.
- BYO-credential configuration for legitimately user-owned private providers.
- OCR/ML preprocessing and recognition for unseen cards, production catalog-resolver selection, and scanner Wishlist/Cart actions. The local-reference matcher provides advisory matches against saved references; only an explicitly confirmed local-reference TCGdex ID reaches the existing Binder action. Provider-neutral recognition and catalog-identity boundaries plus Candidate Review remain in place.
- Broader live pricing-source coverage where a suitable free source is identified. The TCGdex price-guide mapping and comparable-observation handling are implemented; secondary provider integration remains gated on a separate source/terms decision.
- Versioned backup migration support and further data-portability hardening.
- Narrow-width audit and targeted responsive fixes without redesign.
- Robust provider capability/health reporting.

### OPTIONAL / FUTURE

- Multi-device collection synchronization remains optional/future scope pending a separate product decision. It is distinct from optional future reference caching and backup; local-first collection functionality does not depend on synchronization.
- Optional PMB API/shared reference cache for normalized provider responses, provenance/freshness, request deduplication, rate limiting, and shared cache serving.
- Optional versioned/automatic/remote backup for user-owned data; backend/login requirements are not part of V1.
- Additional TCG categories.
- Additional artwork sources and prefetching.
- User-facing pricing refresh/source controls.
- Server-side proxy for providers that legally require protected credentials.
- Native platform integrations after the web baseline is stable.

### NOT A V1 PRODUCT REQUIREMENT

- Embedded ChatGPT UI, OpenAI integration, AI credential management, AI-powered card identification, and AI-dependent Binder functionality are not V1 product requirements. References to ChatGPT, Cline, Copilot, or other AI systems describe the development workflow only.

### UNKNOWN

- Whether Capacitor setup was intentionally staged or simply incomplete.
- Whether broader provider enrichment was committed scope or architectural aspiration.

No major capability has clear evidence of being intentionally removed.

## Provider/source architecture requirement

The application is designed around a modular source/provider ecosystem rather than a single data vendor:

```text
Source Registry
    ├── Catalog: free/default, secondary, optional user-configured
    ├── Pricing: free/default, secondary, optional user-configured
    ├── Artwork: free/default, secondary
    └── Identification: local/free, optional additional providers
```

The source system must distinguish:

- **Fallback:** Provider A cannot satisfy a request, so Provider B is attempted.
- **Enrichment:** Provider A supplies some information and Provider B supplies missing or additional information.

Free providers remain the default. Users may optionally configure services they legitimately have access to, but the application must not bundle shared paid keys, redistribute credentials, proxy paid access, bypass quotas, or make paid access mandatory. Credentials must remain separate from cards, collections, catalog, pricing, artwork, and ordinary collection exports.

## Pricing baseline

```text
Pricing architecture: PARTIAL / substantially present
Live provider coverage: PARTIAL
TCGdex price-guide mapping: IMPLEMENTED / FIXTURE-VERIFIED
```

Pricing observations remain source-, marketplace-, currency-, variant-, and timestamp-aware. Pricing must not be added to canonical `Card` identity.

## Scanner baseline

```text
Image acquisition
    ↓
Production ScannerScreen: local perceptual matching against saved,
user-confirmed references
    ↓
Advisory candidates → Candidate Review → explicit confirmation
    ↓
Existing Binder action only for supported, confirmed local-reference IDs

Separate service boundary: provider-chain/offline-unavailable fallback;
not the production ScannerScreen recognition path.
Manual catalog search remains available
```

General recognition for unseen cards and a catalog identity provider are not selected or registered. Candidate Review emits only an explicitly confirmed candidate; App routes only a confirmed local-reference TCGdex ID to the existing Binder action. The identity boundary can normalize injected catalog results but has no live provider configured.

Scanner providers produce candidates; they do not directly mutate the binder. Identity verification is metadata verification for known cards, not image recognition.

## Decision preservation

Future coding agents must preserve:

1. IndexedDB as the collection source of truth.
2. External providers as supplemental sources.
3. No duplicated catalog/artwork/pricing payloads in binder entries.
4. Free providers as the default.
5. Paid/private providers as optional BYO-credential sources.
6. No shared paid credentials.
7. Fallback and enrichment as distinct behaviors.
8. Pricing separate from canonical `Card`.
9. Scanner providers produce candidates only.
10. User confirmation before binder mutation.
11. Identity verification is not image recognition.
12. Scanner failure must not break manual binder workflows.
13. PWA/local-first operation without paid infrastructure.
14. Native packaging separate from browser/PWA functionality.
15. Responsive hardening must not become an unsolicited visual redesign.

## Next implementation order

1. Preserve the V1 local-first boundary and keep Binder/Wishlist/Cart authoritative on-device; treat shared backend/cache and remote backup as optional future work.
2. Reconcile provider/source architecture before adding providers or selecting backend/database vendors.
3. Preserve the fixture-tested TCGdex price-guide mapping; revisit it only for a concrete upstream schema change. Broader source coverage remains limited and requires a separate provider decision.
4. Select and integrate a local recognition provider only after representative OCR/preprocessing evidence supports that choice.
5. Select a production catalog identity provider only after recognition can produce useful evidence; keep the implemented identity boundary separate from Candidate Review and collection actions.
6. Consider shared reference caching or remote backup only as separately scoped future work; do not conflate either with multi-device collection synchronization.
7. Complete multi-device synchronization only if its separate product scope is explicitly confirmed.
8. Harden narrow mobile layouts with targeted corrections.
9. Create native projects only after the PWA baseline is stable.
