# Pocket Market Binder
## Architecture Decisions & Engineering Principles

**Status:** Initial architecture baseline  
**Project:** Pocket Market Binder  
**Target Cost:** ₱0  
**Primary Platform:** Mobile-first PWA  
**Primary TCG:** Pokémon TCG

> **Current-state authority:** See [CURRENT_STATE.md](./CURRENT_STATE.md) for implementation status and [POCKET_MARKET_BINDER_BUILD_PLAN.md](./POCKET_MARKET_BINDER_BUILD_PLAN.md) for lifecycle order. This document records invariants, not a claim that every planned capability is implemented.

---

# 1. Purpose

This document records architectural decisions for Pocket Market Binder.

It exists to prevent AI coding tools from repeatedly changing the project's architecture based on convenience, generated defaults, or unrelated patterns.

The Product Specification defines **what the application should do**.

The Build Plan defines **how the project should be developed**.

This document defines **the engineering principles and architectural decisions the codebase should follow**.

When a generated implementation conflicts with this document, the conflict must be reviewed before changing the architecture.

---

# 2. Architecture Philosophy

The application follows:

> Local-first collection → shared API-assisted reference data → independently backed-up user data

The user's collection belongs to the user and must not depend on a remote server.

External services provide supplemental information such as:

- card catalog data
- market prices
- scanning/identification

**V1 decision:** A PMB backend/API and shared reference cache are part of the V1 architecture. This supersedes the historical “no mandatory backend” decision below for reusable external reference data only. It does not make the backend the user's Binder authority or a prerequisite for local collection use. V1 also includes a distinct backup/restore pipeline for user-owned data. Neither service is implemented or vendor-selected.

## Decision preservation

- The source architecture is modular and must not be narrowed to TCGdex alone.
- **Multiple external sources, one canonical local truth:** providers are replaceable sources, not permanent domain authorities. TCGdex remains the current catalog/identity authority; the user's collection remains locally owned.
- Provider fallback and provider enrichment are distinct behaviors.
- Free providers are the default; private or paid providers are optional BYO-credential sources.
- Shared paid credentials, paid-access proxying, quota bypass, and mandatory paid services are prohibited.
- Credentials remain separate from canonical cards, collections, catalog, artwork, pricing observations, and ordinary exports.
- Pricing remains supplemental and separate from canonical `Card` identity.
- Scanner providers produce candidates only; user confirmation precedes binder mutation.
- Identity verification is metadata verification, not image recognition.
- Scanner failure must not break manual binder workflows.
- Native packaging is separate from PWA functionality.
- Responsive hardening must not become an unsolicited visual redesign.

The application should continue functioning when external services fail.

Provider failure is an external-data problem, not a collection-data problem. Source availability, terms, coverage, quality, and authentication can change independently. Alternative sources may participate where the domain supports them; do not assume a provider outage invalidates local data or that one provider must always be primary.

---

# 3. Core Architecture

Preferred V1 structure:

    ┌─────────────────────────────────────┐
    │        External Providers           │
    │  Catalog / Pricing / Artwork        │
    └──────────────────┬──────────────────┘
                       ▼
    ┌─────────────────────────────────────┐
    │         PMB Backend / API           │
    │      Shared Reference Cache         │
    └──────────────────┬──────────────────┘
                       ▼
    ┌─────────────────────────────────────┐
    │          User Device / PWA          │
    │       Application Service Layer     │
    │                                     │
    │ CollectionService / SearchService   │
    │ WishlistService / CartService       │
    │ PricingService / CardService        │
    └──────────────┬──────────────┬───────┘
                   │              │
                   ▼              ▼
    ┌─────────────────┐  ┌──────────────────┐
    │    IndexedDB    │  │ PMB Backend / API│
    │                 │  │                  │
    │ User Data       │  │ Reference Data   │
    │ Local Cache     │  │ Stable API       │
    └─────────────────┘  └──────────────────┘

The PMB backend/API is the stable application-facing boundary for shared reference data; the client does not directly call upstream reference providers in the approved V1 architecture. Application services use IndexedDB for local user-owned state and local cache. The backend is not the source of truth for the user's collection.

