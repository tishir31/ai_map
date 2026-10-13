# AI / Physical AI financing database

The [current coverage release](coverage-2024-2026/README.md) retains **5,732 event records** for research across the two comparison periods and the October 1–11, 2026 update. The [latest 30-claim review](coverage-2024-2026/RESIDUAL_CLAIMS_2026_10_12.json) adds **7 financing disclosures to the 61-category framework** and resolves both classification holds. **21 additional-financing claims remain unverified.**

Use [LATEST.json](LATEST.json) to find the current manifest and [methodology](coverage-2024-2026/methodology.md) to understand scopes and evidence limits. [Historical 82-claim decisions](coverage-2024-2026/CLAIMS_FOLLOWUP_2026_10_12.json), [731-claim decisions](coverage-2024-2026/QUEUE_RESOLUTION_2026_10_12.json), and the [independent-audit response](coverage-2024-2026/AUDIT_RESPONSE_2026_10_12.json) remain auditable.

Event records are not a unique-deal count. Market completeness remains unmeasured. **No trend analysis is included.**

```sh
python3 coverage-2024-2026/validate_release.py
python3 coverage-2024-2026/load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

The earlier January–October 2026 snapshot remains in the root data files for reproducibility; its [legacy methodology](methodology.md) and loader remain available. Current work should use `coverage-2024-2026`.
