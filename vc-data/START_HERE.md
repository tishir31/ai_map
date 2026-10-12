# AI and physical AI deals — public research snapshot

Snapshot: `ai-vc-2026-0929ca943255500a9f5f`. Worldwide announcements from 2026-01-01 through 2026-10-11.

This corpus contains 2,973 retained event observations and 2,921 canonical event records. It also retains registry-only companies, directory estimates and unresolved leads. It is a researched database, not a census of worldwide deals.

Download all parts listed in `manifest.json` before reviewing. Each dataset is available as matching JSON and CSV chunks; never inspect only the first part or GitHub preview. IDs must always be cited together with this snapshot ID.

To create a portable sanitized SQLite database locally, run `python load_snapshot.py --output ai_vc_2026_public.sqlite` from the cloned `vc-data` folder. The standard-library loader verifies every listed file hash and JSON/CSV row count before creating the database. It preserves nulls and numeric types, stores arrays as JSON text, and protects existing outputs unless `--force` is explicitly supplied.

Begin with `methodology.md`, `data_dictionary.md`, `coverage_review_protocol.txt` and `AUDITOR_PROMPT.txt`. For omission checks, read `observations_all`, `events_all`, `aliases`, `company_coverage`, `company_history_reviews` and `unresolved_leads`. `display_deals` applies the size cutoff; it is not the full database. `core_equity_all` is the stricter equity-counting view.

`equity_round_announcements` also includes supported announcements with unknown funded cash or mixed composition; use it for announcement coverage, not a cash total. `reviewed_event_relationships` records explicit distinctions that prevent different rounds or non-additive package components being merged. `public_market_context_facts` retains IPO, listed-placement and trading facts separately from private VC funding. `country_availability_metrics` distinguishes missing country labels from known multiple headquarters and single-country ISO labels.

Read [EXTERNAL_AUDIT_RESPONSE.json](EXTERNAL_AUDIT_RESPONSE.json) and the matching `external_audit_response` dataset for an outcome on each finding in the prior external audit. Prior IDs belong to the separately named audited snapshot; use the crosswalk and preferred linked IDs for this snapshot.

Private email identifiers, email URLs, subjects, message text and raw source payloads are excluded. Newsletter evidence is represented by publisher, date and opaque source ID; an auditor should seek independent public corroboration.

Return proposed changes using `auditor_findings.schema.json`, referencing matching event IDs and the snapshot. Do not modify the canonical snapshot. File SHA-256 hashes and row counts are in the manifest; every chunk is below one megabyte.