### V1 reference-data and backup paths

```text
External Providers
(TCGdex / pricing / artwork / future providers)
             ↓
      PMB Backend / API
             ↓
     Shared Reference Cache
             ↓
        User Device
             ↓
       Local IndexedDB
             ↓
             UI

Separate user-data path:
Local IndexedDB → versioned backup → manual export / remote backup where feasible
```

Performance target:

```text
Cold:              User → PMB → Provider → PMB → User
Warm server cache: User → PMB → User
Warm device cache: User → IndexedDB → User
```

The backend should normalize provider responses, retain source/provenance and freshness/version information, deduplicate upstream requests, apply rate limits, serve warm shared cache to multiple users, and provide a stable application-facing API. These are target V1 responsibilities, not implemented capabilities. Prefer a usable cache response over waiting on a slow external provider.

---

# 4. Decision: IndexedDB Is the User Collection Source of Truth

**Decision:** User-owned working state remains in local IndexedDB. A PMB shared-reference backend does not own or replace this data.

This includes:

- Binder/collection entries and quantities
- Wishlist and Cart
- notes and user-owned metadata
- preferences/settings

The application must remain locally useful offline and during PMB backend or provider outages. IndexedDB collection state is durable user data, not a disposable cache. Local cache may also hold working/reference data where appropriate, but it is separate from user-owned records.

---

# 5. Decision: No Account Required for Local Use

**Decision:** Local collection use must not require an account or authentication. No authentication design or service is selected here.

Reason:

This is primarily a personal collection application.

Authentication would introduce:

- backend infrastructure
- account management
- password/security concerns
- additional dependencies
- unnecessary complexity

Automatic/remote backup may require an explicit identity, device-linking, or authorization design; that design remains open and must not make local use dependent on login. Manual export/import remains available independently.

---

# 6. Historical Decision: No Mandatory Backend (Superseded for Shared Reference Data)

This is a historical constraint and is superseded by the accepted V1 shared-reference backend decision in section 2. The client remains a PWA and local collection functions without the backend, but V1 includes a backend/API for shared normalized reference data and reusable caches.

The V1 backend is not a collection database. No vendor, database, authentication design, or implementation is selected. Do not add paid dependencies/services without a separate terms and cost review.

## 6.1 Cache classes and ownership

1. **User-owned durable state:** Binder, Wishlist, Cart, quantities, notes/user-owned metadata, and preferences. Local IndexedDB is the working source of truth.
2. **Shared reference cache:** reusable catalog metadata, normalized provider information, and artwork only when exact-printing/provenance and usage eligibility support caching/serving. Provider hosting is not permission to redistribute; preserve provenance and distinguish eligible, unresolved, and ineligible usage.
3. **Temporary/request cache:** search responses, transient provider results, short-lived price lookups, and recognition attempts/results. These are disposable and are not collection records or backup requirements.

Do not confuse the PMB shared cache with user backup, or IndexedDB collection state with disposable cache.

## 6.2 Decision: V1 Backup/Restore Pipeline

Backup/restore is a V1 data pipeline, separate from shared reference caching and multi-device collection synchronization. Backups primarily preserve user-owned Binder, Wishlist, Cart, quantities, notes/metadata, preferences, and the schema/version needed to restore or migrate them.

V1 should support manual export, manual import/restore, schema versioning/migration, and automatic/remote backup where feasible. Backups need not contain all cached artwork, external catalog payloads, search results, or disposable provider responses; these can normally be restored from PMB shared cache or fetched again. The backend/shared cache is not a user backup, and a backup does not make the server authoritative for active collection state.

Manual collection export/import exists today; validated, versioned restore and automatic/remote backup are not implemented. No backup service is selected or built here.

---

# 7. Decision: External APIs Are Optional Dependencies

External APIs must never be required for basic collection functionality.

The application must continue to support:

- viewing the binder
- changing quantities
- searching cached cards
- wishlist
- cart
- seller-price calculations
- cached market references

when external services are unavailable.

---

# 8. Decision: Provider Abstraction

