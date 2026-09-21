# Post-V1 Schema Inventory: Pocket Market Binder V1 Persistence Model

This document provides a factual, read-only inventory of the existing **V1 persistence model and record schemas** for Pocket Market Binder as of version `1.0.0`. It serves as an audit boundary for designing subsequent Post-V1 synchronization and backend capabilities.

---

## 1. Scope

* **Purpose:** Document the exact database structures, keys, record fields, relationships, serialization, identity mechanisms, and deletion behavior implemented in V1.
* **Non-Goal:** This document does **NOT** propose or specify future cloud sync schemas, conflict resolution mechanisms, tombstone structures, revision numbers, or backend data models.
* **Code Modification Status:** Read-only inspection task. No production code or schemas were altered.

---

## 2. Persistence Architecture

Pocket Market Binder uses a **Local-First / Offline-First** client storage architecture.

* **Database Engine:** Native Web IndexedDB API.
* **Database Name:** `pocket-market-binder`
* **Database Version:** `1`
* **Object Store Name:** `kv-store` (Single key-value store containing string keys and structured value objects/arrays).
* **Abstraction Layer:** `IndexedDBStore` implementing `KVStore` interface (`get<T>`, `set<T>`, `remove`) located in `src/services/storage.ts`.
* **Legacy Storage Migration:** On initialization, `storage.ts` checks `localStorage` for legacy keys prefixed with `pmb:` (`pmb:binder`, `pmb:wishlist`, `pmb:cart`). If present, data is migrated into IndexedDB (`kv-store`) under unprefixed keys and purged from `localStorage`.
* **Write Pattern:** Collection stores (`binder`, `wishlist`, `cart`) and catalog cache (`cached_cards_store`) are stored as **complete array blobs**. Operations (add, update, delete) read the full array, mutate in memory, and rewrite the full array under the store key.

---

## 3. Store Inventory

The single object store (`kv-store`) uses prefix-isolated key spaces to separate user-owned state from catalog and pricing caches:

| Key Space / Namespace | Purpose | Owner | Persistent? | User Data? | Candidate for Sync? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `binder` | Core user collection binder entries | `collectionService.ts` | Yes | Yes | **Yes** (Primary user collection state) |
| `wishlist` | User card wishlist entries | `collectionService.ts` | Yes | Yes | **Yes** (Primary user wishlist state) |
| `cart` | Shopping cart / acquisition entries | `collectionService.ts` | Yes | Yes | **Yes** (Primary user acquisition/cart state) |
| `cached_cards_store` | Offline catalog cache of card models | `catalogService.ts` | Yes | No (Derived/Cache) | **No** (Local catalog reference cache) |
| `cached_prices_store:<cardId>` | Consolidated pricing reference per card | `pricingService.ts` | Yes | No (Derived/Cache) | **No** (Local pricing cache) |
| `cached_observations_store:<cardId>` | Raw price observations array per card | `pricingService.ts` | Yes | No (Derived/Cache) | **No** (Local observation cache) |
| `cached_price_verification:<cardId>` | Secondary price verification analysis | `pricingService.ts` | Yes | No (Derived/Cache) | **No** (Local verification cache) |
| `identity_verification:<cardId>` | Identity verification result candidates | `identityService.ts` | Yes | No (Derived/Cache) | **No** (Local verification cache) |

---

## 4. User-Owned Records

### 4.1 Collection Record (`BinderEntry`)

Stored inside the `binder` array key in IndexedDB (`kv-store`).

| Field Name | Type | Required? | Purpose | Derived? | Ref / Stability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cardId` | `string` | Required | TCGdex canonical card identifier (e.g. `"sv3pt5-1"`) | No | References TCGdex Card ID. Stable across devices. |
| `quantity` | `number` | Required | Count of owned cards for this card ID | No | User-entered value (`quantity >= 1`). |
| `addedAt` | `number` | Required | Unix timestamp (ms) when entry was added/created | No | Client local timestamp via `Date.now()`. |

*Note:* No per-record unique UUID exists. Multiple copies of a card are represented via the `quantity` field within a single `BinderEntry` object.

### 4.2 Wishlist Record (`WishlistEntry`)

Stored inside the `wishlist` array key in IndexedDB (`kv-store`).

| Field Name | Type | Required? | Purpose | Derived? | Ref / Stability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cardId` | `string` | Required | TCGdex canonical card identifier (e.g. `"sv3pt5-1"`) | No | References TCGdex Card ID. Stable across devices. |
| `addedAt` | `number` | Required | Unix timestamp (ms) when card was wishlisted | No | Client local timestamp via `Date.now()`. |

### 4.3 Acquisition / Cart Record (`CartEntry`)

Stored inside the `cart` array key in IndexedDB (`kv-store`).

