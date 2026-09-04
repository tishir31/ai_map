# AI Map Changelog

## 2026-09-04: Vault-only Physical AI scheduler

- Added asynchronous scheduler authentication that resolves the generated
  Supabase Vault credential through a `service_role`-only RPC.
- Production fails closed when Vault/RPC is unavailable or an optional explicit
  override conflicts; native `CRON_SECRET` fallback is limited to non-production.
- Kept exact scheduler version, job, and deterministic job/date run-key checks,
  and removed native Vercel cron definitions to prevent double dispatch.
- Rejected valuation, target, guarantee, contract, award, and facility-size
  amounts from financing proceeds unless the source independently supports the
  exact reported round amount.
- Required deterministic company and activity-type agreement before accepting a
  model-proposed duplicate, and aligned health/readiness counts with the public
  market snapshot projection.
- Kept `knowledge-graph.v1.json` directly retrievable as the one-release
  rollback snapshot instead of routing it through the SPA shell.

## Branch: `feature/gmail-inbox` (based on `main`)

### 2026-02-06: Gmail Newsletter Integration

**New Features:**
- **Inbox tab** in left sidebar (alongside Latest & AI Curated)
  - Loads insights from `newsletter_insights.json`
  - Shows valuation updates section with clickable company tags
  - Insight cards with category badges (Funding/M&A/Product/Market/Analysis)
  - Impact indicators (high/medium/low) via left border color
  - Clickable company tags that open company details on the map

**New File:**
- `newsletter_insights.json` — 32 insights from 25+ newsletters scanned via Gmail MCP server (tishir@umich.edu)

**New Companies Added (8):**
- ElevenLabs ($11B) — Voice AI
- Resolve AI ($1B) — Agentic SRE
- Bedrock Robotics ($1.75B) — Construction automation
- Daytona ($125M) — AI agent sandboxes
- TRM Labs ($1.4B) — Blockchain intelligence
- Adaption Labs ($50M seed) — Continuous learning AI
- Overland AI ($100M+) — Military autonomous vehicles
- Cortical Labs ($35M+) — Biological computing

**Valuation Updates (private companies):**
- xAI: $230B -> $1.25T (merged w/ SpaceX)
- Cerebras: $22B -> $23B
- Waymo: $100B+ -> $126B

**Market Cap Updates (public companies):**
- Google: $2.4T -> $3.83T
- Microsoft: $3.4T -> $3.53T
- Amazon: $2.47T -> $2.5T
- AMD: $423B -> $313B
- Palantir: $423B -> $400B
- Salesforce: $220B -> $184B
- ServiceNow: $135B -> $125B
- Snowflake: $75B -> $65B
- MongoDB: $17B -> $34B
- CrowdStrike: $75B -> $104B

**DATA_VERSION:** 9 -> 10

**No existing features were modified or removed.** All changes are purely additive.

---

## Branch: `fix/security-dom` (based on `main`)

### 2026-02-02: Security Hardening (commit 7a33a1f)
- Renamed CSS class `.star` -> `.favorite-star` to avoid conflicts
- Replaced innerHTML usage with DOM methods in compare table
- Added `escapeHTML()` utility function
- Hardened analytics rendering

---

## Branch: `main` (production — deployed to Vercel)

### Existing Features (stable):
- Interactive AI company map with 200+ companies
- Category/Country/Region/Valuation filters
- AI News (48h) sidebar with RSS feeds
- AI Curated news (Gemini-powered)
- Ask AI company summaries (Gemini-powered)
- Company comparison tool
- Analytics dashboard
- Data explorer/table view
- Export functionality
- Favorites system
- AI on X (Twitter) sidebar
- Keyboard shortcuts
- Admin/Manage panel
- Dark theme with zoom controls
