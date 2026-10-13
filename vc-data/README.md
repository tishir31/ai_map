# AI / Physical AI financing database

The [current release](coverage-2024-2026/README.md) retains **5,809 event records** across October 2024–September 2025, October 2025–September 2026, and the October 1–11, 2026 update.

The [October 13 sweep](coverage-2024-2026/COVERAGE_SWEEP_2026_10_13.json) reviewed all 21 claims and completed 183 category-period searches. It adds **68 framework financing disclosures** and repairs sources for **6 existing framework disclosures**. **20 claims remain unverified.**

[Inspect the single CSV](coverage-2024-2026/inspection/ai_financing_deals.csv): **3,628 source-supported financing disclosures**, with sources, dates, amounts, categories and explicit scope flags. A disclosure row is not always a distinct priced deal. Unknowns remain blank.

Use [LATEST.json](LATEST.json) for the current manifest and [methodology](coverage-2024-2026/methodology.md) for evidence limits. Historical [30-claim](coverage-2024-2026/RESIDUAL_CLAIMS_2026_10_12.json), [82-claim](coverage-2024-2026/CLAIMS_FOLLOWUP_2026_10_12.json), [731-claim](coverage-2024-2026/QUEUE_RESOLUTION_2026_10_12.json) and [independent-audit](coverage-2024-2026/AUDIT_RESPONSE_2026_10_12.json) decisions remain auditable.

```sh
python3 coverage-2024-2026/validate_release.py
python3 coverage-2024-2026/load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

Market recall remains unmeasured. **No trend analysis is included.** The earlier January–October 2026 root snapshot remains available for reproducibility; use `coverage-2024-2026` for current work.