| Field Name | Type | Required? | Purpose | Derived? | Ref / Stability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cardId` | `string` | Required | TCGdex canonical card identifier (e.g. `"sv3pt5-1"`) | No | References TCGdex Card ID. Stable across devices. |
| `quantity` | `number` | Required | Targeted purchase quantity | No | User-entered value (`quantity >= 1`). |
| `sellerPrice` | `number \| null` | Optional | User-entered offer or seller price in USD | No | User metadata. Null if unpriced. |
| `addedAt` | `number` | Required | Unix timestamp (ms) when added to cart | No | Client local timestamp via `Date.now()`. |

---

## 5. Cache / Derived Records

### 5.1 Catalog Card Record (`Card`)

Stored in `cached_cards_store` array.

| Field Name | Type | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Required | Canonical card ID (TCGdex ID) |
| `name` | `string` | Required | Card display name |
| `category` | `'pokemon' \| 'trainer' \| 'energy'` | Required | Card category classification |
| `types` | `string[]` | Optional | Elemental energy types (e.g., `["Fire"]`) |
| `rarity` | `Rarity` | Required | Rarity enum (`common`, `uncommon`, `rare`, `holo`, `ultra`, `secret`, `other`) |
| `setCode` | `string` | Required | Expansion set code (e.g., `"sv3pt5"`) |
| `setName` | `string` | Optional | Set display name (e.g., `"151"`) |
| `setNumber` | `string` | Required | Collector card number within set (e.g., `"1"`) |
| `imageUrlLow` | `string` | Optional | Low-resolution image URL |
| `imageUrlHigh` | `string` | Optional | High-resolution image URL |
| `hp` | `number` | Optional | Hit points |
| `genus` | `string` | Optional | Pokémon species genus |
| `evolvesFrom` | `string \| null` | Optional | Pre-evolution Pokémon name |
| `attacks` | `CardAttack[]` | Optional | Moves / attacks list |
| `flavor` | `string` | Optional | Card lore/flavor text |
| `variants` | `CardVariants` | Optional | Printed variant flags (`normal`, `reverse`, `holo`, `firstEdition`) |
| `artSeed` | `number` | Optional | Seed for procedural fallback artwork |
| `identity` | `CanonicalCardIdentity` | Optional | Provider mapping IDs (`tcgplayer`, `cardmarket`, etc.) |

### 5.2 Pricing Observations (`PriceObservation`)

Keyed as `cached_observations_store:<cardId>`. Value is an array of `PriceObservation`:

| Field Name | Type | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `cardId` | `string` | Required | Canonical card ID |
| `variant` | `CardVariant` | Optional | Variant (`normal`, `reverse`, `holo`, `firstEdition`) |
| `condition` | `CardCondition` | Optional | Condition (`near_mint`, `lightly_played`, etc.) |
| `isGraded` | `boolean` | Optional | Graded indicator |
| `language` | `string` | Optional | Language code |
| `source` | `PricingProviderName` | Required | Provider name (`tickermint`, `pkmnprices`, `justtcg`, `scrydex`, `tcgdex`) |
| `market` | `string` | Required | Marketplace identifier (e.g., `'tcgplayer'`, `'cardmarket'`) |
| `price` | `number` | Required | Observed numeric price |
| `currency` | `string` | Required | Original observation currency (e.g., `'USD'`, `'EUR'`, `'PHP'`) |
| `priceType` | `string` | Required | `'market'` \| `'trend'` \| `'average'` \| `'low'` \| `'high'` |
| `observedAt` | `number` | Required | Timestamp when observed by provider |
| `fetchedAt` | `number` | Required | Timestamp when retrieved by client adapter |
| `metadata` | `Record<string, unknown>` | Optional | Provider-specific context |

### 5.3 Consolidated Price Reference (`PriceReference`)

Keyed as `cached_prices_store:<cardId>`.

| Field Name | Type | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `cardId` | `string` | Required | Canonical card ID |
| `referencePrice` | `number` | Required | Consolidated median price in USD |
| `currency` | `string` | Required | Base reference currency (`'USD'`) |
| `methodologyVersion` | `string` | Required | Calculation methodology (`'v1-median'`) |
| `confidence` | `'high' \| 'medium' \| 'low'` | Required | Consolidation confidence score |
| `sourceCount` | `number` | Required | Count of observation sources used |
| `activeProviders` | `string[]` | Required | List of contributing provider names |
| `activeMarketplaces` | `string[]` | Required | List of contributing marketplace names |
| `updatedAt` | `number` | Required | Calculation timestamp (ms) |
| `analysis` | `PriceAnalysis` | Optional | Material divergence analysis |

---

## 6. Relationships

The records follow a simple reference model centered on the TCGdex canonical card ID:

```text
Canonical TCGdex Card ID (e.g. "sv3pt5-1")
        │
        ├──► BinderEntry (cardId)           [User Owned]
        ├──► WishlistEntry (cardId)         [User Owned]
        ├──► CartEntry (cardId)             [User Owned]
        │
        ├──► Catalog Cache (Card.id)                                    [Local Cache]
        ├──► Price Reference Cache (cached_prices_store:<cardId>)       [Local Cache]
        ├──► Price Observation Cache (cached_observations_store:<cardId>) [Local Cache]
        ├──► Price Verification Cache (cached_price_verification:<cardId>) [Local Cache]
        └──► Identity Verification Cache (identity_verification:<cardId>)  [Local Cache]
