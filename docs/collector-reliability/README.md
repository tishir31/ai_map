# Public web collection recovery

This change repairs the public web collection control plane. It does not alter Gmail payloads, approve review-queue items, publish activities, or reset a historical run.

## Observed production failure

The read-only production snapshot on 2026-09-18 showed `run-web-scheduled-2026-09-18` as `partial` with five deduplicated items, two enriched items, three rejected items, and no saved stop reason or processed/requested counters. The corresponding scheduler dispatch returned HTTP 200 and was recorded as succeeded. No collector checkpoint exists for that run, so its exact selected feed items cannot be reconstructed safely. Earlier web and Gmail rows have the same pre-telemetry pattern.

At the same snapshot, 248 queue records were pending: 88 public-source records and 160 private-source records. Event dates put 246 records more than seven days old. These are backlog facts, not evidence that the records are publication-ready.

The legacy run remains visible as `historical-checkpoint-missing`. The new acquisition function will not recreate or overwrite it.

## Recovery contract

Each UTC day freezes at most eight configured Google News RSS queries and at most four items per query. A request leases one task for 90 seconds and performs at most one feed fetch or one article/model attempt. Only one task in a run can hold an active lease. Each task gets two attempts with a five-minute delay after an error.

Attempts consume the ledger for the UTC day in which they actually execute. The hard limits are 16 feed attempts and 64 item attempts per UTC day. With 32 frozen items and two attempts each, model work cannot exceed 64 calls per day. The bounded path uses one already-configured model provider and never falls back to a second provider. Old runs resume their exact frozen inputs and consume the current day's budget. An exhausted task becomes terminal, so one failed run cannot retain an active lease indefinitely.

A feed is complete only when the HTTP response is a structurally complete RSS/channel document. HTML challenges and truncated XML are retryable `source-response` errors; a well-formed empty RSS feed is a legitimate zero-result check. Source, provider, storage, daily-budget, and attempts-exhausted stops remain explicit in service-only task history and safe run telemetry.

Article URLs continue through the existing public-URL, DNS/IP, redirect, response-size, and timeout gates. The frozen article capture and its hash stay service-only. Dedupe context excludes Gmail/private evidence, unsafe public rows, active exclusions, and sample data. Automatic suppression requires one unique exact registry company name and the same canonical URL. Similar names and cross-URL financing similarities remain pending for review.

RSS publication dates are not inferred when absent. The collector still fetches an unknown-date item because an official article can contain the actual in-window event date; the deterministic/model gate must establish that date before staging. This costs one bounded item attempt and avoids converting an absent feed timestamp into a false current date.

Staging a candidate, recording the task disposition, updating counters, and mirroring `ingestion_runs` telemetry occur in one database transaction. A telemetry failure rolls all of them back. Model enriched, rejected, and failed attempt counts come from the durable private attempt history.

The existing two-minute continuation function invokes web recovery in an isolated exception block before the existing market-review and graph resumptions. Web failure cannot block those lanes. Existing four daily launch probes remain unchanged; no new cron job or Vercel function is added.

## Health fields

`webCollection` reports scheduler configuration, overdue state only during 13:25–17:00 UTC, an explicit legacy-unrecoverable marker, and nullable counters for legacy rows. Missing telemetry never becomes zero.

`backlogTriage` partitions pending rows into public, private, and unknown-source buckets. Each public/private bucket is partitioned again into recent, old, and unknown/future event-date counts. `missingCanonical` means the row lacks an HTTP(S) source URL; `unresolvedAggregator` separately counts Google News URLs. Caution, linked-existing, and selectable counts overlap the source partitions. Its policy string is `source buckets partition pending; reason counts overlap; no candidate status changed`.

These aggregates describe the pending queue only. They do not claim lifecycle conservation across previously published, rejected, held, or deleted records. Old pending items stay visible and unchanged; this collector does not silently publish or discard them.

## Release order

1. Apply `schema.sql` as one reviewed migration. Confirm the three tables have RLS enabled and only `service_role` can execute the six RPCs.
2. Deploy the compatible backend. Verify an anonymous call to the daily endpoint remains unauthorized and `pipeline-health` returns nullable collection/backlog fields without private inputs.
3. Apply `scheduler.sql`. It replaces the existing shared resumer and adds the service-only fixed-boolean scheduler-status RPC. It does not expose cron commands or Vault secrets.
4. Dispatch one ordinary signed daily request or wait for the next configured probe. Confirm a single leased task, actual-day budget increment, and a `running`, `partial`, or `completed` result with an explicit reason when incomplete.

If backend verification fails before scheduler activation, redeploy the prior backend and leave the new tables unused. If activation fails, restore `private.resume_physical_ai_ecosystem()` from the previously applied pipeline scheduler migration before dropping the new status/resumer functions. Do not drop tables while a run is active. After a prior backend is live and no run is active, the new functions and tables can be removed in reverse dependency order. None of these rollback steps should reset `ingestion_runs`, queue rows, or daily-review state.

The SQL files are reviewable migration templates and have not been applied by this change. The executable PGlite suite covers frozen selection, active-lease serialization, retry/day rollover, hard budgets, transactional telemetry/staging, exclusion-aware dedupe context, backlog partitions, RLS, scheduler status, and isolated continuation.
