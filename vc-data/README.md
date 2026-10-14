# AI and Physical AI financing database

The current factual release is identified by [LATEST.json](LATEST.json).

[Inspect all retained records](coverage-2024-2026/inspection/all_deal_records.csv) · [Review the corrections](coverage-2024-2026/audit/change_log.csv) · [Dataset and source policy](coverage-2024-2026/README.md)

The inspection CSV includes the retained financing and acquisition records with sources, verification status, dates, reported amounts, bounds, subsectors and duplicate/component links. Unknown amounts remain blank. The user controls exclusions.

The coverage window is October 2024–September 2025, October 2025–September 2026 and the October 1–11, 2026 update. Relevant outside-window context remains marked by its date. No deal totals, period comparisons, trends, scores or rankings are calculated in this release.

```sh
python3 coverage-2024-2026/validate_release.py
python3 coverage-2024-2026/load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

[Methodology](coverage-2024-2026/methodology.md) · [Auditor prompt](coverage-2024-2026/AUDITOR_PROMPT.txt) · [Reproducible predecessor](coverage-2024-2026/history/f1/HISTORY.md)
