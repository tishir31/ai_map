# AI / Physical AI financing coverage database

Current snapshot: `ai-deals-coverage-713c08df821e84c5e3ed`. [Queue-resolution receipt](QUEUE_RESOLUTION_2026_10_12.json).

All **731 discovery claims** have individual decisions, and all **320 issuers with prior classification holds** have business-scope reviews. No discovery claims remain unreviewed. This pass adds **495 source-supported financing disclosures** and retains **6 additional context or period-unallocated records**. The record-level [decision ledger](manifest.json) preserves exclusions, proposals, duplicates and unverified claims.

The release contains **5,664 retained events**, **6,877 observations**, and **4,916 registry issuer records**. All 5,163 predecessor events, all 5,864 observation values and all 4,482 company IDs are preserved. Retained events include repeated announcements, commitments, non-financing context and uncertain timing; they are not a unique-deal count.

There are **3,486 supported financing disclosures** and **3,461 linked episodes**. The scoped 61-category cohort contains **3,336 disclosures** and **3,311 episodes**. The original 61 category definitions remain unchanged.

Coverage receipts span **October 2024–September 2025**, **October 2025–September 2026**, and **October 1–11, 2026**. `framework_coverage_cells` covers all 61 categories × 3 periods. No observed records is an evidence gap, not a verified market zero. Broad-parent hold/claim counts repeat across sibling categories and must not be summed.

**82 reviewed claims remain unverified or allocation-held**, and **3 financing disclosures retain unresolved business scope**. These are exposed in `queue_unverified_claims` and `remaining_business_scope_holds`. The separate `resolved_business_scope_exclusions` contains **127** conventional non-AI, fixed-taxonomy-gap or joint-allocation disclosures. A reviewed exclusion differs from an unreviewed company.

Use `framework_financing_disclosures` for scoped reported financing, `framework_financing_episodes` for linked rounds, and `reviewed_framework_financing_disclosures` to exclude older source-rule assignments. `framework_core_equity_cutoff` is a narrower, conservative cash/valuation-cutoff cohort. Missing amounts and valuations remain unknown.

```sh
python3 validate_release.py
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

JSON and CSV chunks match and preserve nulls and types. All data parts are under 250,000 bytes. Raw private assertions, research cache text, source payloads and private database files are excluded.

Read [methodology](methodology.md), [coverage audit](coverage_audit.json), [source decisions](source_sweeps.json), [carried-forward audit decisions](AUDIT_RESPONSE_2026_10_12.json), and [auditor prompt](AUDITOR_PROMPT.txt). Market coverage research remains **OPEN**: public-source recall is unmeasured. Internal validation establishes consistency and preservation, not worldwide completeness. **No trends, heat scores, sector rankings or investment recommendations are included.**
