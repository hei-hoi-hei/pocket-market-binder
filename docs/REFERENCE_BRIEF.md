# Pocket Market Binder — Reference Brief

## 1. Purpose

This document is the consolidated product/design/reference brief for **Pocket Market Binder**. It records product direction and scope; it is not proof that a feature exists.

External references are **contextual references, not hidden requirements**.

They help inform decisions around:

* collection management;
* catalog browsing;
* provider architecture;
* local-first behavior;
* search and discovery;
* scanning and identification;
* pricing;
* extensibility;
* UI/UX;
* offline behavior.

Use this brief for product direction and explicit scope. Determine implementation status from the current repository, automated verification, and directly verifiable runtime behavior. The overall evidence order is:

1. current repository implementation;
2. current automated verification;
3. directly verified runtime/UI behavior;
4. current project-state and architecture documentation;
5. this Reference Brief;
6. Git history;
7. external references.

Higher-level evidence overrides lower-level evidence when they conflict. Documentation, UI controls, interfaces, dependencies, and historical commits alone do not prove a capability is implemented. When evidence is insufficient, use **Unverified**. External references are contextual only and do not automatically create Pocket Market Binder requirements.

## Product direction, current scope, and implementation status

- **Product direction:** A local-first, simple collection and reference app, initially focused on Pokémon TCG, designed not to prevent future collectible categories.
- **Current product scope:** V1 is Card Reference + Market Value + Acquisition Calculator: Binder, quantities, wishlist, the local virtual acquisition-cost cart, catalog/artwork references, price/source information, manual search, and responsive PWA. Scanner/camera-based identification remains an active implementation track. V1 does not require a backend, login, paid APIs, or marketplace scraping; shared reference caching and remote backup are optional future extensions. Marketplace listings/sellers/purchase links are V2.
- **Implementation status:** Determined from code and tests, not from this document. Current verified state is summarized in section 15.
- **Future/deferred:** Additional collectible categories and themes are future extensibility. Sync is optional/future scope pending an explicit product decision. Native Android packaging is downstream of the web/PWA experience. Production scanner recognition is unfinished, not removed from scope.

## Multiple external sources, one canonical local truth

This is an architectural direction, not a claim that generalized source orchestration is implemented. External providers are replaceable sources: availability, coverage, terms, quality, and authentication can change. A provider failure is an external-data problem, not a collection-data problem.

- **Collection:** Binder, Wishlist, and Cart remain locally owned source of truth.
- **Canonical identity:** TCGdex is the current configured catalog provider, not the permanent identity authority. Source-neutral identity preserves available printing fields and namespaced provider IDs; artwork and pricing sources must not silently replace it.
- **Artwork:** provider-pool normalization, failure isolation, explicit printing/usage status, provenance, and deterministic candidate selection are implemented. TCGdex is the only configured production provider. Candidates without evidenced exact-printing verification and candidates explicitly marked ineligible are not selected. Eligible usage is selectable; unresolved usage is selectable only for a provider with an explicit compatibility setting. TCGdex has that explicit setting to preserve current display while its usage eligibility remains **unresolved**; this is not a permission determination. No secondary provider is approved or integrated.
- **Pricing (future direction):** providers supply attributable observations for an application-derived estimate. Compare approximately three or four reliable sources when available, without requiring a fixed count or minimum. Preserve raw observations and determine comparability before transparent outlier treatment; one observation is a single-source indication, not a robust average. The future statistical method is undecided.

The current secondary-artwork evidence is bounded to `30th-c-001` through `30th-c-030` and recorded in [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md).

---

# 2. Product Definition

Pocket Market Binder is a **local-first personal collection and reference application**.

The initial use case is a Pokémon TCG collector who wants a simpler and more understandable way to manage a collection.

The application is intended to support:

* personal collection management;
* quantity tracking;
* wishlist management;
* purchase/cart tracking;
* catalog browsing and search;
* card details and artwork;
* price information and source attribution;
* manual card identification;
* image/camera-assisted identification;
* local persistence;
* offline-capable use;
* responsive desktop, tablet, and mobile experiences;
* curated visual themes;
* future expansion to additional collectible categories.

Pokémon TCG is the initial focus, but it should **not become an unnecessary architectural limitation**.

---

# 3. Scope Boundary

## 3.1 Current Scope

The current product scope includes:

* collection management;
* card quantities;
* wishlist;
* purchase/cart tracking;
* catalog search and browsing;
* card details;
* artwork;
* catalog/provider integration;
* price information and source attribution;
* local-first persistence;
* offline-capable behavior;
* responsive web UI;
* curated themes;
* manual identification;
* **scanner/camera-based identification as an active development feature**;
* architecture capable of supporting future collectible categories;
* Android packaging as a downstream direction; Capacitor configuration alone is not an Android application.

---

## 3.2 Scanner Scope and Status

The scanner is **in scope but is not yet considered a completed feature**.

The intended workflow is:

```text
Camera / Image
      ↓
Capture
      ↓
Image Validation / Preparation
      ↓
Identification
      ↓
Candidate Results
      ↓
User Review
      ↓
Confirmed Catalog Identity
      ↓
Binder / Wishlist / Cart
```

Current implementation status:

- **Capture:** Browser file input remains available; Android uses Capacitor Camera for photo capture and gallery selection through the common Blob boundary. Capacitor App handles restored camera results after Android process recreation; only the result is kept transiently, not the prior source image. Mobile browser `capture="environment"` remains a picker hint. Android project is scaffolded, but no APK/device validation or iOS project exists.
- **Image:** Partially implemented: image validation, temporary preview, replace/remove, and object-URL cleanup.
- **Recognition boundary:** Implemented as a provider-neutral local-image service with runtime response normalization. Its explicit `offline` provider is a service-level fallback; it requires no credentials, makes no network request, and returns `unavailable` when no offline recognition engine is configured. This fallback is not the current production ScannerScreen path, which uses local perceptual matching against saved, user-confirmed references.
- **Identification:** Local perceptual-hash matching against previously user-confirmed references is implemented. General recognition of unseen cards is missing from production; the installed OCR dependency is used only by the isolated development benchmark.
- **Candidate generation:** The local-reference provider can return advisory candidates from stored references. No production OCR/ML or network provider generates candidates for unseen cards.
- **Candidate Review:** Implemented as a provider-agnostic component; it displays normalized clues and emits only a candidate after explicit user confirmation. Local-reference matches are available when a stored reference matches; no general live recognition results are available.
- **Scanner-to-catalog identity boundary:** Implemented as an injectable service. It accepts only a review-confirmed candidate, preserves the original clues, normalizes exact existing catalog matches, and reports ambiguous, no-match, unavailable, malformed/error, or cancelled outcomes. No live resolver is configured.
- **Scanner-to-Binder action:** **Partially Implemented** | App sends only an explicitly confirmed local-reference TCGdex ID to the existing Binder action; no mutation occurs during recognition, selection, or review. Scanner Wishlist/Cart actions remain missing.

Thus the scanner is an active product requirement whose image-acquisition foundation, explicit no-network unavailable fallback, local matching against user-confirmed references, provider-agnostic Candidate Review, and catalog-identity boundary are implemented. General recognition of unseen cards and live catalog resolution remain unfinished. Explicitly confirmed local-reference TCGdex candidates can use the existing Binder action; unconfirmed, unsupported, and ID-less candidates cannot mutate collections. The offline provider is not a recognition engine and does not fabricate candidates or catalog identity. The catalog-identity resolver remains unconfigured and does not mutate collection state. Manual catalog search remains available.

The scanner should be developed as a complete workflow rather than as an isolated camera feature.

Its implementation stages are:

1. image acquisition;
2. identification;
3. candidate presentation;
4. user confirmation;
5. collection integration;
6. failure handling and fallback.

A camera component, image picker, mock result, or recognition provider interface by itself does not constitute a completed scanner.

The initial goal is **reliable identification with user confirmation**, not perfect AI recognition.

The production recognition approach remains to be selected from evidence. Advanced recognition methods and additional providers can be introduced incrementally without changing the overall workflow.

### Scanner failure and fallback

Failure is an expected scanner state.

Possible failures include:

* camera unavailable;
* permission denied;
* capture cancelled;
* invalid/unsupported image;
* poor image quality;
* recognition timeout;
* recognition provider unavailable;
* no candidate found;
* ambiguous candidates;
* catalog lookup failure;
* offline provider availability.

The user should receive a clear response and a useful recovery path.

General behavior:

```text
Scanner Failure
      ↓
Explain / Indicate Problem
      ↓
 ┌───────────────┐
 │ Retry / Retake│
 └───────┬───────┘
         │
         └───────────────┐
                         ▼
                  Manual Search
                         ↓
                   Catalog Result
                         ↓
                    User Selection
                         ↓
                 Collection Action
```

Where appropriate, the user should be able to:

* retry;
* retake or replace the image;
* select another candidate;
* cancel;
* search manually;
* continue using the rest of the application.

**A failed scan must never trap the user or prevent normal collection management.**

When recognition is uncertain, the application should prefer candidate review or manual search rather than automatically making a consequential collection change.

---

## 3.3 Outside the Current Core

Unless explicitly added to the roadmap, the following are not core requirements:

* marketplace functionality;
* direct buying or selling;
* payment processing;
* becoming a pricing authority;
* guaranteed real-time market prices;
* replacing established catalog providers;
* replacing dedicated collection platforms;
* social networking;
* public user profiles;
* user-to-user trading;
* auctions;
* commercial seller/shop inventory management;
* unrestricted custom color editing;
* mandatory cloud accounts;
* mandatory cloud synchronization;
* mandatory paid APIs;
* AI chat as a normal collection-management requirement;
* native Android functionality as a prerequisite for the web/PWA product;
* recognition that bypasses appropriate user confirmation;
* Pokémon-only architectural assumptions that prevent future categories.

---

## 3.4 Future / Optional

Potential future areas include:

* Google synchronization;
* Supabase synchronization;
* additional catalog providers;
* additional price providers;
* additional recognition providers;
* additional curated themes;
* additional collectible categories;
* native Android packaging;
* advanced OCR/image recognition;
* optional AI-assisted features;
* richer collection analytics and statistics.

These require explicit roadmap decisions.

A feature appearing in Mihon, Collectr, a scanner application, or another reference does **not** automatically enter the Binder scope.

---

# 4. Core Design Principles

## 4.1 Local-first

The user's collection is local application data.

External services may provide:

* catalog information;
* prices;
* recognition;
* artwork;
* metadata.

The application should remain useful when external services are unavailable.

The V1 data model distinguishes three separate concerns:

1. **User-owned durable state:** Binder, Wishlist, Cart, quantities, notes, metadata, and preferences remain owned by the device in IndexedDB and available offline.
2. **Shared reference data:** external providers supply reusable catalog, pricing, artwork, and other reference data through a PMB backend/API and shared cache. The backend normalizes and caches eligible data, preserves provenance/freshness, and provides a stable client API; it is not the Binder authority.
3. **Backup/restore:** a separate V1 pipeline preserves user-owned data and schema/version for recovery. Manual export/import exists; robust versioned restore and automatic/remote backup where feasible remain to be completed. A backup need not contain every cached image or disposable provider response.

```text
External Providers → PMB Backend/API → Shared Reference Cache → User Device
                                                           ↓
                                                   Local IndexedDB → UI

User-owned IndexedDB data → versioned backup/export or remote backup
```

Cold requests may go through PMB to an upstream provider; warm server-cache and warm device-cache paths should avoid unnecessary upstream waits. Already-cached collection/reference data should remain usable during internet, backend, or provider outages. Backend/shared cache is not user backup; IndexedDB collection state is not disposable cache; external providers are not the application's source of truth.

Shared artwork may only be cached or served when source terms and technical conditions permit. Provider hosting alone is not redistribution permission; preserve exact-printing evidence, provenance, and explicit eligible/unresolved/ineligible usage status.

---

## 4.2 Provider-neutral

External providers should be replaceable where practical.

For shared reference data in the approved V1 architecture, prefer:

```text
Application / User Device
     ↓
PMB Backend / API
     ↓
Provider Interface
     ↓
External Provider(s)
```

The PMB backend/API is the stable application-facing reference-data boundary; it can use replaceable provider interfaces upstream. Provider-neutral means the application is not coupled to one specific external provider, not that the client calls providers directly. IndexedDB remains the local source of truth for the user's Binder, Wishlist, Cart, and other user-owned collection state; the backend/shared cache does not own that state.

Providers supply information.

Binder owns the user's collection state and application-level relationships.

---

## 4.3 Free / ₱0-oriented

The initial product should avoid requiring paid infrastructure.

Prefer:

* free public APIs;
* local processing;
* browser/device capabilities;
* optional integrations;
* replaceable provider adapters.

A paid dependency should be an explicit product decision rather than an accidental requirement.

---

## 4.4 Simple UI

Prioritize:

* clear navigation;
* understandable terminology;
* useful defaults;
* minimal configuration;
* responsive layouts;
* mobile/tablet/desktop usability;
* fast common actions.

Do not reproduce complexity simply because another application contains it.

---

## 4.5 Understandable automation

Automation should supplement manual workflows.

For example:

**Scan → Candidate → Confirmation → Card**

should complement:

**Search → Card**

rather than making manual workflows obsolete.

---

## 4.6 Recognition is not authority

Recognition results should be treated as candidates until appropriately confirmed.

The application should not silently turn uncertain recognition into a collection action.

---

# 5. Theme System

Pocket Market Binder's product direction is a **curated theme system**. This statement describes design direction, not a claim that theme selection is implemented.

## Starter themes

The primary initial themes are:

* **Water**
* **Fire**
* **Grass**

These form the canonical starter trio.

## Additional themes

The system may later support additional curated themes, such as:

* Electric;
* Psychic;
* Dark;
* Fighting;
* Steel;
* Fairy;
* Dragon;
* Ghost;
* Ice;
* Rock;
* Ground;
* Flying;
* Bug;
* Normal.

These are examples for future expansion, not an immediate implementation requirement.

## Theme structure

Themes should define coherent design tokens such as:

* primary color;
* secondary/accent color;
* surfaces;
* borders;
* text contrast;
* highlights;
* status treatments;
* light/dark variants where appropriate.

Conceptually:

```text
Theme
  ↓
Coherent Palette
  ↓
Design Tokens
  ↓
Application UI
```

The product's canonical starter/default theme direction is **Water, Fire, and Grass**. Additional curated themes may be added later. This design decision does not prove that a selectable theme system exists in the current repository; its implementation is not currently verified. The project should prefer curated themes over unrestricted per-element color editing.

A full custom color editor is not part of the current scope.

---

# 6. Reference: Mihon

Mihon is primarily a reference for **architecture and interaction patterns**, not collectible-card functionality.

Useful areas include:

* source/provider architecture;
* catalog browsing;
* search/filtering;
* local collection organization;
* offline behavior;
* extensibility.

The relevant lesson is how these problems can be approached.

Binder should not copy Mihon's:

* application-specific concepts;
* terminology;
* reader architecture;
* UI wholesale;
* storage model;
* extension system.

---

# 7. Reference: Collectr

Collectr is useful as a reference for:

* collection management;
* card discovery;
* portfolio presentation;
* pricing information;
* card details;
* collection value;
* wishlist behavior.

It is primarily a **UX/reference point**.

Binder should pay particular attention to information density and avoid making common collection actions unnecessarily complicated.

Collectr's branding, business model, proprietary behavior, and exact implementation are not Binder requirements.

---

# 8. Reference: TCGdex

TCGdex is an important catalog/data reference for:

* card identity;
* sets;
* metadata;
* artwork;
* catalog search.

TCGdex should be treated as a catalog source, not as the definition of Binder's internal data model.

Conceptually:

```text
External Catalog
      ↓
Provider Adapter
      ↓
Normalized Application Identity
      ↓
Binder
```

This allows future catalog providers without requiring the application core to be redesigned around one source.

---

# 9. Scanner and Recognition References

External scanner applications are useful for understanding recognition workflows.

The key design principle is:

```text
Image
  ↓
Identification
  ↓
Candidates
  ↓
User Review
  ↓
Confirmed Identity
  ↓
Collection Action
```

Recognition should account for real-world problems such as:

* poor lighting;
* glare;
* sleeves;
* damaged cards;
* rotation;
* partial images;
* similar artwork;
* alternate prints;
* language variants;
* reprints;
* promotional cards.

The scanner should therefore be designed around **candidate resolution**, not blind automatic identification.

---

# 10. Extensibility

The first content category is Pokémon TCG.

The core model should nevertheless favor broader concepts such as:

```text
Collectible
Collection / Set
Catalog Identity
Provider
Price Source
User Collection Entry
```

rather than unnecessarily embedding Pokémon-specific assumptions throughout the application.

The initial UI can remain Pokémon-focused while the underlying architecture remains open to future categories.

