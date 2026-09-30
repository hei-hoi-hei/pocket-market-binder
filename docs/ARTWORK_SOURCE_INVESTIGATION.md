# Bounded Artwork Source Investigation

**Investigation date:** 2026-09-28  
**Scope:** TCGdex identities `30th-c-001` through `30th-c-030` only.  
**Purpose:** Record evidence for a future artwork source-selection decision. This is not an artwork license determination and does not approve a provider.

## Decision baseline

TCGdex is the current configured catalog source used for this bounded investigation, not the application's permanent identity authority. Its English set record contains 30 entries with local identifiers `001`–`030`, but reports `official: 0`. Therefore each row below is **listed by TCGdex**, not independently confirmed as an official physical printing. No image from another source is treated as the same printing based on name or visual resemblance alone.

The eventual problem is multi-source:

```text
Canonical Card Identity
    → Candidate Artwork Sources
    → Same-Printing Verification
    → Artwork/Usage Eligibility
    → Source Selection
    → UI
```

Eligibility comes before quality. A candidate must first have a defensible exact-printing mapping, an available image, and sufficiently clear permission/terms for the intended display. Only then compare observable crop/orientation, readability, resolution, URL stability, and known quality problems. Keep provenance and evidence with the selected candidate. Do not use a numeric score or choose an unverified visually similar printing.

## Source evidence

Statuses in the per-card matrix:

- **Confirmed** means the source record and image are tied to the exact printing using set/printing and card-number evidence. None of the investigated secondary candidates met this bar.
- **Ambiguous** means there is some indication of a candidate, but exact printing cannot be established. All 30 TCGdex catalog entries exist, but the set reports `official: 0`; physical/official printing status is therefore unverified. No secondary image candidate surfaced.
- **Unavailable** means no source record/image was obtainable or found for that exact identity during this bounded check. It does not prove no such image exists.
- **Eligibility** is separate from same-printing status. Where there is no candidate image, that candidate is **not eligible for selection**. Scrydex requires authorized access and source-specific artwork permission clarification before eligibility can be assessed. A public URL, API response, marketplace display, or database license alone does not establish artwork-use permission.

