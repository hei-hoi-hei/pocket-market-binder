# Pocket Market Binder

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Pocket Market Binder is an offline-first, expandable trading-card collection and virtual-binder platform. Pokémon TCG serves as the initial reference catalog, but the core platform architecture is designed to be game-agnostic and easily forkable to support other trading card games, additional catalog sources, and price providers.

---

## Key Features in V1.0.0

- **Digital Virtual Binder & Collection Management:** Full CRUD management for owned cards, duplicate tracking, wishlist, and shopping/acquisition cart with native IndexedDB persistence.
- **TCGdex Reference Catalog:** Comprehensive Pokémon TCG catalog search, set filtering, high-resolution artwork resolution, and offline catalog caching.
- **Pocket Market Reference Pricing Engine:** Standardized `v1-median` consolidation engine that aggregates multi-source price observations, filters statistical outliers, normalizes currencies, calculates multi-factor confidence, and isolates market observations from user purchase prices.
- **Card Identification & Verification:** Modular card identification pipeline designed for clue extraction, candidate ranking, and evidence-backed verification mapping directly to canonical card identities.
- **Collection Statistics:** Instant summary metrics covering unique cards, total card count, rarity breakdowns, wishlist totals, and reference collection valuations without speculative analytics.
- **Offline-First PWA:** Responsive mobile-first design with desktop breakpoints, service worker shell caching, and isolated IndexedDB storage keys.
- **₱0 Operating Cost Architecture:** Operates entirely client-side without mandatory backends or client-exposed API secrets.

---

## V1 Scope & Deferred Features

### Included in V1.0.0:
- Complete offline-first collection, binder, wishlist, and cart workflows.
- Pokémon TCG canonical catalog integration via public TCGdex API.
- Consolidated market reference pricing engine with isolated caching.
- Card identification and canonical identity verification flows.
- MIT-licensed open-source codebase.

### Explicitly Deferred (Post-V1 Milestones):
- **Google Account & Cloud Synchronization:** Cloud-backed cross-device state synchronization.
- **Authenticated Pricing Provider Integrations:** Direct or server-proxied connections to paid/authenticated pricing APIs (`JustTCG`, `PkmnPrices`, `Scrydex`, `TickerMint` remain safe stubs).
- **Secondary TCG Catalogs:** Expansion to Magic: The Gathering, Yu-Gi-Oh!, or custom card games.
- **Marketplace Purchasing & Social Features:** Direct buying/selling or social collection sharing.

---

## Data Provenance & Licensing

### Source Code
The core source code of Pocket Market Binder is licensed under the [MIT License](LICENSE).

### Third-Party Data, APIs & Trademarks Notice
- **Catalog & Metadata:** Card metadata and catalog structures are queried from the [TCGdex API](https://tcgdex.net/) and are subject to their respective terms.
- **Pricing Data:** Price observations are aggregated from public provider endpoints or cached references according to their respective policies.
- **Card Images & Artwork:** Card illustrations, scans, and assets remain the property of their original creators and respective publishers.
- **Trademarks & Intellectual Property:** Pokémon, Pokémon character names, card designs, logos, and energy symbols are trademarks of Nintendo, Creatures Inc., GAME FREAK inc., and The Pokémon Company. Pocket Market Binder is an independent open-source project and is not affiliated with, endorsed by, or sponsored by any of these entities.

For detailed documentation on external data sources and provider adapters, see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

---

## Quick Start & Development

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```

### Running Tests & Typecheck
```bash
npm test
npm run typecheck
npm run build
```

---

## Documentation
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Data Sources & Providers](docs/DATA_SOURCES.md)
- [Architectural Decisions](docs/DECISIONS.md)
- [Project Context](docs/PROJECT_CONTEXT.md)
- [Release Notes](docs/RELEASE_NOTES.md)
