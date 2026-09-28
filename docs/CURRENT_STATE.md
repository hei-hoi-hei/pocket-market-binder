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

V1 represents the complete original Pocket Market Binder product vision. A committed V1 requirement that is not implemented is unfinished V1 work, not automatically future scope. Future agents must not downgrade missing requirements to V2 merely because they are absent from the current code. Use `DEFERRED`, `OPTIONAL / FUTURE`, or `INTENTIONALLY REMOVED` only when an explicit product decision supports that classification.

## Current baseline

### IMPLEMENTED

- React 18 + TypeScript + Vite mobile-first PWA shell.
- Responsive navigation, binder, search, card detail, wishlist, and cart flows.
- Manual catalog search and manual binder addition.
- IndexedDB persistence with isolated user/catalog/pricing key spaces.
- Legacy `localStorage` migration.
- Binder quantities, wishlist, cart, and seller-price entry.
- TCGdex-backed Pokémon catalog search/detail mapping and catalog caching.
- High/low catalog artwork URL selection and UI/procedural fallback behavior where applicable.
- Collection JSON export, merge import, and overwrite import.
- Pricing observation types, provider interface, caching, aggregation, normalization, median/outlier logic, and confidence statuses.
- Basic sync contracts, outbox storage, migration scaffolding, Supabase adapter, and conflict-resolution components.
- PWA manifest, service-worker registration, Workbox configuration, and offline shell support.

### PARTIAL

- **Catalog:** Provider abstraction and category registry exist, but only one live Pokémon provider is registered. There is no source resolver, provider priority, fallback, or enrichment pipeline.
- **Canonical identity:** Identity types and verification service exist, but no identity provider is registered and no user-facing verification flow exists. Identity verification is not image recognition.
- **Pricing:** Architecture is substantially present, but most secondary providers are stubs and current TCGdex pricing extraction appears schema-stale/incomplete. Pricing remains separate from canonical `Card`.
- **Artwork:** A provider-list resolver normalizes candidates and provenance, isolates provider failures, and selects deterministically. Exact-printing status requires evidence; candidates without exact status are not selected. Eligible usage is selectable; unresolved usage is selectable only with explicit provider compatibility; ineligible usage is always rejected. TCGdex alone is configured for unresolved-usage compatibility to preserve existing display, without a rights determination; secondary integration and artwork-specific caching are absent.
- **Synchronization:** Contracts, outbox, push/provider scaffolding, and migration components exist. Pulled changes, cursor persistence, conflict wiring, account lifecycle, and truthful user-facing sync state are incomplete.
- **Import/export:** Collection backup flows exist, but deep record validation, atomicity, migration robustness, and sync integration are incomplete.
- **Mobile UI:** The application is responsive/mobile-capable, but some components become squeezed or compressed at narrow widths. This is targeted UI hardening, not a reason for visual redesign.
- **Capacitor:** Configuration and dependencies exist, but no native project, plugin, permission, or APK build exists.

### PARTIAL — ACTIVE PRODUCT TRACK

- Scanner/recognition is an active product requirement and implementation track. Image acquisition includes browser file input, MIME validation, temporary preview, replace/remove, and object-URL cleanup. A provider-agnostic recognition service validates image input and normalizes provider output into unresolved clues, confidence, evidence, and metadata; it does not resolve catalog identity or mutate collections. An explicit `offline` provider is the final fallback; it requires no credentials or network and returns `unavailable` because no local recognition engine is configured.
- An isolated OCR benchmark and controlled catalog-matching benchmark exist as development tooling only.

No production recognition engine is selected or registered, so identification and live candidate generation remain unavailable. Configured providers that are unavailable or fail are followed by the explicit offline provider; that provider performs no network access and fabricates no recognition result. Candidate Review accepts normalized results, displays candidate clues, and emits only an explicitly confirmed `ScannerCandidate`. A provider-agnostic catalog-identity service now accepts that confirmed type, normalizes existing catalog-provider results, and returns resolved, ambiguous, no-match, unavailable, error, or cancelled outcomes without choosing among ambiguous records or mutating collections/persistence. It can be adapted to the existing `ICatalogProvider` search interface; no live resolver is configured. The browser image picker is not native/direct camera integration. Manual catalog search remains available.

**Implemented fallback:** a provider-chain boundary that tries configured recognition providers and then the `offline` provider. The offline provider requires no API credentials, makes no HTTP/API request, uploads or persists no image, and returns a normalized `unavailable` result with a clear reason because no local engine is configured. Cancellation is handled at the orchestration boundary, including when an in-flight provider does not settle after cancellation.

**Deferred:** an actual offline OCR/ML engine, production network-provider selection and live candidate generation, production catalog-resolver selection/integration, native camera, and automatic Binder/Wishlist/Cart actions. Candidate Review and the catalog-identity boundary are implemented, but no production recognition or identity provider is selected. The offline fallback is not a recognition engine.

### ARTWORK — ACTIVE FOUNDATION

