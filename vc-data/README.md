# AI / Physical AI financing database

Current snapshot: `ai-deals-coverage-f306b86a0dee4b8c561e`. The [bounded coverage assessment](coverage-2024-2026/HEATMAP_READINESS.md) is **complete**.

**Verdict: ready with specific exclusions. The full 61-subsector heat map is not ready.** Seven subsectors meet the frozen coverage standard in both comparison periods: Defense autonomy; Healthcare AI; Humanoids and general robot platforms; Industrial manipulation and manufacturing; Robot foundation models; Life sciences and discovery AI; Warehouse and logistics robotics. The other 54 are excluded from comparisons; use the [exact readiness cells](coverage-2024-2026/inspection/bounded_readiness_cells.csv) to see why.

Added **225 framework financing disclosures**, recovered **29 existing ones**, and completed all **623 reference dispositions**, **60 quality checks** and **183 cell assessments**. All **618 eligible references** are now captured. This is reference-set capture, not measured worldwide recall. The database has **3,710 framework disclosures** and **3,679 linked episodes**.

[Inspect the main CSV](coverage-2024-2026/inspection/ai_financing_deals.csv): **3,880 supported financing disclosures**, with source links, amounts, precision, categories and scope flags. Filter `in_61_category_framework` to `yes`; use `financing_episode_id` for linked records. Unknown amounts remain blank. A row is not always a separate priced round.

Coverage: October 2024–September 2025; October 2025–September 2026; and October 1–11, 2026. October is a display update. Excluded or empty cells are not zero-activity findings.

[Readiness verdict and exclusions](coverage-2024-2026/HEATMAP_READINESS.md) · [Assessment receipt](coverage-2024-2026/BOUNDED_COVERAGE_ASSESSMENT_2026_10_13.json) · [Frozen standard](coverage-2024-2026/BOUNDED_COMPLETION_STANDARD.md) · [Methodology](coverage-2024-2026/methodology.md) · [Auditor prompt](coverage-2024-2026/AUDITOR_PROMPT.txt)

```sh
python3 coverage-2024-2026/validate_release.py
python3 coverage-2024-2026/load_snapshot.py --output /tmp/ai_deals_coverage.sqlite
```

JSON/CSV manifest datasets preserve types, nulls and provenance. Public SQLite is reconstructed from those files. Private research caches and raw assertions are excluded. Historical review tables remain auditable. No trend analysis is included.
