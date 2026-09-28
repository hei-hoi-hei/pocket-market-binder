# Pocket Market Binder
## AI Builder → Extraction → Reinforcement → Final Build Plan

> **Roadmap authority:** Lifecycle status is maintained in [CURRENT_STATE.md](./CURRENT_STATE.md). This document defines development order; it does not override the reconciled implementation status.

**Project:** Pocket Market Binder  
**Purpose:** Personal portfolio/reference project  
**Target Cost:** ₱0  
**Development Strategy:** AI-assisted incremental development

---

# 1. Core Development Strategy

The project will NOT be built entirely from scratch manually.

An AI application builder will first be used to generate a rapid prototype/scaffold.

The generated application is NOT considered the final architecture.

It is treated as:

> Raw material for our actual application.

Workflow:

    Product Specification
          ↓
    AI App Builder Prototype
          ↓
    Structural Audit
          ↓
    Keep Good Parts
          ↓
    Remove Unnecessary Parts
          ↓
    Reinforce Architecture
          ↓
    Implement Missing Functionality
          ↓
    Test
          ↓
    UI/UX Polish
          ↓
    Final Documentation

---

# 2. Why Use an AI App Builder?

The AI builder can rapidly generate:

- project structure
- routing
- responsive components
- initial UI
- card grids
- forms
- navigation
- state management
- PWA scaffolding
- placeholder data
- basic CRUD flows

This saves time and coding-agent credits.

Generated architecture must still be audited.

---

# 3. AI Builder's Role

The AI builder should primarily create:

1. Project skeleton
2. Navigation
3. Component structure
4. Basic screens
5. Placeholder data
6. Basic interactions
7. Responsive layout
8. Initial PWA structure

It should NOT be trusted automatically for:

- final architecture
- pricing methodology
- API security
- provider strategy
- offline architecture
- data normalization
- business rules
- unnecessary features

---

# 4. Initial AI Builder Prompt

Use a prompt similar to:

> Build a mobile-first Progressive Web App called **Pocket Market Binder**.
>
> The application is a simple personal Pokémon TCG collection companion designed to feel like a digital physical binder rather than an inventory management system.
>
> The user should be able to:
>
> - search Pokémon cards
> - manually add cards to a binder
> - see cards in a binder-style grid
> - track quantities
> - view card details
> - maintain a wishlist
> - maintain a virtual shopping cart
> - compare seller prices against market reference prices
> - see estimated collection value
>
> The application must be designed for an eventual offline-first architecture.
>
> For this initial prototype:
>
> - use local/mock data
> - do not implement paid services
> - do not implement authentication
> - do not implement payments
> - do not implement social features
> - do not implement a marketplace
> - do not implement subscriptions
> - do not implement unnecessary dashboards
>
> Prioritize:
>
> - clean component structure
> - reusable components
> - responsive design
> - simple navigation
> - maintainable code
> - clear separation between UI and data/service logic
>
> Do not assume the generated architecture will be retained unchanged.
>
> Build a clean prototype/scaffold that can later be audited and adapted.

---

# 5. Prototype Audit

After the AI builder generates the application, inspect the project before adding major functionality.

Evaluate:

## Structure

- Is the folder structure understandable?
- Are components separated appropriately?
- Is business logic separated from UI?
- Is data access separated from components?

## Dependencies

Identify:

- unnecessary libraries
- duplicate libraries
- paid dependencies
- unnecessary frameworks
- excessive packages

Remove unnecessary dependencies.

## Data

Determine:

- where card data lives
- where collection data lives
- how quantities are stored
- how state is managed
- whether data persistence is reliable

## UI

Identify:

- good reusable components
- useful layouts
- unnecessary screens
- unnecessary navigation
- components worth retaining

## API

Determine:

- whether API calls are embedded in components
- whether API abstraction exists
- whether API keys are exposed
- whether providers can be replaced

## Offline

Determine:

- whether service-worker support exists
- whether IndexedDB is used
- whether the app can work without internet
- whether cached data is separated from source data

---

# 6. Keep / Remove / Rewrite Classification

Every major generated feature should be classified:

    KEEP
    MODIFY
    REWRITE
    REMOVE
    DEFER

Example:

| Component | Decision |
|---|---|
| Navigation | KEEP |
| Card component | KEEP/MODIFY |
| Binder grid | KEEP/MODIFY |
| Search | KEEP/MODIFY |
| Wishlist | KEEP |
| Cart | KEEP/MODIFY |
| Authentication | REMOVE |
| User profiles | REMOVE |
| Social features | REMOVE |
| Marketplace | REMOVE |
| Subscription | REMOVE |
| Complex dashboard | SIMPLIFY |
| Pricing API | REWRITE |
| Database layer | AUDIT/REWRITE |
| Scanner | Historical prototype-plan status: DEFER. Current product direction supersedes this: scanner recognition is active scope; acquisition foundation exists, production recognition is unfinished. |
| Visual styling | KEEP AS PROTOTYPE |

---

# 7. Architecture Reinforcement

After auditing, establish our intended architecture.

    UI
     ↓
    Application Services
     ↓
    Local Data Layer
     ↓
    IndexedDB

