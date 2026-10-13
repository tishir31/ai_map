# AI / Physical AI financing coverage database

Snapshot: `ai-deals-coverage-48c97d7d968118d8f6a2`. Coverage: October 1, 2024–October 11, 2026. The two comparison periods are October 2024–September 2025 and October 2025–September 2026, followed by the October 1–11 update.

This continuation adds **46 verified financing disclosures**, reconciles **3 more duplicate relationships**, separates or reconciles **12 issuer identities**, and assigns fine categories to **1,865 previously unassigned records**. It preserves all 5,117 predecessor event IDs and all 5,793 predecessor observation values. The earlier 67-finding Claude audit remains available as [finding-by-finding history](AUDIT_RESPONSE_2026_10_12.json); [this coverage receipt](COVERAGE_COMPLETION_2026_10_12.json) describes the new pass.

There are **5,163 retained event records** and **5,864 observations**. Retained records include duplicate announcements, commitments, rumors, context and uncertain timing; they are not a unique-deal count. The broad financial-source cohort contains 2,992 supported disclosures and 2,970 linked episodes. The scoped 61-category cohort contains **2,638 disclosures** and **2,616 episodes**. These are evidence cohorts, not a worldwide market denominator.

Every registry issuer now has an explicit classification or scope decision, and every event has an issuer/category provenance row. 4,200 retained records carry a fine category; 963 retain an explicit unknown. The original 61 category definitions are preserved in `finer_taxonomy`. `framework_coverage_cells` audits all **61 categories × 3 periods**, with reviewed assignments, source-rule assignments, cutoff observations and unresolved broad-parent claims shown separately. A cell with no verified records is an evidence gap, not a market zero. Broad-parent hold/lead counts repeat across sibling fine categories and must not be added together.

Start with `framework_financing_disclosures` and `framework_financing_episodes` for source-supported private-company financing with an established framework fit. Use `reviewed_framework_financing_disclosures` to exclude automatic source-text assignments. `framework_core_equity_cutoff` is a narrower, evidence-clean equity cohort; it is not the total market. `business_classification_reviews` records the method, business rationale, public links, available source-body hashes and review timing. Company-wide categories describe the cited business; current product pages are not proof of an exact historical pivot date.

**Classification is still held for 347 otherwise source-supported financial disclosures**, including known framework exclusions. Consult `classification_hold_register` before treating those records as AI sector activity. There are also **731 unreconciled discovery claims** in `discovery_review_queue`; these include duplicates, ordinary non-AI issuers and uncertain claims, and are not a count of missing deals. A fine category retained from an earlier framework is not sufficient for inclusion when `business_scope` is held. Rule-supported assignments are explicitly provisional relative to individually reviewed business decisions.

The broad `credible_financing_disclosures` / `financing_episodes` projections retain financial facts even when AI/framework scope is unresolved. `events_all` is the retained register; `observations_all` preserves original assertions, including superseded ones. The `comparison_core_equity` datasets and legacy helper datasets remain available for compatibility; use the scoped framework projections for eventual subsector work. Cash, package estimates, commitments, cumulative totals and note conversions are explicitly distinguished where material. Native currency errors and reused domains do not create new rounds.

Reconstruct and check the public database with standard Python:

```sh
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
python3 validate_release.py
```

Matching JSON/CSV chunks are listed and hashed in `manifest.json`; CSV nulls are `\N`, and typed JSON is the reconstruction authority. No raw assertions, private research payloads, source-page bodies or local database binary are published. Tech.eu Funding Explorer data is attributed under CC BY 4.0; record-specific links are retained.

Read [methodology](methodology.md), [coverage audit](coverage_audit.json), [source sweep decisions](source_sweeps.json), and [auditor prompt](AUDITOR_PROMPT.txt). Research remains **OPEN**. Internal validation establishes consistency and preservation, while independent omission detection and public-source recall remain unfinished. No trends, heat scores or investment recommendations have been calculated.
