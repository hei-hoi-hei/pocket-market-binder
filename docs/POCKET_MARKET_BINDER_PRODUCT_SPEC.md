# Pocket Market Binder
## Product Specification

**Project Type:** Personal Portfolio / Reference Project  
**Primary Platform:** Mobile-first Progressive Web App (PWA)  
**Primary TCG:** Pokémon TCG  
**Operating Cost Target:** ₱0  
**Architecture:** Local-first / Offline-first  
**Development Philosophy:** Functionality first, UI/UX polish second

---

# 1. Product Overview

Pocket Market Binder is a simple digital Pokémon TCG collection companion designed for casual collectors who find existing collection-management applications unnecessarily complicated.

The application should feel like a **digital physical binder**, rather than an inventory management system.

The primary goal is to make these actions extremely easy:

1. Find a card.
2. Determine whether it is already owned.
3. Add it to the binder.
4. Track how many copies are owned.
5. See an estimated current market reference.
6. Maintain a wishlist.
7. Add prospective purchases to a virtual shopping cart.
8. Compare seller prices against the market reference.
9. Continue using the collection even without an internet connection.

The application is Pokémon-first, but the underlying architecture should avoid hard-coding Pokémon-specific assumptions wherever practical so that additional TCGs can be supported later.

---

# 2. Core Product Principle

> Make collecting simple.

The application should answer five questions extremely well:

- What cards do I have?
- How many do I have?
- How much are they roughly worth?
- Do I already own this card?
- How does a card I'm considering buying compare with the current market reference?

Everything else is secondary.

---

# 3. Hard Constraints

## 3.1 Cost

The project must operate at **₱0**.

Do not introduce paid dependencies or services.

Avoid:

- paid APIs
- paid hosting
- paid databases
- paid AI services
- paid OCR services
- paid authentication
- paid storage
- paid subscriptions

Free tiers are acceptable when their current terms permit the intended use.

The application must remain useful if an external provider becomes unavailable.

## 3.2 Distribution

This is primarily a portfolio/reference project.

There is no requirement for:

- Google Play deployment
- Apple App Store deployment
- APK distribution
- commercial distribution
- subscriptions
- monetization

GitHub source code and optional free static hosting are sufficient.

## 3.3 Development Priority

Development must follow:

> Functionality → Reliability → Offline capability → UI/UX polish

Do not spend significant development effort on visual polish while core functionality remains incomplete.

---

# 4. Target User

The primary user is a casual Pokémon card collector.

The application should assume that the user:

- owns physical Pokémon cards
- wants a simple way to catalog them
- wants to know how many copies of a card they own
- wants to quickly search their collection
- wants a wishlist
- may compare cards while shopping
- may use the application at physical card shops
- may not want complicated investment/portfolio features

The application should not assume the user understands complex TCG terminology.

---

# 5. Platform

The application should be a mobile-first PWA.

It should work on:

- mobile browsers
- tablets
- desktop browsers

It should be installable as a PWA.

---

# 6. Recommended Technology

Preferred technologies:

- HTML5
- CSS3
- JavaScript ES6+
- Bootstrap 5
- IndexedDB
- Service Worker
- Web App Manifest
- Chart.js where genuinely useful

React/Vite or another lightweight frontend framework may be used if it provides a clear structural benefit.

Do not introduce frameworks solely for the sake of using them.

The project should remain understandable and maintainable.

---

# 7. Architecture

High-level architecture:

    PWA Frontend
          |
          +---------------------+
          |                     |
      IndexedDB            Online Services
          |                     |
          |          +----------+----------+
          |          |          |          |
          |       Card API   Pricing    Scanner
          |                    APIs       API
          |                     |
          |              Pricing Engine
          |                     |
          +----------+----------+
                     |
              Application UI

IndexedDB is the source of truth for user-owned collection data.

External APIs provide supplemental data.

The application must not depend on an external API for basic collection functionality.

---

# 8. Local-First Data Architecture

IndexedDB should store:

- cards
- collection
- wishlist
- cart
- price observations
- calculated market references
- sets
- settings
- metadata/sync information

Suggested stores:

    cards
    collection
    wishlist
    cart
    price_observations
    price_references
    sets
    settings
    sync_metadata

---

# 9. Card Data Model

Normalized card model:

```json
{
  "id": "sv8-123",
  "game": "pokemon",
  "name": "Example Card",
  "set": "Surging Sparks",
  "setId": "sv8",
  "cardNumber": "123",
  "rarity": "Illustration Rare",
  "variant": "normal",
  "language": "EN",
  "imageUrl": "...",
  "cachedAt": "timestamp"
}
```

