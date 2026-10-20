# Tyrant public-news handoff

Status: Tyrant has verified its existing Supabase execute_sql access as postgres on the target project. Deployment and a real producer submission are the remaining activation gates.

## Producer operation

If Tyrant has the existing authorized Supabase connector with database-owner `execute_sql` access to project `qwfuphrxvcsumwouirhj`, its public-news task can send a selected public link with this one operation:

```sql
select private.submit_tyrant_public_news(
  p_source_url => 'https://www.tesollo.com/news/press/tesollo-selected-to-lead-rd-project-on-intelligent-robotic-hands-with-on-device-ai'
) as receipt;
```

The canonical URL itself is the deduplication and retry key. The contract has **one argument**; it accepts no headline, summary, chat ID, transcript, email, financial value or company record. Do not send a private ChatGPT/Gmail URL. Strip tracking parameters before submission. A retry of the same URL returns the existing news ID and cannot duplicate a row, republish a withdrawn row, or enqueue unbounded retrievals.

This uses an already privileged connector, if the actual producer has it. No new credentials, browser grants, plugin permission changes, polling, or schedules are created by this implementation. Do not infer Tyrant's connector access from the consumer's access. If its connector cannot execute the owner-only operation, stop and report that exact capability gap; do not give it a service-role credential or broaden the RPC to anonymous callers.

## What becomes public

The selected public URL immediately enters a separate news-links table and the public `/api/market-news` projection. It is attributed to Tyrant and labelled as a source link whose article details are unverified. The signed server worker optionally fetches that public article's own headline. It never receives or copies private producer text. Source retrieval failure keeps an explicitly unverified link visible.

The public response contains only news ID, source URL, shared timestamp, optional public headline, Tyrant attribution and the fixed `financialTotalsEligible:false` label. It excludes internal keys, leases, captures, provider errors, tokens and provenance from private chats. The web page polls this projection every 30 seconds while the Latest updates view is mounted, retains previous rows during failure and signals that fresh delivery is unavailable.

News links never enter `activities`, `companies` or the financing/M&A publication RPCs. The existing independent source, amount, currency, company identity, date and deal-total checks remain unchanged. News link presentation does not claim the linked announcement is true or a verified financing.

## Bounded source scope

The initial allowlist covers the public press/article paths already used for the six imported Tyrant items: PR TIMES, Tesollo, Semafor, Tectonic and GlobeNewswire. It also covers the previously verified Origin and Fugro issuer paths, Business Wire public releases, and the reviewed Elbit Systems and Trimble public newsroom paths. Business Wire returned 403 during the source review; a public link can still be shown with its headline explicitly unavailable. Query strings, fragments, nonstandard origins, private-chat links, local addresses and off-scope redirects are rejected. Extend Robotics is not on this allowlist; do not retry its denied origin.

This is a bounded pilot. Check actual producer links against this scope before activation. Adding another publisher requires an explicit source review and matching SQL/JS validator changes. Limit: 50 new URLs in a rolling 24 hours, two optional headline retrievals per URL, one active lease, and at least two minutes between queued retrieval attempts. A shared timestamp is not asserted to be the event's announcement date.

## Activation and actual-producer verification

1. Verify the producer has the existing authorized database-owner Supabase operation. Private-chat inspection is not needed if the actual producer can submit a selected public URL directly.
2. Deploy the prepared backend routes and frontend; apply the generated schema migration. No code here has been activated merely by creating the source files.
3. Ask the actual producer to run the operation for one selected, supported public URL. Save its receipt and source URL without copying private chat text. An invocation made by the consumer/developer is a test submission, not proof of actual producer delivery.
4. Read back the exact news ID in the database, `/api/market-news` and the rendered From Tyrant section. Re-submit the same URL and confirm one database/API row. Confirm financing/M&A rows and totals are unchanged.
5. Only after that proof, add the one URL-only operation to the existing Tyrant public-news task's final delivery step, preserving its existing schedule and notification preferences. Do not modify unrelated tasks or automations.

The user explicitly authorized inspecting Tyrant and connecting public-link delivery on October 20, 2026. Actual Tyrant verified its existing connector with current_user=postgres; no new connector permission or credential is required. Preserve the existing hourly AI and engineering news task and the incoming-email AI news email alerts task, including their existing cadence and notification preferences. The final task delivery step must submit only selected public AI/Physical AI article URLs, deduplicate them, and report any unsupported source rather than widening the source scope or falling back to private text.
