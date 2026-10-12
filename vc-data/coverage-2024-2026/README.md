# AI and Physical AI deal database: 2024–2026 coverage update

Snapshot `ai-deals-coverage-442701c0d55527e04f40` covers October 1, 2024 through October 11, 2026. It contains 5,059 retained event records, including financing, acquisition and valuation observations, and 5,618 source observations. All 2,921 original event IDs are preserved; 2,138 records were added and 502 existing canonical records were revised.

Research status is **OPEN**. This release fills public-source gaps and documents the remaining uncertainty. It does not certify a complete worldwide market denominator or provide trend analysis.

| Period | Inclusive coverage |
| --- | --- |
| Prior comparison year | October 1, 2024–September 30, 2025 |
| Recent comparison year | October 1, 2025–September 30, 2026 |
| October update | October 1–11, 2026 |

From a clone of the repository, create the portable database with:

```sh
python3 vc-data/coverage-2024-2026/load_snapshot.py --output ai_deals_2024_2026_public.sqlite
```

The Python standard-library loader verifies every listed hash, file size, row count and snapshot ID before writing SQLite. Download every part listed in [manifest.json](manifest.json); GitHub previews show only part of large datasets. JSON is typed; CSV uses `\N` for null and preserves empty strings separately. Existing output files are protected by default.

| Dataset or file | Purpose |
| --- | --- |
| `events_all`, `observations_all` | Full retained corpus and recoverable original assertions; records include context and unconfirmed items. |
| `credible_financing_disclosures` | Supported financing with a public source URL, a safely assigned comparison period and qualified amounts. Excludes talks, rumors, cumulative funding, targets and explicitly suppressed duplicates. |
| `financing_episodes` | Links repeated closings and financing components into documented episodes; `member_event_ids` and `financing_types` make the grouping inspectable. |
| `comparison_core_equity`, `comparison_core_equity_cutoff` | Narrow uniform equity subsets across both years, using the same source, timing, composition and cutoff rules. They do not establish market completeness. |
| `completion_reviews`, `completion_event_lineage`, `completion_duplicate_decisions` | Source decisions, original IDs, changed records and explicit duplicate suppression. |
| `completion_round_components`, `completion_financial_claims` | Incremental amounts, disclosed totals and commitments that must not be added twice. |
| `discovery_review_queue` | Claimed amounts, dates, subsectors, source links and decisions for discovery leads. Unverified claims are separate from countable financing. |
| [coverage_audit.json](coverage_audit.json) | 352 subsector/period cells, source coverage, boundary uncertainty and open claims. |
| [source_sweeps.json](source_sweeps.json) | Source families, search coverage and decision counts. |
| [methodology.md](methodology.md) | Evidence, dates, amount interpretation and limits. |
| [validation_receipt.json](validation_receipt.json), [public_validation_receipt.json](public_validation_receipt.json) | Canonical integrity/semantics checks and public JSON/CSV/SQLite checks. |
| [AUDITOR_PROMPT.txt](AUDITOR_PROMPT.txt) | Independent omission and verification checks. |

Use `financing_episodes` to inspect financing activity, then its linked disclosures to choose the relevant financing types and amounts. A package may include credit capacity; a reported commitment is not evidence that all cash was drawn. Bounds, missing amounts, combined rounds and unallocated participation remain explicit. Missing is never zero.

The 61 saved framework categories are retained in [taxonomy_crosswalk.json](taxonomy_crosswalk.json). The current public taxonomy has 32 broader subsectors. Finer classifications are preserved when available and remain incomplete for newly discovered companies; the 32-sector audit does not certify coverage of all 61 categories.

Older compatibility views and helper tables retain their previous memberships or review scopes while exposing current canonical values. Use the new comparison views and coverage audit for the expanded periods. Counts of held and pending leads include duplicates, non-AI businesses, funds, awards, small rounds and unresolved timing; they are not counts of missing deals.

No private mail identifiers, links, subjects, bodies, raw source-cache text or raw research assertion/review payloads are exported. Public financial facts, publisher/date metadata and opaque source IDs are retained. The manifest's database digest identifies the local research master; the separately reconstructed public SQLite digest appears in the public validation receipt.

Tech.eu Funding Explorer records are attributed under [CC BY 4.0](https://funding.tech.eu/api-docs). Record-specific source links remain attached to the corresponding deals. Sources can share the same original press release, so source counts do not prove independent corroboration or completeness.

To rerun the portable checks from a clone, use `python3 vc-data/coverage-2024-2026/validate_release.py`. The amount-completeness label refers to the disclosures included in each episode; other reported package totals and uncertainty remain in the linked financial-claims table.