External services must be accessed through adapters/interfaces.

Example:

```text
CardProvider
PricingProvider
ScannerProvider
```

The application should not embed provider-specific logic throughout UI components.

Preferred:

```javascript
const card = await cardService.getCard(id);
const price = await pricingService.getPrice(card);
```

Avoid:

```javascript
fetch("provider-specific-url")
```

inside UI components.

Reason:

Providers can change pricing, limits, APIs, availability, or terms.

The application should remain replaceable and maintainable.

Pricing providers form a replaceable source pool. They supply observations, not an authoritative final price. The application derives its own Binder market estimate from observations that have been verified as comparable and retains the original observations and provenance. Approximately three or four reliable sources may be compared when available, but this is not a fixed count or minimum requirement: evidence may vary per card from several sources to one indication or no estimate.

The future comparison must verify exact printing/variant and normalize relevant condition, grading, language, market/listing type, and currency dimensions where data permits. Preserve unusual observations and their sources; assess comparability before outlier treatment, and do not discard a legitimate premium merely because it is high. The future method must be transparent and deterministic. Median, trimmed mean, standard-deviation filtering, or another specific method is not selected by this design decision. Current implemented pricing behavior is described separately in the architecture/status documentation.

## 8A. Artwork Source-Pool Boundary

**Implemented foundation:** The artwork resolver accepts a provider list, normalizes candidate provenance, isolates failures, and deterministically selects candidates with evidenced exact-printing verification. Eligible usage is selectable; unresolved usage requires an explicit provider compatibility setting; ineligible usage is always rejected. TCGdex is the only configured production provider and explicitly opts into unresolved-usage compatibility to preserve current display while its usage eligibility remains unresolved. This is not a rights determination. Additional provider integration and verified usage eligibility remain future work.

Artwork providers supply candidate images; they do not own or replace canonical card identity. TCGdex remains the current catalog/identity authority. For each canonical identity, the future artwork resolution should establish:

1. whether the candidate is for the exact printing;
2. whether the image is actually available;
3. whether artwork usage/display is sufficiently supported by applicable terms;
4. which eligible candidate is preferable by observable quality and URL/source stability.

Printing verification is a selection gate. Explicitly ineligible usage is rejected; unresolved usage remains distinct from eligible and is not presented as permission. Unresolved usage is not selectable by default and requires explicit provider compatibility configuration; TCGdex alone currently has that compatibility to preserve its existing display. Do not select an image merely because its URL is public or its database/API is open-source. Keep source identity, exact-printing evidence, image reference, usage basis, quality/resolution, and retrieval time with the selected artwork where available. If no candidate passes printing verification and the configured usage policy, retain the UI placeholder instead of guessing a similar printing.

No secondary artwork provider is currently approved or integrated. See [ARTWORK_SOURCE_INVESTIGATION.md](./ARTWORK_SOURCE_INVESTIGATION.md) for bounded evidence for `30th-c-001` through `30th-c-030`.

---

# 9. Pricing Provider Architecture

Potential providers may include:

- JustTCG
- PkmnPrices
- PokeTrace
- TickerMint
- Scrydex if a suitable free tier exists

Provider availability and terms must be verified before implementation.

Do not build the entire application around one provider.

Do not use unofficial scraping as the foundation of the pricing system.

---

# 10. Decision: Our Own Market Reference

**Decision:** The application will calculate a normalized market reference rather than treating one provider as the absolute truth.

Working name:

> Pocket Market Reference

General pipeline:

    Provider Observations
            ↓
       Normalize
            ↓
       Validate Match
            ↓
      Filter Outliers
            ↓
      Calculate Reference
            ↓
     Confidence Metadata
            ↓
          Cache

The exact methodology must be documented and versioned.

Do not claim that Pocket Market Reference reproduces Collectr's proprietary algorithm.

---

# 11. Price Data Model

Price observations should retain source information.

Example:

```json
{
  "cardId": "sv8-123",
  "provider": "example",
  "price": 12.43,
  "currency": "USD",
  "condition": "NM",
  "variant": "normal",
  "observedAt": "timestamp"
}
```

