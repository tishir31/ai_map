# AI and Physical AI financing database

Current snapshot `ai-deals-coverage-f1aefd5696e41b8783b3`. The bounded independent audit is complete and the public release is validated. **A comprehensive heat map is still unsupported by the measured coverage.** See [readiness](HEATMAP_READINESS.md).

6,093 event records and 7,791 observations are retained. 58 new records were added, and 303 existing records were corrected. H01 contains 2,740 equity episodes; 27 fine subsectors meet the ten-per-period sample-size rule. This is not a completeness claim.

[Inspect financing CSV](inspection/ai_financing_deals.csv) · [Acquisition CSV](inspection/acquisition_deals.csv) · [Subsector counts](inspection/subsector_period_coverage.csv) · [Filled audit reviews and change log](audit/) · [Numeric checks](NUMERIC_CHECKS.json) · [Current audit receipt](audit_release_receipt.json) · [Remaining limits](UNRESOLVED.json).

Each financing CSV row is one counted equity episode. Unknown amounts are blank. The two 12-month periods are October 2024–September 2025 and October 2025–September 2026; October 1–11, 2026 is display-only. Acquisitions count by announcement and remain split into private-startup, context and license-and-hire buckets. Raw and legacy projections preserve historical claims and must not be counted as authoritative deal lists.

```sh
python3 validate_release.py
python3 load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

[Methodology](methodology.md) · [Current completion standard](BOUNDED_COMPLETION_STANDARD.md) · [Auditor prompt](AUDITOR_PROMPT.txt) · [Reproducible predecessor](history/f306/HISTORY.md).

No trend analysis is included.
