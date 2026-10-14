# AI and Physical AI financing database

Current snapshot `ai-deals-coverage-f1aefd5696e41b8783b3`. The bounded independent audit is complete and the public release is validated. **A comprehensive heat map is still unsupported by the measured coverage.** See [readiness](coverage-2024-2026/HEATMAP_READINESS.md).

6,093 event records and 7,791 observations are retained. 58 new records were added, and 303 existing records were corrected. H01 contains 2,740 equity episodes; 27 fine subsectors meet the ten-per-period sample-size rule. This is not a completeness claim.

[Inspect financing CSV](coverage-2024-2026/inspection/ai_financing_deals.csv) · [Acquisition CSV](coverage-2024-2026/inspection/acquisition_deals.csv) · [Subsector counts](coverage-2024-2026/inspection/subsector_period_coverage.csv) · [Filled audit reviews and change log](coverage-2024-2026/audit/) · [Numeric checks](coverage-2024-2026/NUMERIC_CHECKS.json) · [Current audit receipt](coverage-2024-2026/audit_release_receipt.json) · [Remaining limits](coverage-2024-2026/UNRESOLVED.json).

Each financing CSV row is one counted equity episode. Unknown amounts are blank. The two 12-month periods are October 2024–September 2025 and October 2025–September 2026; October 1–11, 2026 is display-only. Acquisitions count by announcement and remain split into private-startup, context and license-and-hire buckets. Raw and legacy projections preserve historical claims and must not be counted as authoritative deal lists.

```sh
python3 coverage-2024-2026/validate_release.py
python3 coverage-2024-2026/load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

[Methodology](coverage-2024-2026/methodology.md) · [Current completion standard](coverage-2024-2026/BOUNDED_COMPLETION_STANDARD.md) · [Auditor prompt](coverage-2024-2026/AUDITOR_PROMPT.txt) · [Reproducible predecessor](coverage-2024-2026/history/f306/HISTORY.md).

No trend analysis is included.