External services connect through adapters:

    CardProvider
    PricingProvider
    ScannerProvider

## 7A. Preserved source ecosystem

The application is designed around a modular source/provider ecosystem rather than a single vendor. The eventual source registry covers catalog, pricing, artwork, and identification providers.

Provider behavior has two distinct forms:

- **Fallback:** try another provider when the current provider cannot satisfy a request.
- **Enrichment:** combine providers when one source supplies missing or additional information.

Free providers are the default. Optional user-owned paid/private providers may be configured only with the user's legitimate credentials where permitted. Shared credentials, credential redistribution, paid-access proxying, quota bypass, and mandatory paid services are prohibited. Credentials are separate from cards, collections, catalog, artwork, pricing observations, and ordinary exports.

## 7B. V1 scope and requirement lifecycle roadmap

V1 represents the complete original Pocket Market Binder product vision. A committed V1 requirement that is not implemented is unfinished V1 work, not automatically future scope. The roadmap must preserve missing V1 work until it is implemented, explicitly deferred by product decision, or explicitly removed.

| Requirement | Status | Phase / boundary | Reason or dependency |
|---|---|---|---|
| IndexedDB collection source of truth | Implemented | Preserve | User data must remain local-first |
| Manual catalog search and binder addition | Implemented | Preserve | Must remain independent of scanner |
| Catalog provider abstraction | Partial | Provider clarification | Existing registry is not a source resolver |
| Multiple catalog providers | Missing / committed | Provider phase | Requires resolver, priority, fallback, and enrichment decisions |
| Pricing aggregation and cache | Partial / substantially present | Pricing phase | Engine exists; live adapters and TCGdex schema need reconciliation |
| Production scanner recognition | Unfinished active requirement | Recognition phase | Benchmark and lifecycle evidence required before selecting production recognition approach |
| Scanner candidates and confirmation | Unfinished V1 / missing | Scanner integration phase | Depends on reliable recognition; provider must not mutate binder |
| User-owned provider credentials | Missing / committed | Provider configuration phase | Requires secure storage and export exclusion policy |
| Synchronization infrastructure | Partial / optional / future scope | Product decision gate | Scope requires explicit decision; pull, cursor, conflict wiring, and account lifecycle remain incomplete |
| Narrow-width UI hardening | Partial | UI hardening phase | Targeted corrections only; no redesign |
| Native Android/iOS packaging | Deferred | Platform phase | Requires stable PWA and native project setup |
| User-facing ChatGPT/AI feature | Not a V1 product requirement | Development workflow only | AI references describe tooling, not Binder functionality |

The roadmap must not allow a discussed requirement to disappear. Every requirement must be implemented, explicitly deferred with a reason, explicitly rejected, marked optional, or retained as unknown.

Do not allow UI components to directly depend on external providers.

---

# 8. Core Data Layer

Implement IndexedDB as the source of truth.

Stores:

    cards
    collection
    wishlist
    cart
    price_observations
    price_references
    sets
    settings

The user collection must remain available without internet.

---

# 9. Development Milestones

## Milestone 1 — Foundation

Build:

- application shell
- routing
- navigation
- responsive layout
- IndexedDB foundation
- basic PWA structure

Do not implement advanced pricing yet.

---

## Milestone 2 — Card Catalog

Implement:

- normalized card model
- card search
- local card cache
- card detail
- manual card addition

Initially use mock/static data if necessary.

---

## Milestone 3 — Binder

Implement:

- binder grid
- collection records
- quantity controls
- add/remove
- unique card count
- total physical card count
- collection value placeholder

Verify persistence thoroughly.

---

## Milestone 4 — Wishlist

Implement:

- add/remove wishlist
- wishlist screen
- card details from wishlist
- Add to Cart

---

## Milestone 5 — Shopping Cart

Implement:

- add card to cart
- quantity
- reference price
- seller price
- reference total
- seller total
- difference
- purchase workflow
- Add Purchased Cards to Binder

All calculations must work offline.

---

# 10. Pricing Integration

Only after the core collection system is stable should pricing providers be implemented.

Architecture:

    pricingService
          |
          +-- Provider A
          +-- Provider B
          +-- Provider C
          +-- Provider D

Providers should return normalized data.

Example:

```json
{
  "cardId": "sv8-123",
  "price": 12.43,
  "currency": "USD",
  "condition": "NM",
  "variant": "normal",
  "provider": "ExampleProvider",
  "observedAt": "timestamp"
}
```

---

# 11. Pricing Engine

The pricing engine should:

1. collect available provider observations
2. normalize them
3. validate card identity
4. normalize currency
5. filter obvious outliers
6. calculate a robust market reference
7. assign confidence
8. record source count
9. record update timestamp
10. cache the result

Store methodology version.

Example:

    Pocket Market Reference v1.0

---

# 12. Provider Strategy

Potential free providers:

- JustTCG
- PkmnPrices
- PokeTrace
- TickerMint
- Scrydex, only if an appropriate free tier exists

Do not make any single provider indispensable.

Do not build the project around unofficial scraping.

Do not assume API availability without verifying current documentation and terms.

---

# 13. Provider Failure Strategy

