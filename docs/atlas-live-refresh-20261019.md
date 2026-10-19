# Atlas live refresh repair — 2026-10-19

The scheduler was active while collections and source review failed to publish
newer activity. Newest approved event was October 13; this was not primarily a
client polling failure. The client polls the approved snapshot every 30 seconds.

The collector now reads four allow-listed GlobeNewswire issuer feeds plus four
rotating news-discovery queries, within the existing eight-feed/32-item budget.
This avoids requiring every announcement to survive a Google redirect and a
blocked media page. Preserve official issuer links in captured anchor text and
recognize robotic applications and affirmative secured-financing clauses.
Model-negative qualifying deterministic signals remain private until independent
source review. Never infer equity from cumulative funding, valuations, debt or
proposed rounds. Do not relax issuer, date, amount, currency or source checks.

Migration 20261019214026 replaces three existing source-resolution functions,
with their existing invoker security and grants. It was applied on October 19.
The source-reviewed ZAP Surgical October 19 financing was recovered idempotently
through the existing publication RPC; it is one $36M event, stage unknown, with
Catalio named in the issuer release. Yahoo's explicitly attributed BusinessWire
syndication was read; the direct wire page was not independently fetched.

Validate: test-atlas-live-refresh.cjs; market transactions, review, live update,
ingest adjudication, collection health, and isolated PostgreSQL suites. Check
pipeline health and the latest approved event after release. Direct feeds have
bounded publisher coverage and may yield zero qualifying items. Zero publishing
must remain visible; a heartbeat or completed run must never imply completeness.
