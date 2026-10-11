# AI and physical AI deals — public research snapshot

Snapshot: `ai-vc-2026-f169451525da440d307e`. Worldwide announcements from 2026-01-01 through 2026-10-11.

This corpus contains 2,877 retained event observations and 2,828 canonical event records. It also retains registry-only companies, directory estimates and unresolved leads. It is a researched database, not a census of worldwide deals.

Download all parts listed in `manifest.json` before reviewing. Each dataset is available as matching JSON and CSV chunks; never inspect only the first part or GitHub preview. IDs must always be cited together with this snapshot ID.

To create a portable sanitized SQLite database locally, run `python load_snapshot.py --output ai_vc_2026_public.sqlite` from the cloned `vc-data` folder. The standard-library loader verifies every listed file hash and JSON/CSV row count before creating the database. It preserves nulls and numeric types, stores arrays as JSON text, and protects existing outputs unless `--force` is explicitly supplied.

Begin with `methodology.md`, `data_dictionary.md`, `coverage_review_protocol.txt` and `AUDITOR_PROMPT.txt`. For omission checks, read `observations_all`, `events_all`, `aliases`, `company_coverage`, `company_history_reviews` and `unresolved_leads`. `display_deals` applies the size cutoff; it is not the full database. `core_equity_all` is the stricter equity-counting view.

Private email identifiers, email URLs, subjects, message text and raw source payloads are excluded. Newsletter evidence is represented by publisher, date and opaque source ID; an auditor should seek independent public corroboration.

Return proposed changes using `auditor_findings.schema.json`, referencing matching event IDs and the snapshot. Do not modify the canonical snapshot. File SHA-256 hashes and row counts are in the manifest; every chunk is below one megabyte.