| Source | Exact-printing mapping and image findings | Access / observable quality | Artwork-use evidence and conclusion |
|---|---|---|---|
| **TCGdex (canonical baseline)** | [Set record](https://api.tcgdex.net/v2/en/sets/30th-c) lists the exact local IDs/names and reports `official: 0`. [Detail `30th-c-001`](https://api.tcgdex.net/v2/en/cards/30th-c-001) and [detail `30th-c-008`](https://api.tcgdex.net/v2/en/cards/30th-c-008) have no image field. The detail records for all 30 have no image URL. Probes of the constructed path `https://assets.tcgdex.net/en/me/30th-c/{localId}/high.webp` returned HTTP 404 for all 30; this is a constructed probe, not a URL supplied by the records. | Public JSON endpoints were reachable without authentication. No image was available to inspect for this set; resolution/crop cannot be assessed. The same path convention returns working images for sampled control cards, but that does not create the missing artwork. | The [card database repository](https://github.com/tcgdex/cards-database) has an MIT license; that applies to the repository's licensed material and does not establish reuse rights for underlying Pokémon card artwork. No image-specific grant was identified. Canonical catalog baseline only; no artwork candidate for this affected set. |
| **Pokémon TCG API / legacy data** | Exact query [`set.id:30th-c`](https://api.pokemontcg.io/v2/cards?q=set.id%3A30th-c) returned zero results. Thus no exact source printing or image was available to compare. A match on card name would not establish same printing. | API documentation describes unauthenticated and keyed rate limits; no `30th-c` asset or image quality could be observed. The project has announced a **2027-03-01** shutdown/deprecation. | No artwork-use permission for a candidate image was established. API availability is not an artwork license. Not eligible for this sample. |
| **Scrydex** | The current [Pokémon API reference](https://scrydex.com/docs/pokemon/api-reference) documents language-specific data and fields including printed numbers, which could aid a future mapping. The tested expansion/card lookups were authentication-gated (401); no exact `30th-c` record, candidate image, or quality was verified. | Requires `X-Api-Key` and `X-Team-ID` in its documented request. Applicable plan, image coverage, and rate/cost for this use were not established by this investigation. | [Terms](https://scrydex.com/terms) say third-party content remains owned by its licensors and grant no rights by implication; they also restrict redistribution/wholesale uses. No applicable card-art display permission was identified. Needs authorized source data and explicit rights clarification before reconsideration. |
| **Limitless TCG** | Tested [`/cards/30th-c`](https://limitlesstcg.com/cards/30th-c) returned 404. No exact record-to-image mapping was established. Its coverage description does not establish a matching 30th-c printing. | Public pages were accessible, but no exact image or resolution was observable; no applicable public image API or rate terms were established. | No image-specific artwork license was identified in its [legal information](https://limitlesstcg.com/legal) or [about/credits](https://limitlesstcg.com/about). Not eligible on current evidence. |
| **Official Pokémon sources** | The [official Japanese card-search interface](https://www.pokemon-card.com/card-search/?keyword=30th-c) was reachable, but did not expose a verifiable exact printing list in the accessible result. Pokémon.com pages tested were blocked. No exact official card/image mapping was confirmed. | No usable official image URL, dimensions, or quality was observed for the sample. No image endpoint/service guarantees were established. | Official hosting does not itself grant reuse rights. No applicable image-use grant was verified. No candidate is eligible on current evidence. |
| **TCGplayer and Cardmarket** | The tested [TCGplayer search](https://www.tcgplayer.com/search/pokemon/product?q=30th%20Classic%20Collection&view=grid) showed no exact product record/image. The equivalent [Cardmarket search](https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=30th%20Classic%20Collection) returned 403. No exact same-printing listing or image was verified. | No candidate image or resolution could be assessed. Applicable image API, rate, and cost terms were not established. | Marketplace display is not permission to reuse an image. No listing-specific artwork-use right was verified. Not eligible on current evidence. |

### Per-identity source matrix

For every row, the TCGdex record has the exact catalog ID and local number, but physical/official printing status is **ambiguous/unverified** because the set record reports `official: 0`. Every secondary-source mapping/image result is **unavailable** in this bounded investigation: no exact candidate image was confirmed. Consequently, there are no eligible secondary candidates for any row. Scrydex specifically remains **needs clarification** because the unauthenticated inspection was blocked and use terms for card art were not established. Source-specific evidence is detailed above. `Unavailable` is not a global assertion that a source has no such data.

| TCGdex ID | TCGdex-listed canonical identity | TCGdex image | Pokémon TCG API | Scrydex | Limitless | Official Pokémon | TCGplayer / Cardmarket | Best eligible candidate |
|---|---|---|---|---|---|---|---|---|
| `30th-c-001` | Charizard; set `30th-c`; local `001` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-002` | Delcatty; set `30th-c`; local `002` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-003` | Metagross; set `30th-c`; local `003` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-004` | Genesect EX; set `30th-c`; local `004` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-005` | Misty; set `30th-c`; local `005` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-006` | Dark Tyranitar; set `30th-c`; local `006` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-007` | Sneasel; set `30th-c`; local `007` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-008` | Pikachu & Zekrom GX; set `30th-c`; local `008` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-009` | Greninja BREAK; set `30th-c`; local `009` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; no eligible candidate |
| `30th-c-010` | Uxie; set `30th-c`; local `010` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-011` | Crobat G; set `30th-c`; local `011` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-012` | Raikou; set `30th-c`; local `012` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-013` | Buzzwole GX; set `30th-c`; local `013` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-014` | Pikachu; set `30th-c`; local `014` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-015` | Erika's Jigglypuff; set `30th-c`; local `015` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-016` | Rayquaza EX; set `30th-c`; local `016` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-017` | Solgaleo GX; set `30th-c`; local `017` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-018` | Gengar; set `30th-c`; local `018` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-019` | Darkrai & Cresselia LEGEND; set `30th-c`; local `019` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; half/art identity unresolved |
| `30th-c-020` | Darkrai & Cresselia LEGEND; set `30th-c`; local `020` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None; half/art identity unresolved |
| `30th-c-021` | N; set `30th-c`; local `021` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-022` | Palkia; set `30th-c`; local `022` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-023` | M Gardevoir EX; set `30th-c`; local `023` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-024` | Shining Celebi; set `30th-c`; local `024` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-025` | Scizor ex; set `30th-c`; local `025` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-026` | Mew VMAX; set `30th-c`; local `026` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-027` | Arceus VSTAR; set `30th-c`; local `027` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-028` | Zacian V; set `30th-c`; local `028` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-029` | Lugia; set `30th-c`; local `029` | Unavailable; no field | Unavailable; no exact set result | Unavailable; auth-gated | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |
| `30th-c-030` | Magikarp; set `30th-c`; local `030` | Unavailable; no field | Unavailable; no exact set result | Auth-gated; unavailable | Unavailable; no exact record | Unavailable; no exact match verified | Unavailable; no exact listing | None |

For the current sample, there are **no confirmed secondary mappings, no ambiguous secondary image candidates to compare, and no selected or eligible secondary artwork**. Image quality for these candidate sources is therefore unobservable. Do not substitute older card art based on a matching name.

## Future architecture proposal (not implemented)

The current TCGdex display is an explicit compatibility case: its artwork is associated with the requested TCGdex catalog record, its usage eligibility remains unresolved, and display is preserved without a rights determination. This exception does not establish a general policy for future providers.

Keep the existing artwork-specific provider boundary separate from catalog providers. A future provider should accept canonical identity and quality/context and return zero or more candidates carrying source identity, the matched set/printing/local number and variant, image URL, observable dimensions/format, mapping evidence, rights/usage basis, and any source caveat. The resolver should:

1. reject candidates without adequate exact-printing evidence;
2. select candidates with explicit eligible usage; allow unresolved usage only when the provider has an explicit compatibility configuration; always reject explicitly ineligible usage;
3. among candidates allowed by both gates, compare observable quality/stability using auditable deterministic rules;
4. return the chosen URL with source, mapping evidence, and usage/provenance record, or an explicit unavailable result.

No new provider should be integrated until a source can support exact mapping and its image-use terms are sufficiently clear. Never let artwork sources replace TCGdex canonical identity.

## Investigation references

- [TCGdex English set record](https://api.tcgdex.net/v2/en/sets/30th-c)
- [TCGdex card `30th-c-001`](https://api.tcgdex.net/v2/en/cards/30th-c-001)
- [TCGdex card `30th-c-008`](https://api.tcgdex.net/v2/en/cards/30th-c-008)
- [TCGdex API FAQ](https://tcgdex.dev/faq) and [asset URL guide](https://tcgdex.dev/assets)
- [TCGdex cards database and MIT license](https://github.com/tcgdex/cards-database)
- [Pokémon TCG API exact-set query](https://api.pokemontcg.io/v2/cards?q=set.id%3A30th-c), [search docs](https://docs.pokemontcg.io/api-reference/cards/search-cards/), [rate limits](https://docs.pokemontcg.io/getting-started/rate-limits/), and [deprecation notice](https://github.com/PokemonTCG/pokemon-tcg-data)
- [Scrydex Pokémon API reference](https://scrydex.com/docs/pokemon/api-reference), [pricing](https://scrydex.com/pricing), and [terms](https://scrydex.com/terms)
- [Limitless test path](https://limitlesstcg.com/cards/30th-c), [about/credits](https://limitlesstcg.com/about), and [legal information](https://limitlesstcg.com/legal)
- [Official Japanese Pokémon card search](https://www.pokemon-card.com/card-search/?keyword=30th-c)
- [TCGplayer search](https://www.tcgplayer.com/search/pokemon/product?q=30th%20Classic%20Collection&view=grid) and [Cardmarket search](https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=30th%20Classic%20Collection)
