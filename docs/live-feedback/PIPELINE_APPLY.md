# Pipeline implementation and operational apply order

18 September 2026. Prepared locally; no remote mutation, publication, job trigger or deployment performed.

## Verified operational cause

Read-only Supabase aggregates show 250 pending candidates: 149 Gmail, 95 articles, five press releases and one company blog. The oldest pending public-source item was created May 14; newest unreviewed public-source event date September 15. Last approved activity time September 5; newest approved event September 1. All latest six daily runs are partial.

The private scheduler dispatcher acknowledges any HTTP 2xx as succeeded. Collectors previously returned HTTP 200 when a time/item budget stopped the run, so later scheduled probes were acknowledged without retrying. The implementation returns HTTP 503 for scheduled partials and persists a service-only checkpoint. Before processing, the checkpoint freezes the bounded selected RSS records or Gmail IDs, source metadata and date window. A retry uses that exact selection even if the provider feed changes, and skips completed source windows and processed item IDs; failed run telemetry persists a failed checkpoint so a later retry repairs the missing run record; final counters accumulate across attempts rather than overwriting the first attempt. Manual partial checks retain HTTP 200 with explicit partial/retryable status.

The five newest public-source pending candidates all retain Google News RSS redirect URLs, reported confidence and unresolved cautions. A high extraction score does not clear canonical public evidence, identity, date or funding review. These candidates were not approved.

## Reviewable code contract

- Health exposes only safe aggregates and sanitized per-source status, requested/processed counters and reason codes. Query text, Gmail IDs and cursor contents never leave server health.
- Global queue age/totals are distinct from browser research work. A capped 1000-item read is explicitly a lower bound; missing server data stays unknown.
- Publication timestamp is computed from the same public-safe approved projection as market-snapshot; newest event date is a separate measure. Partial source/graph checks and publication delay degrade health.
- New `/api/graph-refresh-daily` is multiplexed through pipeline-health, preserving the function count. It checks at most 30 existing official verified/publication/repository sources, makes no discovery search, and permits at most eight identities. Existing exact quote, public source, identity, date, privacy and policy-mode gates remain in force.
- Weekly broader source/search refresh stays intact. The registry records attempts and cooldowns: failed retryable sources wait one day; other failures wait seven days between batches. Existing within-batch three-attempt retries remain. Deferred/unselected URLs remain explicitly incomplete coverage; later batches prioritize oldest attempted sources.
- Already finalized partial batches are immutable. Continuation uses a new batch against the active immutable head and the durable source registry, preserving the original partial record and avoiding stale-base publication.

## Apply order after reviewed preview and explicit production authorization

1. Generate a migration using the installed Supabase CLI (`supabase migration new pipeline_telemetry`); copy `pipeline-telemetry.sql` into the generated file. The cached CLI in this machine failed even on `migration new --help`, so no migration filename or remote history was invented.
2. Review/apply telemetry SQL before deploying collector code: scheduled collectors fail closed if their service-only checkpoint table cannot be read. Verify RLS enabled, and no anon/authenticated grants on collector_checkpoints. Test counters and RPCs locally; run Supabase security advisors before production application. No SECURITY DEFINER was introduced.
3. Deploy the exact reviewed API/frontend candidate. Replay health, empty personal/nonempty global queue, source-check statuses, public market counts/dates and owner review using the preview. Never trigger production jobs from preview verification.
4. Generate a separate migration (`supabase migration new pipeline_daily_scheduler`) and copy `pipeline-scheduler.sql`. Apply only once the new authenticated route exists. This adds daily 15:00 UTC source checks on days other than Monday, and routes two-minute resume calls according to the batch's actual cadence. Monday retains the comprehensive weekly batch. Existing daily market schedules remain unchanged. Daily graph dispatch uses the same 30-minute retry probe window and three-attempt cap; successful 202 worker dispatch is continued by the existing two-minute task resumer.
5. Do not reset successful historical scheduler dispatches or blanket approve the existing queue. To exercise a collector checkpoint, use an authorized fresh scoped run/date and verify partial → checkpoint → next attempt → completed → no-op rerun. The dispatcher still caps attempts at three, so an exhausted partial remains visible until the next daily selected window; this is bounded recovery rather than an unlimited mailbox sweep.
6. Two concrete public-only reviewed recovery drafts are prepared in `public-recovery-payload.json`, with primary-source notes in `PUBLIC_RECOVERY_EVIDENCE.md`. They remain unapplied. Recover recent market events through approved analyst review: resolve each Google redirect to a retrievable publisher/official reference, verify company identity and event date, corroborate funding specifics, dedupe existing activity, then approve only a qualifying row. Trace candidate → source → activity → approved_at → market-snapshot → UI. Rerun must preserve one canonical row. No new collector extraction is automatically treated as an approved market event.

## Verification performed

Frontend: sharedDatabase and IngestionHealth/ReviewQueue focused suites (11 tests), typecheck, focused eslint. Server: RSS and Gmail collector retry simulations (partial 503, frozen selected items despite a changed provider feed, skips already processed items, completes next attempt, completed rerun no-op, telemetry failure remains retryable), health actual handler response/public projection/privacy and aggregates/degradation, daily source cap/no-search/cooldown/continuation, ingestion auth/adjudication, market snapshot privacy and ecosystem evidence/publication/privacy suites. `git diff --check` passed.

Reviewed recovery payload validation confirms two privacy-safe target rows, deterministic identities and latest event September 15; actual application and idempotency verification remain required.

Both SQL operational artifacts executed successfully in isolated local PGlite with fixtures for hosted extensions, Vault, pg_net and Cron. Regression checks preserve existing weekly run identity and budgets, bound genuinely new daily runs, enforce private checkpoint/RPC grants, and exercise daily dispatcher acknowledgement. This verifies SQL syntax and the tested contracts; hosted extension behavior, real cron activation and concurrent hosted execution remain unverified. Hosted preview replay, migration/advisor checks, an actual recent market publication and a post-activation scheduler run remain required operational acceptance checks.
