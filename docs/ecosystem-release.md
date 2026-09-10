# Ecosystem publication backend

The weekly graph route now fetches public sources and executes grounded searches. The monthly and quarterly legacy routes retain their existing staging behaviour. Daily news approval is unchanged.

## Release

1. Apply `supabase/migrations/20260910065510_physical_ai_ecosystem_v3.sql`. It adds service-only tables/RPCs and a two-minute resume job; the existing Monday 15:00 UTC job still starts weekly work. It defaults policy v3 to `shadow`.
2. Deploy code and the reviewed `physical-ai/ecosystem.v1.json`, core and research runtime assets.
3. Run `node scripts/bootstrap-ecosystem.js --sql-out /private/tmp/ecosystem-bootstrap.sql` to validate and prepare a transactional public-data bootstrap. Execute the generated SQL through the approved database connector. Alternatively, with server environment credentials available, run with `--publish`. Neither default validation nor `--sql-out` contacts the database. Existing baseline version must be preserved for rollback.
4. Inspect an actual shadow batch: `ecosystem_runs` contains completion status; `ecosystem_tasks` contains fetched captures, parser/model outputs, held reasons and retry outcomes. `ecosystem_snapshot_releases` holds the resulting non-public shadow release. Public API version reads deliberately exclude shadow releases.
5. After checking shadow evidence and regression tests, enable `update public.ecosystem_settings set mode='auto' where id;`. This affects new batches; a batch retains the mode it started with. Never relabel an unfinished shadow batch as published.

`GEMINI_API_KEY` uses the already configured server provider. Optional `ECOSYSTEM_GEMINI_MODEL` defaults to `gemini-2.5-flash`. Source requests use the existing SSRF-protected public-page reader. Missing credentials and HTTP errors are real failed/held outcomes, never mock results.

## Publication and evidence

Public `/api/graph-snapshot` returns a complete active manifest. Versioned core/research/discovery requests return exact persisted UTF-8 JSON and SHA256 digests. Old public versions remain readable. Shadow versions are not public. The database blocks mutation of saved shard contents and manifest contents. Snapshot activation is one transaction, requires a current publication lease and an unchanged baseline, and preserves the previous active version if validation fails.

Both the browser and publisher use generated copies of the same strict shape/reference validator. Regenerate with `PHYSICAL_AI_SOURCE_ROOT=/path/to/source node scripts/build-ecosystem-validator.js`; `--check` detects drift. `lib/graph-runtime.mjs` is the matching source runtime encoder/decoder, with its public-output checks.

Automatic relationship publication requires an exact captured quote, a pair-specific supported sentence, a reviewed exact source/identifier, resolved endpoint identities, appropriate endpoint kinds, no negation or uncertainty, and dates directly attached to that same relation. A project supervisor is separate from a PhD adviser. Company/investor statements remain attributed claims and retain plans as plans. Public verbatim claim text is capped at 25 words per source across each complete release, including existing claims. Longer or additional excerpts are held individually. Source excerpts are omitted when claims already consume that source’s quotation allowance, and change summaries do not repeat claim quotations. Full captured evidence remains server-only.

The citation parser additionally accepts explicit citation metadata with a paper's canonical URL/title and each author's resolved stable profile URL or ORCID. A plain arXiv author name does not establish identity and stays held. Arbitrary repository README text cannot assert founder, mentor or employment connections. New canonical repository identifiers can establish project identity, not person/company identity.

Community membership follows accepted links to existing community nodes. Unconnected discoveries remain research gaps; area search results do not fabricate membership. New connected people and works receive partial profiles with explicit unknowns.

## Recovery and monitoring

Tasks have 85-second leases, at most two workers globally, three attempts, five-minute retry cooldown and frozen initial queues. The resume scheduler authenticates using today's scoped HMAC while the worker resumes the original persisted batch date. Fetch budgets count actual attempts; unprocessed sources remain a visible backlog. A source disappearing never creates a departure/closure claim.

`/api/pipeline-health` exposes only aggregate ecosystem run state, counters, last public update and delayed areas. It exposes no task captures, model output or review records. Public dataset counts describe mapped evidence rather than complete market coverage.

To roll back data, atomically clear `active` and activate a previous `is_public=true` release in a transaction. Immutable snapshot content remains unchanged. Set mode `disabled` to prevent new work, and unschedule `physical-ai-ecosystem-resume` if suspending all retries. Existing daily news jobs are separate.

## Checks

- `node scripts/test-ecosystem.js`: pair-specific gates, all supported predicates, date/identity/authority failures, structured author metadata, captured/unchanged/404 paths, snapshot hashes, strict shape validation, same-version public dossier and partial coverage.
- `ECOSYSTEM_PGLITE_PATH=/path/to/@electric-sql/pglite node scripts/test-ecosystem-sql.js`: migration in isolated PostgreSQL, legacy partial-index lock, frozen queue, day rollover, two-worker limit, stale leases, retry cooldown/exhaustion, identity budgets, shadow privacy, immutable/atomic publication and ACL/RLS. Hosted Cron/net/Vault functions are stubbed only at the external extension boundary; live scheduler dispatch must also be inspected after release.
- `node scripts/test-graph-api.js`, `node scripts/test-physical-ai-router.js`, `node scripts/test-scheduler-auth.js`, and `node --test tests/*.test.cjs` preserve existing public/private route and request contracts.
