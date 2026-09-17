# Pocket Market Binder
## Architecture Decisions & Engineering Principles

**Status:** Initial architecture baseline  
**Project:** Pocket Market Binder  
**Target Cost:** ₱0  
**Primary Platform:** Mobile-first PWA  
**Primary TCG:** Pokémon TCG

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

> Local-first → API-assisted → cloud-optional

The user's collection belongs to the user and must not depend on a remote server.

External services provide supplemental information such as:

- card catalog data
- market prices
- scanning/identification

The application should continue functioning when external services fail.

---

# 3. Core Architecture

Preferred structure:

    ┌─────────────────────────────────────┐
    │              UI / PWA               │
    │                                     │
    │ Home / Binder / Search / Details    │
    │ Wishlist / Cart                     │
    └──────────────────┬──────────────────┘
                       │
                       ▼
    ┌─────────────────────────────────────┐
    │       Application Service Layer     │
    │                                     │
    │ CollectionService                   │
    │ SearchService                       │
    │ WishlistService                     │
    │ CartService                         │
    │ PricingService                      │
    │ CardService                         │
    └──────────────────┬──────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
    ┌─────────────────┐  ┌──────────────────┐
    │    IndexedDB    │  │ External APIs    │
    │                 │  │                  │
    │ User Data       │  │ Card Providers  │
    │ Cached Cards    │  │ Pricing         │
    │ Cached Prices   │  │ Scanner         │
    └─────────────────┘  └──────────────────┘

The UI should communicate with application services rather than directly accessing APIs or IndexedDB where practical.

---

# 4. Decision: IndexedDB Is the Collection Source of Truth

**Decision:** User-owned collection data is stored in IndexedDB.

This includes:

- collection
- quantities
- wishlist
- shopping cart
- local settings
- cached card information
- cached pricing information

Reason:

The application must work offline and must operate at ₱0.

A remote database is unnecessary for V1.

---

# 5. Decision: No Authentication in V1

**Decision:** Do not implement user accounts or authentication.

Reason:

This is primarily a personal collection application.

Authentication would introduce:

- backend infrastructure
- account management
- password/security concerns
- additional dependencies
- unnecessary complexity

Cloud synchronization can be considered later.

---

# 6. Decision: No Mandatory Backend

**Decision:** The core application should not require a backend server.

The application should be capable of running as a static PWA.

A backend/serverless layer may be introduced later only when a concrete requirement exists, such as:

- protecting a provider API key
- cloud synchronization
- server-side processing

Do not introduce a backend merely because an AI builder generates one.

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

Card scanning is an optional enhancement.

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

# 31. Decision: No Premature Cloud Sync

Cloud backup/synchronization is deferred.

Reason:

- ₱0 requirement
- personal use
- additional complexity
- conflict resolution requirements
- authentication requirements

Potential future architecture:

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
| No authentication in V1 | ACCEPTED |
| No mandatory backend | ACCEPTED |
| Provider abstraction | ACCEPTED |
| Own market-reference calculation | ACCEPTED |
| Cached pricing | ACCEPTED |
| Scanner deferred | ACCEPTED |
| Cloud sync deferred | ACCEPTED |
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
