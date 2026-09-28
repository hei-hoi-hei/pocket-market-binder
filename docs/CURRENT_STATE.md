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
- **Artwork:** URL support and quality fallback exist, but artwork is still coupled to catalog-provided TCGdex URLs. True multi-provider artwork resolution and artwork-specific caching are absent.
- **Synchronization:** Contracts, outbox, push/provider scaffolding, and migration components exist. Pulled changes, cursor persistence, conflict wiring, account lifecycle, and truthful user-facing sync state are incomplete.
- **Import/export:** Collection backup flows exist, but deep record validation, atomicity, migration robustness, and sync integration are incomplete.
- **Mobile UI:** The application is responsive/mobile-capable, but some components become squeezed or compressed at narrow widths. This is targeted UI hardening, not a reason for visual redesign.
- **Capacitor:** Configuration and dependencies exist, but no native project, plugin, permission, or APK build exists.

### PARTIAL — ACTIVE PRODUCT TRACK

- Scanner/recognition is an active product requirement and implementation track. Image acquisition includes browser file input, MIME validation, temporary preview, replace/remove, and object-URL cleanup. A provider-agnostic recognition service now validates image input and normalizes provider output into unresolved clues, confidence, evidence, and metadata; it does not resolve catalog identity or mutate collections.
- An isolated OCR benchmark and controlled catalog-matching benchmark exist as development tooling only.

No production recognition provider is selected or registered, so identification and live candidate generation remain unavailable. Review/confirmation, catalog identity resolution, and Binder/Wishlist/Cart actions remain unfinished. The browser image picker is not native/direct camera integration.

### DEFERRED

- Paid/authenticated pricing providers: deferred because of credentials, terms, cost, or client-side security constraints.
- Native Android/iOS packaging: deferred until PWA behavior and product scope are stable; Capacitor configuration alone is not native support.

### UNFINISHED V1 / MISSING

- Modular source/provider registry spanning catalog, pricing, artwork, and identification.
- Distinct provider fallback and enrichment semantics.
- Multiple live catalog providers and catalog resolver.
- BYO-credential configuration for legitimately user-owned private providers.
- Production scanner preprocessing and OCR/recognition provider, catalog matching, live candidate generation, user review/confirmation, catalog identity resolution, and Binder/Wishlist/Cart actions. The provider-neutral recognition boundary and response normalization are implemented but do not themselves identify cards.
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
Production recognition provider: not selected or registered
    ↓
Candidate generation: not implemented
    ↓
User confirmation: not implemented
    ↓
Binder insertion: not implemented
```

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
6. Implement catalog matching, candidate review, and confirmation only after the provider can produce useful evidence.
7. Complete synchronization only if product scope is explicitly confirmed.
8. Harden narrow mobile layouts with targeted corrections.
9. Create native projects only after the PWA baseline is stable.