Derived reference:

```json
{
  "cardId": "sv8-123",
  "referencePrice": 12.43,
  "currency": "USD",
  "methodologyVersion": "1.0",
  "confidence": "high",
  "sourceCount": 4,
  "updatedAt": "timestamp"
}
```

Keep raw observations separate from derived references.

---

# 12. Decision: Cached Market Data

Market data must be cached locally.

A cached price must include:

- price
- currency
- provider/source
- observed/updated timestamp
- methodology version where applicable
- confidence/data availability

The UI must distinguish:

- current/online data
- cached data
- stale data
- unavailable data

Do not label cached data as realtime.

---

# 13. Decision: Source Currency Is Preserved

Store market prices in their original source currency.

Example:

```json
{
  "price": 12.43,
  "currency": "USD"
}
```

PHP conversion is a presentation layer.

Do not overwrite source values with PHP.

Exchange-rate data should be stored separately and may itself be cached.

---

# 14. Decision: Collection Calculations Are Local

These calculations must not require an API:

    Card Reference × Quantity
    Collection Total
    Cart Reference Total
    Cart Seller Total
    Cart Difference
    Difference Percentage

They should work offline.

---

# 15. Decision: Scanner Is Not a Core Dependency

**Historical decision context:** Scanning was previously described as an optional enhancement and deferred from the original V1 implementation plan. The current product direction is that scanner/recognition is an active product requirement and implementation track; its production implementation remains unfinished. “Not a core dependency” means the Binder must continue to work when scanning is unavailable, not that scanner is outside product scope.

The application must always provide manual card entry.

Scanner architecture:

    Image/Camera
          ↓
    ScannerProvider
          ↓
    Candidate Cards
          ↓
    User Confirmation
          ↓
    Collection

If scanning fails or is unavailable, the rest of the application must continue working.

---

# 16. Decision: UI Does Not Own Business Logic

UI components should primarily:

- display state
- collect input
- call services
- render results

Business rules belong in service/domain layers.

Examples:

```text
CollectionService
CartService
WishlistService
PricingService
```

Avoid placing complex calculations or provider logic directly inside page components.

---

# 17. Decision: Data Access Is Centralized

IndexedDB access should be centralized in a data/repository layer.

Example:

```text
repositories/
    cardRepository
    collectionRepository
    wishlistRepository
    cartRepository
    priceRepository
```

Application services call repositories.

UI components should not repeatedly implement their own IndexedDB transactions.

---

# 18. Suggested Project Structure

The exact structure may adapt to the chosen framework, but the conceptual separation should remain.

Example:

    src/
    ├── components/
    │   ├── cards/
    │   ├── binder/
    │   ├── cart/
    │   └── common/
    │
    ├── pages/
    │   ├── Home/
    │   ├── Binder/
    │   ├── Search/
    │   ├── Wishlist/
    │   ├── Cart/
    │   └── CardDetail/
    │
    ├── services/
    │   ├── cardService
    │   ├── collectionService
    │   ├── wishlistService
    │   ├── cartService
    │   └── pricingService
    │
    ├── repositories/
    │   ├── cardRepository
    │   ├── collectionRepository
    │   ├── wishlistRepository
    │   ├── cartRepository
    │   └── priceRepository
    │
    ├── providers/
    │   ├── card/
    │   ├── pricing/
    │   └── scanner/
    │
    ├── db/
    │   ├── indexedDb
    │   └── migrations
    │
    ├── models/
    │
    ├── utils/
    │
    └── styles/

The actual framework may change the physical layout, but responsibilities should remain separated.

---

# 19. Decision: Card Identity Must Be Precise

A card should not be identified by name alone.

Where available, identity should include:

- game
- set
- set ID
- card number
- variant/printing
- language
- provider-specific identifiers

Reason:

Cards can share names while having different:

- sets
- numbers
- artwork
- rarities
- printings
- languages
- market values

---

# 20. Decision: User Data and External Data Are Different

Separate:

### User-owned data

- quantity
- condition
- language
- variant
- notes
- wishlist state
- cart state
- purchase information if later implemented