The actual fields may evolve, but card identity should be sufficiently precise to distinguish:

- set
- card number
- printing/variant
- language
- other relevant identifiers

---

# 10. Collection Data Model

Suggested collection record:

```json
{
  "id": "unique-id",
  "cardId": "sv8-123",
  "quantity": 3,
  "condition": "NM",
  "language": "EN",
  "variant": "normal",
  "notes": "",
  "addedAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Quantity is a core feature.

The user must be able to increase/decrease quantity quickly.

Example:

    Pikachu

    Owned: 3

    [-]   3   [+]

---

# 11. Search

Search is a first-class feature.

The user should be able to search by:

- card name
- partial card name
- set
- card number
- rarity where available

Search results should immediately indicate ownership.

Example:

    ✓ Owned ×3

or:

    Not in Binder

Cached card data should remain searchable offline.

---

# 12. Binder

The binder is the heart of the application.

The interface should resemble a physical trading-card binder.

Default layout:

    +---------+---------+---------+
    |  CARD   |  CARD   |  CARD   |
    +---------+---------+---------+
    |  CARD   |  CARD   |  CARD   |
    +---------+---------+---------+
    |  CARD   |  CARD   |  CARD   |
    +---------+---------+---------+

Use a 9-pocket visual concept where appropriate.

Each card should show:

- card image
- quantity
- optional indicators

Empty slots can resemble empty binder pockets.

The binder must not look like a spreadsheet.

---

# 13. Card Detail

A card detail screen should show:

- card image
- card name
- set
- card number
- rarity
- variant
- language
- owned quantity
- market reference
- currency
- PHP equivalent where available
- price update date
- confidence/data availability
- wishlist status
- cart action

---

# 14. Collection Value

Collection value is calculated using:

    Reference Price × Quantity

The application must clearly describe this as an estimated/reference value.

It is not a guaranteed selling price.

---

# 15. Pricing System

The application should use a provider abstraction.

UI components must not directly depend on a specific pricing API.

Example:

```javascript
pricingService.getPrice(card)
pricingService.getHistory(card)
pricingService.getLastUpdated(card)
```

Potential providers:

- JustTCG
- PkmnPrices
- PokeTrace
- TickerMint
- Scrydex, only if an appropriate free tier exists

Only providers with suitable free access and appropriate current usage terms should be enabled.

Scrydex is optional.

The application must not depend on paid Scrydex functionality.

---

# 16. Pricing Engine

The application should calculate its own normalized market reference rather than blindly displaying whichever provider responds first.

Pipeline:

    Provider data
          ↓
    Normalize
          ↓
    Validate
          ↓
    Match card identity
          ↓
    Filter obvious outliers
          ↓
    Calculate reference
          ↓
    Assign confidence
          ↓
    Cache
          ↓
    Display

Initial approach:

1. Match the exact card where possible.
2. Match set/card number.
3. Match printing/variant.
4. Match language.
5. Match condition category.
6. Normalize currencies.
7. Remove obvious outliers using a robust statistical method.
8. Use a median or similar robust reference.
9. Track source count.
10. Track update time.
11. Store methodology version.

Do not claim that this exactly reproduces Collectr's proprietary methodology.

The application's calculated value should be called:

    Pocket Market Reference

or:

    Market Reference

---

# 17. Pricing Methodology Versioning

The pricing algorithm must be versioned.

Example:

    Pocket Market Reference v1.0

Future versions may introduce:

- improved outlier handling
- recency weighting
- provider reliability weighting
- additional sales observations

Existing cached references should retain their methodology version.

---

# 18. Price Confidence

Each market reference should have a confidence/data availability indicator.

Examples:

    High confidence — 4 sources
    Moderate confidence — 2 sources
    Limited data — 1 source
    Price unavailable — no usable data

Confidence is informational and must not be presented as an investment recommendation.

---

# 19. Price Caching

Prices must be cached locally.

Display:

    $12.43 USD
    Updated: [date]

Offline:

    $12.43 USD
    ⚠ Offline — Using cached price

Never present cached data as live/realtime data.

Preferred terminology:

- Market Reference
- Latest Market Reference
- Cached Price
- Updated
- Reference Value

---

# 20. Currency

Store the source currency.

Example:

```json
{
  "value": 12.43,
  "currency": "USD"
}
```

Maintain exchange-rate data separately.

Display:

    $12.43 USD
    ≈ ₱710

Do not permanently replace source currency with PHP.

---

# 21. Wishlist

Wishlist should remain simple.

Each item can show:

- card
- market reference
- update date
- Add to Cart

---

# 22. Shopping Cart

The cart represents cards the user is considering buying.

It is not an e-commerce system.

Each cart item should support:

- card
- quantity
- market reference unit price
- seller/store price
- reference total
- seller total
- difference

The cart must work offline.

---

# 23. Purchase Completion

After purchasing:

    [Add Purchased Cards to Binder]

Selecting this should increase the collection quantity.

The cart item may then be removed or marked purchased.

---

# 24. Scanner

Scanning is not a V1 blocker.

The application should support a future ScannerProvider:

```javascript
scanner.identify(image)
```

Expected workflow:

    Scan Card
        ↓
    Identify
        ↓
    Candidate matches
        ↓
    Confirm
        ↓
    Binder

Scanner may require internet.

Manual addition must always remain available.

---

# 25. Offline Requirements

Must work offline:

- open application
- view binder
- search cached cards
- add/remove cards
- change quantities
- wishlist
- shopping cart
- seller-price calculations
- collection value
- cached market prices
- cached card details

May require internet:

- refresh prices
- retrieve uncached cards
- update card catalog
- online scanner

Offline mode must never destroy local data.

---

# 26. PWA

Implement:

- Web App Manifest
- Service Worker
- Offline application-shell caching
- Installable PWA

IndexedDB stores user/application data.

---

# 27. Home Screen

Keep the home screen simple.

Suggested information:

- unique cards
- total physical cards
- estimated/reference collection value
- Search
- Scan
- Binder
- Wishlist
- Cart
- Duplicates

Do not turn the home screen into a complex analytics dashboard.

---

# 28. Navigation

Mobile:

    Home
    Binder
    Search
    Wishlist
    Cart

Scanner can be a prominent action.

Desktop may use a sidebar/navigation layout.

---

# 29. UI/UX Direction

UI/UX is a later phase.

Target feeling:

    Pokémon TCG
        +
    Physical Binder
        +
    Simple Collection Companion

Visual ideas:

- 9-pocket binder layouts
- card-shaped components
- subtle depth
- set badges
- rarity badges
- Pokémon-inspired colors
- playful but readable typography
- subtle transitions
- card-focused detail pages

Avoid:

- spreadsheet-like appearance
- enterprise dashboards
- inventory-management aesthetic

Do not directly copy official Pokémon UI, artwork, logos, or proprietary assets.

Use original visual styling inspired by the physical TCG experience.

---

# 30. V1 Feature Scope

Required:

- Pokémon card catalog
- Search
- Manual card addition
- Binder
- Quantity management
- Card detail
- Wishlist
- Virtual shopping cart
- Seller price comparison
- Collection value
- Cached market references
- Offline collection
- PWA
- Pricing provider abstraction
- Pricing methodology
- Last-updated indicator
- Stale/offline indicator

---

# 31. V1.1

Potential:

- card scanner
- improved duplicate handling
- set completion
- bulk card adding
- better price history

---

# 32. V2

Potential:

- trade binder
- purchase history
- condition tracking
- purchase cost
- profit/loss tracking
- Philippine market reference
- additional TCGs
- cloud backup
- synchronization
- accounts

---

# 33. Explicitly Out of Scope

Do NOT build:

- marketplace
- social network
- user-to-user trading
- messaging
- payments
- subscriptions
- advertisements
- grading marketplace
- seller accounts
- complicated analytics
- investment portfolio functionality
- unnecessary authentication
- unnecessary admin dashboards

---

# 34. Provider Abstraction

UI components must not contain provider-specific API calls.

Bad:

```javascript
fetch("https://some-provider.com/api/card")
```

inside a UI component.

Preferred:

```javascript
const prices = await pricingService.getPrice(card);
```

Provider implementation belongs in the service layer.

---

# 35. Error Handling

If one pricing provider fails, other providers should still be usable.

If all providers fail, continue displaying cached prices.

If no cached price exists:

    Price unavailable

Never block binder, collection, search, wishlist, or cart because pricing APIs are unavailable.

---

# 36. Security

Never commit API keys.

Repository should contain:

    .env.example
    .gitignore

If an API key must remain secret, it must not be embedded in a public static frontend.

Use a free serverless proxy only when necessary and permitted by the provider.

---

# 37. Documentation

README should document:

- project purpose
- problem being solved
- features
- architecture
- local-first design
- pricing methodology
- provider adapters
- offline behavior
- setup
- environment variables
- limitations
- API/provider requirements
- licensing considerations

---

# 38. Product Philosophy

This application is intentionally small.

Do not turn it into Collectr.

Do not turn it into an e-commerce platform.

Do not turn it into a social network.

Do not turn it into an investment tracker.

The goal is:

> A simple digital Pokémon binder that makes collecting, checking ownership, checking market references, and shopping easier.