Possible future categories do not need to be implemented now.

---

# 11. Provider Architecture

The conceptual architecture is:

```text
                    Pocket Market Binder
                             │
                ┌────────────┴────────────┐
                │                         │
          Application Core           Local Data
                │
        ┌───────┼────────┐
        │       │        │
     Catalog   Price   Recognition
     Provider Provider Provider
```

Providers may supply:

* catalog data;
* pricing;
* recognition results;
* artwork;
* metadata.

Binder owns:

* collection state;
* quantities;
* wishlist state;
* cart state;
* preferences;
* normalized application identity;
* local relationships.

---

# 12. Pricing

Price information is **sourced reference information**, not absolute truth.

Where practical, retain:

* source;
* timestamp;
* price type;
* currency;
* provider/reference.

Multiple sources may be consolidated:

```text
Price Source A ─┐
Price Source B ─┼→ Consolidation Engine → Reference Price
Price Source C ─┘
```

The consolidation engine should remain separate from individual providers.

---

# 13. Local Data

The user's collection should remain usable without constant connectivity.

External information may be:

* cached;
* refreshed;
* unavailable;
* incomplete;
* changed.

Provider availability should not determine whether the user's local collection is accessible.

---

# 14. Android / Capacitor

Capacitor is a future packaging path:

```text
Web Application
      ↓
PWA / Browser
      ↓
Capacitor
      ↓
Android
```

The intended progression is:

1. stabilize the web/PWA experience;
2. verify mobile behavior;
3. package for Android;
4. test the packaged application.

Android packaging should not drive premature changes to the core architecture.

---

# 15. Implementation Status

This section distinguishes **design intent from actual implementation**.

### Status vocabulary

| Status                    | Meaning                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| **Implemented**           | Exists and has been verified.                                            |
| **Partially Implemented** | Some meaningful portion exists but the intended feature is incomplete.   |
| **Planned**               | Explicitly intended but not implemented.                                 |
| **Deferred**              | Intentionally postponed.                                                 |
| **Superseded**            | Replaced by a newer decision.                                            |
| **Missing / Regression**  | Expected functionality is absent despite prior intent or implementation. |
| **Unverified**            | Evidence suggests it exists but current verification is insufficient.    |
| **Reference Only**        | External context, not a Binder requirement.                              |

### Current baseline