```

* **Foreign Keys:** User collection, wishlist, and cart entries reference `cardId`. Catalog and pricing services lookup cards using `cardId`.
* **Denormalization:** No card details (names, set numbers, artwork URLs) are stored inside `BinderEntry`, `WishlistEntry`, or `CartEntry`. They only hold `cardId`, quantities, timestamps, and user seller prices. UI views join `cardId` with `catalogService` dynamically.


---

## 7. Identity Stability

* **Identifier Basis:** All user records (`BinderEntry`, `WishlistEntry`, `CartEntry`) identify target cards using the canonical TCGdex string identifier (`cardId`, e.g., `"sv3pt5-1"` or `"swsh1-1"`).
* **Identity Stability Across Devices:** **Stable.** TCGdex card IDs are standardized string slugs based on set code and set number. They are identical across all client devices and platform instances.
* **Absence of Device-Local Auto-IDs:** V1 does not use auto-increment integers, local database primary keys, or randomly generated UUIDs for user records.
* **Composite Record Identity:** In memory and IndexedDB array storage, a user record's identity within `binder`, `wishlist`, or `cart` is determined by its `cardId`. duplicate entries for the same `cardId` are merged into a single entry with incremented `quantity`.

---

## 8. Deletion Semantics

* **Mechanism:** Hard array filtering and complete key replacement.
* **Binder Deletion:**
  * Setting quantity to `0` or calling `removeFromBinder(cardId)` filters out the entry where `e.cardId === cardId` and calls `storage.set('binder', filteredEntries)`.
* **Wishlist Deletion:**
  * `removeFromWishlist(cardId)` filters out `e.cardId === cardId` and overwrites key `'wishlist'`.
* **Cart Deletion:**
  * `removeFromCart(cardId)` filters out `e.cardId === cardId` and overwrites key `'cart'`.
  * `clearCart()` writes `[]` (empty array) to key `'cart'`.
* **Tombstones:** **None.** Deleted records leave no deletion tombstone, soft-delete flag (`isDeleted`), or deletion timestamp.

---

## 9. Existing Versioning & Timestamps

The following timestamps and versioning fields exist in V1:

### 9.1 User Record Fields
* **`addedAt`** (`number`, ms timestamp): Present on `BinderEntry`, `WishlistEntry`, and `CartEntry`. Generated via `Date.now()` when the card is first added.
* **`updatedAt`**: **Does NOT exist** on user records. When quantity or seller price is updated, `addedAt` remains unchanged and no `updatedAt` field is added.

### 9.2 Cache & External Observation Fields
* **`observedAt`** (`number`, ms timestamp): On `PriceObservation` and `CardVerificationResult`.
* **`fetchedAt`** (`number`, ms timestamp): On `PriceObservation`.
* **`updatedAt`** (`number`, ms timestamp): On `PriceReference` (records calculation time).
* **`verifiedAt`** (`number`, ms timestamp): On `PriceAnalysis` (records verification time).
* **`methodologyVersion`** (`string`): On `PriceReference` (set to `'v1-median'`).


---

## 10. Existing Serialization

* **IndexedDB Structured Clone:** Records are passed as plain JavaScript objects and arrays directly to `store.put(value, key)`. Browsers perform native IndexedDB Structured Clone serialization.
* **JSON Serialization:** `JSON.parse` and `JSON.stringify` are **not** used during normal runtime IndexedDB reads/writes. `JSON.parse` is only used during legacy `localStorage` migration in `storage.ts`.

---

## 11. Existing Export / Import

* **JSON Export / Backup:** None implemented in V1.
* **CSV Export:** None implemented in V1.
* **Import / Restore Utilities:** None implemented in V1.

---

## 12. Synchronization-Relevant Observations

1. **Canonical Keying:** Collection, wishlist, and cart records key directly on TCGdex canonical card IDs (`"sv3pt5-1"`), which are stable across devices.
2. **Missing Update Timestamps:** User records lack `updatedAt` or mutation history fields.
3. **Array Replacements:** Persistence writes replace full arrays (`binder`, `wishlist`, `cart`) rather than updating individual record keys in IndexedDB.
4. **Hard Deletions:** Record removal deletes the item from the array without storing deletion tombstones.
5. **Clear Separation of Data:** User collection data (`binder`, `wishlist`, `cart`) is completely isolated from catalog/pricing cache keys (`cached_cards_store`, `cached_prices_store:*`, `cached_observations_store:*`). Storage errors in pricing cannot mutate user records.

