# Live update repair

Public market snapshots and maintenance status refresh every 30 seconds while the page is visible, and on focus and reconnect. Requests bypass browser caches. In-flight refreshes do not overlap; cleanup removes listeners and timers. Public workspace overlays and editor recovery boundaries remain intact.

The public collector tries configured providers with a bounded timeout, disables unnecessary Gemini thinking for JSON triage, and can stage deterministic funding signals during a model outage. Staging does not approve or publish records.

The financing reviewer checks captured official source text without requiring a model for supported announcements. It binds the issuer and current round amount, keeps valuations and cumulative funding separate, uses the actual announcement date rather than the RSS report date, verifies physical application and currency, and preserves explicit source/identity conflicts. It follows at most four official pages. Unknown companies and ambiguous identities remain pending.

Apply `market-refresh.sql` before deploying the backend. It adds private verified aliases and exact primary-source registrations, supports natural financing statements with independent SQL evidence validation, and lets a daily review accept later arrivals within the existing ten-candidate/twenty-attempt budget. Apply `review-resume.sql` after the repaired backend is live to let the existing two-minute resumer pick up new eligible candidates.

Tests: `test-market-live-updates.js`, `test-market-live-sql.js`, existing collector/auth/SQL/public projection suites, and frontend refresh/auth/workspace tests. Source captures and private queue data are never bundled into the public site.
