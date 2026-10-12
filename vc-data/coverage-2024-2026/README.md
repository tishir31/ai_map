# AI / Physical AI financing coverage database

Snapshot: `ai-deals-coverage-e5302dcff6b1b4e58bc8`. Coverage: October 1, 2024 through October 11, 2026. Comparison windows are October 2024–September 2025 and October 2025–September 2026, plus the October 1–11 update.

This release applies verified decisions from all 67 findings in the Claude audit of `ai-deals-coverage-442701c0d55527e04f40`. It adds 58 retained records (56 financing disclosures and 2 licensing/talent context records), reconciles 28 explicit duplicate relationships, corrects material funding/valuation mistakes, and resolves issuer/subsector errors. All 5,059 audited event IDs and all 5,618 prior source observations remain recoverable. See [finding-by-finding decisions](AUDIT_RESPONSE_2026_10_12.json).

There are **5,117 retained event records** and **5,793 observations**. Retained records include duplicates, commitments, context, rumors and uncertain timing; they are not a unique-deal count. The convenience views contain 2,948 supported financing disclosures, 2,928 linked episodes, and 1,430 strict core equity cutoff records. These are evidence cohorts, not completeness estimates.

The 32 broad subsectors and original 61-category framework are both available. `finer_taxonomy`, `company_finer_classifications`, and `event_entity_classifications` record category definitions, issuer links and provenance. Canonical event/company rows now carry finer-category fields. Reviewed business classifications, inherited framework classifications, broad-only mappings and unassigned cases are explicitly distinguished. A broad classification cannot by itself distinguish the multiple fine categories beneath it. Generic data-center developers, utilities and batteries are not automatically classified as AI power/cooling technology. Sales/marketing and maritime classifications use disclosed workflow/model or autonomous-defense business categories when supported; their fine category can remain unassigned.

Use `events_all` for the retained register, `observations_all` for untouched prior assertions, `credible_financing_disclosures` for supported financing facts with uncertainty, and `financing_episodes` for explicit grouping. Use `comparison_core_equity` and its cutoff variant only for the narrow core cohort. Legacy helper datasets preserve earlier membership and are not the comparison authority. Financing scopes distinguish startup/operating-company finance, corporate JV/project commitments, reported initial capitalization, and non-financing context. Date ranges are retrospective financing intervals or conservative season enclosures; their anchor date is not an invented announcement day.

Load all chunks, not only GitHub's first preview:

```sh
python3 vc-data/coverage-2024-2026/load_snapshot.py --directory vc-data/coverage-2024-2026 --output /tmp/ai-deals-public.sqlite
python3 vc-data/coverage-2024-2026/validate_release.py
```

`manifest.json` declares files, SHA-256 hashes, rows and fields. Public exports contain no raw research payloads, source-cache bodies, private mail IDs/links or local paths. CSV nulls use `\N`. Python's standard library is sufficient to reconstruct and validate the public SQLite database.

Read [methodology](methodology.md), [audit response](AUDIT_RESPONSE_2026_10_12.json), [coverage gaps](coverage_audit.json), [source sweep decisions](source_sweeps.json), and [auditor prompt](AUDITOR_PROMPT.txt). Research remains **OPEN**: independent recall, remaining business classifications and discovery claims still require work. No trend analysis, heat scores or investment recommendations have been calculated.
