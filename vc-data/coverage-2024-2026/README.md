# AI / Physical AI financing coverage database

Current snapshot: `ai-deals-coverage-a101d6ec0385b334e0f9`. [October 13 coverage sweep and limits](COVERAGE_SWEEP_2026_10_13.json).

All **21 carried-forward claims** were reassessed: **1 corroborated seed disclosure**, **20 remain unverified**. The sweep completed **61 categories × 3 periods = 183 targeted public searches**, with source checks and explicit limits in `subsector_period_source_checks`.

This pass adds **68 source-supported period financing disclosures to the fixed framework** and recovers **6 existing framework disclosures** through source repairs. It adds **77 retained event records** in total, including excluded or period-unallocated context. Those records are not all new priced deals. Seven existing issuer classifications were repaired, with duplicate and round-component decisions retained separately.

The database retains **5,809 event records**, **7,068 observations** and **5,024 issuer registry IDs**. All **5,732 predecessor event IDs, 6,965 observation values and 4,963 company IDs** survive. Historical audit decisions remain in their original review tables and receipts.

There are **3,628 supported period financing disclosures** and **3,598 linked episodes**. The framework has **3,457 disclosures**, **3,429 episodes**, and **1,440 records** in its narrower core-equity cutoff view. These are coverage inventories; no growth rates, rankings or trend conclusions are calculated.

## Inspect the CSV

[Download the single inspection CSV](inspection/ai_financing_deals.csv): **3,628 rows**, sorted by subsector, period, date and company. It includes company, fine subsector, period, date precision and bounds, reported amounts and currency, qualifiers, valuation, framework inclusion, evidence notes, source URLs and record IDs. Unknown amounts remain blank. Filter `in_61_category_framework` to `yes` for the scoped view; use `financing_episode_id` to see linked components. A disclosure row is not always a distinct priced round.

The [inspection receipt](inspection/inspection_receipt.json) identifies the snapshot, row count and file checksum. This convenience CSV is larger than the individual manifest chunks; it is checked separately against canonical values. The manifest's machine-readable CSV chunks use `\N` for nulls, while the inspection CSV uses blank fields.

Coverage spans **October 2024–September 2025**, **October 2025–September 2026**, and **October 1–11, 2026**. A cell without verified observations is not a measured market zero. Search date filters are not authoritative financing dates. Broad-parent hold/claim counts repeat across siblings and must not be summed.

**20 claims remain quarantined**, with **0 unresolved source-supported period-financing classification holds**. Resolved exclusions, unallocated regulatory offerings, combined historical rounds and year-only observations retain explicit scopes. Older source-rule classifications are identified separately; `reviewed_framework_financing_disclosures` contains **2,696** individually reviewed scope disclosures.

```sh
python3 validate_release.py
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

Manifest JSON/CSV parts preserve nulls and types and are at most 250,000 bytes. Private raw assertions, research caches, local SQLite files and source payloads are excluded. See [methodology](methodology.md), [coverage audit](coverage_audit.json), [current decisions](COVERAGE_SWEEP_2026_10_13.json), and [auditor prompt](AUDITOR_PROMPT.txt).

Market recall remains unmeasured; no independent comprehensive commercial export was available. Research remains **OPEN**. **No trend analysis or heat map is included.**