If one provider fails:

    Continue using others.

If all providers fail:

    Continue displaying cached prices.

If no cached price exists:

    Display:

    Price unavailable

Never block:

- binder
- collection
- search
- wishlist
- cart

because pricing APIs are unavailable.

---

# 14. Offline Implementation

After the core data model works:

Implement:

- service worker
- application-shell caching
- IndexedDB persistence
- offline detection
- stale-price indicators
- cached card data
- cached market references

Offline screen behavior should be deliberate rather than simply showing browser errors.

---

# 15. Scanner

**Historical plan note:** Scanner was deliberately postponed when this build-plan section was written. Current product direction supersedes that implementation status: scanner/recognition is an active product requirement and implementation track, with image-acquisition foundation committed but production recognition unfinished.

When implemented:

    Camera/Image
          ↓
    ScannerProvider
          ↓
    Candidate Cards
          ↓
    User Confirmation
          ↓
    Binder

Manual addition must remain available.

Scanner should never be required to use the application.

---

# 16. UI/UX Phase

Only after functionality is stable should visual refinement begin.

Target:

    Pokémon TCG
        +
    Physical Binder
        +
    Simple Personal App

Refine:

- binder pockets
- card presentation
- typography
- badges
- icons
- colors
- transitions
- empty states
- loading states
- offline states
- mobile interaction
- desktop responsiveness

Avoid copying official Pokémon assets or proprietary UI directly.

---

# 17. Testing Strategy

Test each feature independently.

## Collection

- add card
- remove card
- quantity +1
- quantity -1
- quantity cannot become invalid
- persistence after reload

## Search

- exact name
- partial name
- set
- card number
- owned indicator
- offline cached search

## Wishlist

- add
- remove
- persistence
- Add to Cart

## Cart

- add
- remove
- quantity
- seller price
- reference total
- seller total
- difference
- purchase → binder

## Pricing

- provider success
- provider failure
- multiple providers
- no providers
- cached value
- stale value
- currency conversion

## Offline

- reload offline
- open binder offline
- modify quantity offline
- use cart offline
- view cached prices offline

---

# 18. AI Coding Agent Strategy

Do not give the coding agent the entire project as one massive task.

Use small, controlled prompts.

Each task should:

1. identify the current architecture
2. inspect existing files
3. make only the required changes
4. preserve working functionality
5. test the affected feature
6. report changed files
7. report unresolved issues

Do not allow the agent to rewrite unrelated areas.

---

# 19. Credit Conservation

Because AI coding-agent credits are limited:

Prefer:

- small prompts
- focused changes
- reusable architecture
- explicit acceptance criteria
- existing component reuse
- incremental testing

Avoid:

- repeated full-project rewrites
- asking the agent to redesign everything
- rebuilding working features
- large speculative features
- unnecessary dependencies

---

# 20. Acceptance Criteria

The application should not proceed to UI polish until a user can:

1. open the app
2. search for a Pokémon card
3. view card details
4. add it to the binder
5. increase/decrease quantity
6. close/reopen the app
7. see the card still exists
8. add it to wishlist
9. add another card to cart
10. enter a seller price
11. compare seller price with reference price
12. calculate cart totals
13. add purchased cards to binder
14. view collection value
15. use the collection and cart offline

Once these work reliably, move to visual refinement.

---

# 21. Final Architecture Goal

    ┌──────────────────────────────┐
    │          PWA UI              │
    │                              │
    │ Home / Binder / Search       │
    │ Wishlist / Cart / Details    │
    └──────────────┬───────────────┘
                   │
                   ↓
    ┌──────────────────────────────┐
    │      Application Services     │
    │                              │
    │ CollectionService            │
    │ SearchService                │
    │ WishlistService              │
    │ CartService                  │
    │ PricingService               │
    └──────────────┬───────────────┘
                   │
          ┌────────┴─────────┐
          ↓                  ↓
    ┌──────────────┐   ┌───────────────┐
    │  IndexedDB   │   │ Online APIs   │
    │              │   │               │
    │ Collection   │   │ Card Provider │
    │ Wishlist     │   │ Pricing       │
    │ Cart         │   │ Scanner       │
    │ Cache        │   │               │
    └──────────────┘   └───────────────┘

IndexedDB remains the source of truth for user-owned data.

---

# 22. Definition of Success

The project is successful when a collector can take the application to a card shop and quickly:

    Search a card
         ↓
    See whether she owns it
         ↓
    See her quantity
         ↓
    See the latest cached market reference
         ↓
    Add a card she is considering to Cart
         ↓
    Enter the seller's actual price
         ↓
    Compare the two
         ↓
    Purchase it
         ↓
    Add it directly to her Binder

The application should feel simpler than a full collection-management platform.

---

# 23. Guiding Rule

> Build the smallest useful thing first.

Do not add a feature merely because an AI builder suggests it.

Do not retain generated architecture merely because it already exists.

Do not rewrite good code merely because it came from an AI builder.

Use the AI builder to accelerate scaffolding.

Use the product specification to determine what belongs in the product.

Use architectural review to determine what belongs in the codebase.

Use the coding agent to implement the final system incrementally.