- Artwork uses TCGdex-provided URLs today. The resolver now supports a provider pool, candidate provenance, failure isolation, and deterministic selection; production configuration contains only TCGdex. Its artwork usage status remains unresolved without a rights conclusion; explicit provider compatibility preserves existing display. Candidates without evidenced exact-printing verification and candidates explicitly marked ineligible are not selected. Other providers require eligible usage unless explicitly configured for unresolved-usage compatibility; the procedural SVG remains a UI-only placeholder.
- No secondary artwork provider is approved or integrated. A bounded live TCGdex audit of 38 card IDs found missing `image` fields for all 30 sampled `30th-c` cards (`30th-c-001` through `30th-c-030`); eight control URLs returned HTTP 200. Re-run `node scripts/audit-tcgdex-artwork.mjs` to refresh the sample results.
- The source investigation in [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md) found no confirmed or eligible secondary candidate for these records. The audit checks only a curated sample and known placeholder URL patterns; neither it nor public image access establishes full-catalog coverage or image-use rights.

### MULTI-SOURCE EXTERNAL DATA — ARCHITECTURE DIRECTION

- The principle is **multiple external sources, one canonical local truth**. Binder/Wishlist/Cart remain locally owned; TCGdex remains the current catalog/identity authority. External artwork and pricing must not silently replace canonical identity.
- Additional artwork providers remain future work. The selection foundation enforces exact-printing evidence and rejects explicit usage ineligibility before comparing observable quality/stability. Unresolved usage is not selectable by default; TCGdex alone has explicit compatibility. No secondary provider is approved or integrated.
- Pricing providers supply attributable observations for an application-derived Binder estimate. Approximately three or four reliable sources may be compared when available, but source participation varies per card and no fixed minimum is required. One observation is a single-source indication, not a robust average.
- Preserve raw pricing observations and determine comparability before transparent outlier treatment. The future statistical method is undecided; current implemented median/outlier behavior is unchanged.
- Provider outages, rate limits, API/terms changes, credentials, and per-card coverage are external-data conditions; they must not invalidate local collection data. Generalized dynamic source orchestration/failover is not implemented.

### DEFERRED

- Paid/authenticated pricing providers: deferred because of credentials, terms, cost, or client-side security constraints.
- Native Android/iOS packaging: deferred until PWA behavior and product scope are stable; Capacitor configuration alone is not native support.

### UNFINISHED V1 / MISSING

- Modular source/provider registry spanning catalog, pricing, artwork, and identification.
- Distinct provider fallback and enrichment semantics.
- Multiple live catalog providers and catalog resolver.
- BYO-credential configuration for legitimately user-owned private providers.
- Production scanner preprocessing and OCR/recognition provider, catalog matching, live candidate generation, production catalog-resolver selection, and Binder/Wishlist/Cart actions. Provider-neutral recognition and catalog-identity boundaries plus Candidate Review are implemented; none provides live recognition or mutates collections.
- TCGdex pricing schema reconciliation, usable free-provider coverage where available, secondary-provider behavior, observation normalization, source/market attribution, timestamps, currency handling, refresh/source controls, and graceful provider failure.
- Stronger import/export validation, atomic restore, migration hardening, and portability improvements.
- Narrow-width audit and targeted responsive fixes without redesign.
- Robust provider capability/health reporting.

### OPTIONAL / FUTURE

- Synchronization remains optional/future scope pending an explicit product decision. Existing infrastructure is partial; local-first collection functionality does not depend on sync.
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
TCGdex adapter: REQUIRES SCHEMA RECONCILIATION
```

Pricing observations remain source-, marketplace-, currency-, variant-, and timestamp-aware. Pricing must not be added to canonical `Card` identity.

## Scanner baseline

```text
Image acquisition
    ↓
Provider-neutral scanner service and result normalization
    ↓
Configured recognition provider(s): none
    ↓
Explicit offline/no-network provider: implemented; no local engine configured
    ↓
Truthful unavailable result
    ↓
Manual catalog search remains available
```

Production recognition engine, live candidate generation, and catalog identity provider: not selected or registered. Candidate Review emits only an explicitly confirmed recognition candidate; the identity boundary can normalize injected catalog results but has no live provider configured. Binder insertion remains unimplemented.

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

1. Accept this documentation baseline and resolve the synchronization release-scope decision.
2. Reconcile provider/source architecture before adding providers.
3. Repair and test the TCGdex pricing adapter without changing `Card`.
4. Review and commit the verified recognition boundary before starting another scanner slice.
5. Select and integrate a local recognition provider only after OCR/preprocessing evidence supports that choice.
6. Select a production catalog identity provider only after recognition can produce useful evidence; keep the implemented identity boundary separate from Candidate Review and collection actions.
7. Complete synchronization only if product scope is explicitly confirmed.
8. Harden narrow mobile layouts with targeted corrections.
9. Create native projects only after the PWA baseline is stable.
