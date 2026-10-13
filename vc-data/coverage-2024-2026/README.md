# AI / Physical AI financing coverage database

Current snapshot: `ai-deals-coverage-8ec6fb9ff49089dc3bf3`. [Latest 30-claim review and limits](RESIDUAL_CLAIMS_2026_10_12.json).

All **30 residual claims** were individually reassessed: **9 corroborated or reconciled**, **21 remain unverified**. Both Monarrch and ListenOwl classification holds are assigned. ListenOwl's current-product identity is an explicitly documented inference from founder and investor sources.

This pass adds **7 source-supported financing disclosures to the fixed 61-category framework**, plus other financing and backing context. **21 retained records** were added in total; those records are not all new priced deals. Year-only backing, disputed financing years, unallocated participation, fixed-taxonomy exclusions and public-listing financings retain separate scopes.

The database retains **5,732 event records**, **6,965 observations** and **4,963 issuer registry IDs**. All **5,711 predecessor event IDs, 6,938 observation values and 4,950 company IDs** survive. Historical audit decisions are preserved in their original review tables and separate receipts.

There are **3,547 supported period financing disclosures** and **3,520 linked episodes**. The fixed framework has **3,383 disclosures**, **3,358 episodes**, and **1,427** records in its narrower core-equity cutoff view. Use `framework_financing_disclosures` and its evidence limits for scoped financing, `framework_financing_episodes` for linked observations, and `reviewed_framework_financing_disclosures` to omit older source-rule classifications.

Coverage spans **October 2024–September 2025**, **October 2025–September 2026**, and **October 1–11, 2026**. All 61 categories × 3 periods have coverage receipts. A cell with no verified observations is not a measured market zero. Broad-parent hold/claim counts repeat across sibling categories and must not be summed. Market recall remains unmeasured.

**21 financing claims remain quarantined**; the current period-financing classification hold register has **0 unresolved records**. There are **134** separate resolved non-AI, fixed-taxonomy or allocation exclusions. Neither completed review nor passing validation certifies worldwide completeness.

```sh
python3 validate_release.py
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

JSON and CSV preserve values, nulls and types. Parts are at most 250,000 bytes. Private raw assertions, research caches, local database files and source payloads are excluded.

Read [methodology](methodology.md), [coverage audit](coverage_audit.json), [current decisions](RESIDUAL_CLAIMS_2026_10_12.json), [historical 82-claim follow-up](CLAIMS_FOLLOWUP_2026_10_12.json), [historical 731-claim review](QUEUE_RESOLUTION_2026_10_12.json), [audit response](AUDIT_RESPONSE_2026_10_12.json) and [auditor prompt](AUDITOR_PROMPT.txt). Research remains **OPEN**. **No trend analysis, heat map, sector ranking or investment recommendation is included.**
