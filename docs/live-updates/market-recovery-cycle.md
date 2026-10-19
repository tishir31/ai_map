# Explicit public-market catch-up

The ordinary daily dispatcher is intentionally idempotent. Rerunning a completed day returns its frozen selection, including pre-release source failures. It cannot verify a new collector release or drain an already-full daily review budget.

An owner-created recovery batch provides a separate, bounded audit namespace. It freezes at most eight public queries and 32 source items, then at most 200 public pending candidates. The shared collector and transaction reviewer run on the deployment; the existing independent SQL source/issuer/date/money/exclusion gates still decide publication. Daily selections, task history and budgets are preserved. Recovery has separate daily caps of16feed and64item attempts,200review tasks and400review attempts. Each task has at most two attempts and one live lease. Provider429 cooldown applies to the recovery collection too.

Only the database owner creates a batch with begin_market_recovery_batch and dispatches it with private.dispatch_market_recovery. The fixed /api/market-recovery route requires the existing Vault-resolved market-review-daily job/date HMAC and accepts only a saved batch ID. It exposes counts without task inputs, source captures or mailbox metadata. Recovery tables and RPCs are RLS-protected and unavailable to browser roles. No scheduler credential is returned to the operator.

Review freezes public-only candidate snapshots. Private/mailbox candidates and exclusions are omitted. Historical or unresolved items receive a retained held disposition with a reason; they are not silently deleted or published. Held records require source research or corrected input before requeueing. Published and verified duplicates use the same atomic publication and duplicate gates as daily review.

Tests cover actual routed authorization, invalid evidence rollback, source-gated/idempotent publication, frozen selection, leases, private exclusion, dispositions, independent daily history/budgets and browser-role ACLs.
