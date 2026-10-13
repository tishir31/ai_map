# AI / Physical AI financing coverage database

Current snapshot: `ai-deals-coverage-9ffd44b864775de2eb32`. [Latest claim-by-claim follow-up](CLAIMS_FOLLOWUP_2026_10_12.json).

All **82 previously unresolved claims** were individually reassessed: **52 resolved or corroborated**, **30 remain unverified**. The three original classification holds now have source-backed assignments. This pass adds **44 supported financing disclosures** plus **3 cumulative or period-unallocated context records**. **35** added disclosures enter the fixed-framework financing view. Disclosures and investor participation are not automatically separate priced rounds.

The database retains **5,711 events**, **6,938 observations**, and **4,950 registry issuer IDs**. All 5,664 predecessor event IDs, all 6,877 observation values and all 4,916 company IDs are preserved. Historical findings, duplicates, exclusions, commitments and source assertions remain auditable.

There are **3,530 source-supported period financing disclosures** and **3,505 linked episodes**. The 61-category framework has **3,374 disclosures**, **3,349 episodes**, and **1,427** records in its narrower core-equity cutoff view. Unknown valuations do not become zero or below-cutoff determinations.

Coverage spans **October 2024–September 2025**, **October 2025–September 2026**, and **October 1–11, 2026**. All 61 categories × 3 periods have coverage receipts. No verified records in a cell is an evidence gap, not a measured market zero. Broad-parent hold/claim counts repeat across sibling categories and must not be summed.

**30 financing claims remain quarantined** and **2 newly retained financing records have unresolved operating-product classification**: Monarrch and ListenOwl. They remain visible and are excluded from category totals. The three original holds—ARfuture, Offset Labs and Double Blind Bio—are resolved. Offset's audio/speech assignment is an inference from its published model catalogue, which also includes text models; the evidence does not certify historical revenue mix. There are **129** separate resolved non-AI, fixed-taxonomy or joint-allocation exclusions.

Use `framework_financing_disclosures` for scoped reported financing, `framework_financing_episodes` for linked observations, and `reviewed_framework_financing_disclosures` to omit older source-rule classifications. `framework_core_equity_cutoff` is more conservative. Native currency, current-round amounts, ranges, cumulative totals, offering amounts sold, investment participation and undisclosed values retain their different meanings and evidence limits.

```sh
python3 validate_release.py
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

JSON and CSV preserve values, nulls and types. Data parts are at most 250,000 bytes. Private raw assertions, research caches, source payloads and local database files are excluded.

Read [methodology](methodology.md), [coverage audit](coverage_audit.json), [latest follow-up](CLAIMS_FOLLOWUP_2026_10_12.json), [historical 731-claim review](QUEUE_RESOLUTION_2026_10_12.json), [earlier audit response](AUDIT_RESPONSE_2026_10_12.json) and [auditor prompt](AUDITOR_PROMPT.txt). Public-source market recall remains unmeasured and coverage research remains **OPEN**. Validation establishes consistency and preservation, not worldwide completeness. **No trends, heat maps, sector rankings or investment recommendations are included.**