### External/reference data

- card catalog metadata
- images
- market prices
- sales observations
- exchange rates

External data may be refreshed.

User-owned data must not be overwritten by provider updates.

---

# 21. Decision: Inventory/Binder Data Is Never Silently Overwritten

If external card data changes:

- update cached metadata when appropriate
- preserve collection quantity
- preserve user notes
- preserve user-specific settings

The user's collection remains authoritative for ownership information.

---

# 22. Offline-First Rules

When offline:

1. Read from IndexedDB.
2. Allow collection modifications.
3. Allow cart modifications.
4. Allow wishlist modifications.
5. Perform calculations locally.
6. Display cached prices.
7. Clearly indicate stale/cached information.
8. Do not repeatedly retry failed APIs.
9. Do not delete cached information because an API is unavailable.

When online:

1. Refresh data when appropriate.
2. Update cache.
3. Preserve user-owned records.
4. Record timestamps.
5. Gracefully handle provider errors.

---

# 23. PWA Architecture

The PWA should use:

- Web App Manifest
- Service Worker
- cached application shell
- IndexedDB for application data

The service worker should primarily ensure the application itself can load offline.

IndexedDB is responsible for dynamic user data.

Do not attempt to store the entire world-scale card catalog locally unless there is a concrete reason.

---

# 24. Security Rules

Never commit:

- API keys
- private tokens
- secrets
- credentials

Repository should include:

    .env.example
    .gitignore

If a provider requires a secret API key:

1. Determine whether a client-side key is actually safe.
2. If not, use an appropriate serverless/backend proxy.
3. Keep the secret outside the public repository.

Do not expose secrets merely to preserve a static architecture.

---

# 25. Dependency Philosophy

Prefer:

> fewer dependencies + understandable code

Avoid adding libraries for functionality that can be implemented simply.

Before installing a dependency, ask:

1. Is it necessary?
2. Is there already an existing dependency that solves this?
3. Is it free?
4. Is it maintained?
5. Does it significantly increase complexity?

---

# 26. AI-Generated Code Rules

AI-generated code is not automatically accepted.

Every major generated change should be reviewed for:

- unnecessary abstraction
- duplicated logic
- excessive dependencies
- security problems
- incorrect assumptions
- hidden backend requirements
- API coupling
- poor offline behavior
- unnecessary complexity

AI-generated code may be:

    KEEP
    MODIFY
    REWRITE
    REMOVE

Do not preserve bad architecture simply because it already works.

Do not rewrite good code merely because it was AI-generated.

---

# 27. AI Builder Boundary

The AI app builder is responsible for rapid scaffolding.

It is NOT the final authority on:

- architecture
- data persistence
- pricing methodology
- API security
- business rules
- feature scope

The generated application should be treated as a prototype.

The project should be moved into our controlled repository/workflow before serious feature development.

---

# 28. Cline Boundary

Cline is the primary AI coding agent for the actual implementation after the scaffold is established.

Cline should:

- inspect the repository before changing it
- read project documentation
- preserve architecture decisions
- make focused changes
- test changes
- avoid unrelated rewrites
- report changed files
- identify unresolved issues

Cline should not introduce major architecture changes without explicit review.

---

# 29. Documentation as AI Memory

The repository should contain:

    docs/
    ├── PRODUCT_SPEC.md
    ├── BUILD_PLAN.md
    └── ARCHITECTURE_DECISIONS.md

These documents serve as persistent project context for AI coding tools.

AI agents should consult them before major implementation changes.

---

# 30. Decision: No Premature Generalization

The architecture should be TCG-agnostic where doing so is cheap.

However, do not build a complicated universal TCG framework in V1.

Good:

    card.game = "pokemon"

Avoid prematurely building:

    UniversalTCGEngine
    GenericTCGRuleSystem
    PluginMarketplace

The application should first be an excellent Pokémon binder.

---

# 31. Decision: Collection Synchronization Is Separate from V1 Backup and Shared Cache

Multi-device live collection synchronization remains a separate optional/future decision. Its conflicts, accounts, and bidirectional state are not implied by the V1 shared reference backend or the V1 backup/restore pipeline.