| Area | Current implementation status | Notes |
|---|---|---|
| React + TypeScript / Vite / Tailwind | **Implemented** | Current application stack. |
| PWA | **Implemented** | Web application and service-worker configuration exist. |
| IndexedDB/local persistence | **Implemented** | User collection data remains local. |
| Binder, quantities, wishlist, cart | **Implemented** | Core manual collection workflows exist. |
| TCGdex catalog/search | **Implemented** | One Pokémon catalog provider is wired. |
| Provider ecosystem | **Partially Implemented** | Abstractions exist; general source registry, capability/priority selection, fallback, and enrichment are not implemented. |
| Artwork | **Partially Implemented** | Provider-pool candidate normalization, failure isolation, evidenced exact-printing gate, explicit usage state, deterministic quality/stability selection, and provenance are implemented; TCGdex alone is configured in production. TCGdex usage remains unresolved and existing image display is preserved without claiming rights. No secondary source is approved. The bounded investigation found no image field for `30th-c-001` through `30th-c-030`; see [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md). |
| Price consolidation/attribution | **Partially Implemented** | Current observation model and engine exist; live coverage is limited and TCGdex extraction needs verification against the actual response shape. Multi-source participation and revised outlier handling are future direction; the current implemented method is not implicitly replaced. |
| Offline/local-first behavior | **Partially Implemented** | Local collection/cache paths exist; uncached external data needs connectivity and full offline workflows are not established by build success alone. |
| Non-Pokémon extensibility | **Partially Implemented** | Architectural/category foundation only; no other live catalog category. |
| Water/Fire/Grass theme direction | **Direction established; selector unverified** | Canonical starter/default themes; no selectable theme system confirmed in source. |
| Additional curated themes | **Future extensibility** | Not required for initial theme direction. |
| Unrestricted custom color editor | **Outside current scope** | Curated themes are preferred. |
| Browser image acquisition | **Implemented** | File input uses `accept="image/*"` and `capture="environment"`; mobile browser behavior varies. |
| Native camera/photo acquisition | **Partially Implemented** | Capacitor Camera 8.2.4 capture/gallery adapter feeds the common Blob boundary in the generated Android project. It is not recognition, and device/APK validation remains outstanding. |
| Recognition boundary | **Implemented** | Validates non-empty image MIME input and normalizes untrusted provider responses into clues, optional unverified catalog-ID suggestions, confidence, evidence, image regions, and metadata; no identity resolution or collection mutations. |
| Offline recognition fallback | **Implemented** | Explicit `offline` provider requires no credentials/network and returns unavailable without fabricating results when no local engine is configured. |
| Production image identification/OCR | **Missing** | OCR dependency is used by isolated benchmark only; no production recognition engine is selected or registered. |
| Candidate generation | **Missing** | Structured unresolved candidates can be normalized, but no production provider generates live results. |
| Candidate review/confirmation | **Implemented boundary** | Provider-agnostic UI displays normalized candidate clues and marks any catalog-ID suggestion unverified; only explicit confirmation emits the candidate, and catalog identity is not assigned. |
| Scanner-to-catalog identity boundary | **Implemented; no live provider configured** | Requires a confirmed candidate; only normalized existing catalog records can supply an ID; ambiguous/no-match/provider failure remain explicit. |
| Scanner-to-Binder action | **Partially Implemented** | App routes only explicitly confirmed local-reference TCGdex IDs to the existing Binder API. No recognition/selection/review auto-add; scanner Wishlist/Cart actions are missing. |
| Scanner failure/manual fallback | **Partially Implemented** | Provider-unavailable/error results fall through to the offline unavailable result; manual catalog search remains available. |
| Sync | **Partial / optional / future-scope** | Infrastructure is incomplete and optional pending an explicit product decision. |
| Capacitor/Android project | **Partially Implemented** | Capacitor 8.5.2 Android project and Camera plugin are scaffolded; this is not an APK release or device validation. |
| iOS project or APK | **Missing** | No iOS platform project exists. |

### Status maintenance

Implementation status should be updated from repository evidence.

For a feature to be considered complete, the relevant implementation and tests should support it, with end-to-end verification for workflows where applicable.

If documentation and implementation disagree, the discrepancy should be surfaced rather than silently assumed away.

---

# 16. Feature Evaluation

When considering a feature from an external reference, ask:

1. What problem does it solve?
2. Does Binder have the same problem?
3. Does it improve a core workflow?
4. Does it introduce unnecessary complexity?
5. Can it work locally?
6. Does it introduce paid dependency or provider lock-in?
7. Does it require changes to the core data model?
8. Is it already part of the roadmap?

If not, it should not silently become a requirement.

---

# 17. Primary Binder Workflow

The references should ultimately support a simple workflow:

```text
                 ┌───────────────┐
                 │    Catalog    │
                 └───────┬───────┘
                         │
                    Search / Scan
                         │
                         ▼
                 ┌───────────────┐
                 │ Card Identity │
                 └───────┬───────┘
                         │
                    User Review
                         │
                         ▼
                ┌─────────────────┐
                │ Card Information │
                └────────┬────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Binder         Wishlist         Cart
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                  Price References
```

The objective is not to reproduce another application.

The objective is to make this workflow:

* fast;
* understandable;
* local-first;
* extensible;
* pleasant across desktop, tablet, and mobile.

---

# 18. Final Design Rules

1. **Pocket Market Binder is its own product.**
2. **External references provide context, not hidden requirements.**
3. **The user's collection is the primary local source of truth.**
4. **Providers supply external information; Binder owns collection state.**
5. **The initial theme choices are Water, Fire, and Grass.**
6. **Additional themes may be added as curated extensions.**
7. **Themes should use coherent design tokens rather than unrestricted color editing.**
8. **Manual workflows remain available alongside automation.**
9. **Scanner recognition should lead to user confirmation rather than silent collection changes.**
10. **Scanner failure should degrade gracefully to retry or manual search.**
11. **The architecture should not unnecessarily restrict future collectible categories.**
12. **Android/Capacitor is a downstream packaging path.**
13. **Reference features do not become requirements without an explicit project decision.**
14. **Scope and implementation status should remain explicitly distinguishable.**
15. **The product should grow deliberately rather than through feature imitation.**