V1 backup/restore is accepted scope, including automatic/remote backup where feasible, as well as manual export/import and schema migration. This supersedes the historical statement that cloud backup itself is deferred. Backup is a versioned copy/restore path for user-owned data, not continuous synchronization.

The implementation and remote-backup access model remain to be designed. Do not introduce authentication, sync, or a backend vendor without the relevant scoped decision.

Potential future synchronization architecture (not the V1 backup/cache architecture):

    IndexedDB
        ↕
    Sync Service
        ↕
    Cloud Storage

This should only be implemented when there is a concrete need.

---

# 32. Decision: No Commercial Infrastructure

Do not optimize for:

- thousands of users
- high-scale backend infrastructure
- payment processing
- subscriptions
- multi-tenant architecture

This is a portfolio/reference application.

Architecture should be appropriately sized for the actual project.

---

# 33. Performance Principles

Prioritize:

- fast initial load
- lazy loading where useful
- cached card images
- efficient IndexedDB queries
- minimal API calls
- batched provider requests where supported
- avoiding unnecessary rerenders
- responsive mobile interaction

Do not optimize prematurely based on hypothetical scale.

---

# 34. UI Architecture Principle

Visual polish should not contaminate business logic.

Card components should receive normalized data rather than knowing how a particular API works.

Example:

```javascript
<Card
  card={card}
  quantity={quantity}
  price={marketReference}
/>
```

The card component should not know:

- which API provided the price
- how the price was calculated
- how IndexedDB works
- how the provider was authenticated

---

# 35. Architecture Change Process

When a major architectural change is proposed:

1. Identify the problem.
2. Explain why the current architecture is insufficient.
3. Consider whether a smaller change solves it.
4. Evaluate cost and complexity.
5. Update this document if the decision is accepted.
6. Only then implement the change.

Do not allow architecture to drift silently.

---

# 36. Current Architectural Priorities

Priority order:

1. Reliability
2. Local persistence
3. Simple user workflow
4. Offline functionality
5. Replaceable providers
6. Maintainability
7. Performance
8. Visual polish
9. Advanced features

---

# 37. Current Decisions Summary

| Decision | Status |
|---|---|
| Local-first architecture | ACCEPTED |
| IndexedDB as collection source of truth | ACCEPTED |
| PWA | ACCEPTED |
| ₱0 operating target | ACCEPTED |
| Local use requires no authentication | ACCEPTED; remote-backup access design remains open |
| V1 PMB shared reference backend/cache | ACCEPTED; not implemented, vendor/database unselected; never owns collection state |
| V1 backup/restore pipeline | ACCEPTED; manual export/import exists, complete versioned/automatic-remote pipeline unfinished |
| Provider abstraction | ACCEPTED |
| Own market-reference calculation | ACCEPTED |
| Cached pricing | ACCEPTED |
| Multiple external sources, one canonical local truth | ACCEPTED; artwork provider-pool foundation implemented, generalized orchestration remains future |
| Secondary artwork source | NOT APPROVED; bounded evidence recorded in `ARTWORK_SOURCE_INVESTIGATION.md` |
| Scanner deferred | Historical decision; superseded by current active scanner requirement (production recognition unfinished) |
| Cloud backup deferred | Historical decision; superseded by accepted V1 backup/restore pipeline |
| Cloud collection sync deferred | Historical decision; multi-device sync remains separate optional/future scope |
| Multi-TCG support deferred | ACCEPTED |
| AI builder for scaffolding | ACCEPTED |
| Cline for primary implementation | ACCEPTED |
| Functionality before visual polish | ACCEPTED |

---

# 38. Final Engineering Rule

> The application should be simple for the user and disciplined underneath.

The user should see:

    Search
    Binder
    Wishlist
    Cart
    Market Reference

The code should provide:

    Local-first storage
    Service separation
    Repository separation
    Provider abstraction
    Cached external data
    Offline resilience
    Documented architectural decisions

Do not sacrifice simplicity of the user experience for unnecessary technical sophistication.
