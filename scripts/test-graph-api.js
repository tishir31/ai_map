"use strict";

const assert = require("node:assert/strict");
const graph = require("../lib/graph-api");
const { createScheduledRefreshHandler } = require("../lib/graph-cron-handler");
const weeklyCron = createScheduledRefreshHandler("weekly");
const monthlyCron = createScheduledRefreshHandler("monthly");
const quarterlyCron = createScheduledRefreshHandler("quarterly");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => payload === null ? "" : JSON.stringify(payload),
  };
}

async function run() {
  assert.equal(graph.requiredEntityId("ENT-0868"), "ENT-0868");
  assert.throws(() => graph.requiredEntityId("World Labs"), /stable ENT key/);
  assert.equal(graph.parseHops("99"), 3);
  assert.equal(graph.parseHops("0"), 1);
  assert.equal(graph.parseAsOf("2026-09-04"), "2026-09-04");
  assert.throws(() => graph.parseAsOf("September 4"), /ISO date/);
  assert.equal(graph._test.constantTimeEqual("secret", "secret"), true);
  assert.equal(graph._test.constantTimeEqual("secret", "wrong"), false);
  assert.equal(weeklyCron.cadence, "weekly");
  assert.equal(monthlyCron.cadence, "monthly");
  assert.equal(quarterlyCron.cadence, "quarterly");
  const originalCronSecret = process.env.CRON_SECRET;
  const originalSchedulerSecret = process.env.PHYSICAL_AI_SCHEDULER_SECRET;
  const scopedSchedulerSecret = "0123456789abcdef0123456789abcdef";
  try {
    delete process.env.CRON_SECRET;
    process.env.PHYSICAL_AI_SCHEDULER_SECRET = scopedSchedulerSecret;
    const schedulerAuthorization = graph.verifyCron({ headers: {
      authorization: `Bearer ${scopedSchedulerSecret}`,
      "x-physical-ai-scheduler": "v1",
      "x-physical-ai-job": "graph-refresh-weekly",
      "x-physical-ai-run-key": "graph-refresh-weekly:2026-09-04",
    } }, "graph-refresh-weekly");
    assert.equal(schedulerAuthorization.provider, "supabase-pg-cron");
    assert.equal(schedulerAuthorization.schedulerRunDate, "2026-09-04");
    assert.throws(() => graph.verifyCron({ headers: {
      authorization: `Bearer ${scopedSchedulerSecret}`,
      "x-physical-ai-scheduler": "v1",
      "x-physical-ai-job": "graph-refresh-monthly",
      "x-physical-ai-run-key": "graph-refresh-monthly:2026-09-04",
    } }, "graph-refresh-weekly"), /scheduler credential/i);
  } finally {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalSchedulerSecret === undefined) delete process.env.PHYSICAL_AI_SCHEDULER_SECRET;
    else process.env.PHYSICAL_AI_SCHEDULER_SECRET = originalSchedulerSecret;
  }
  assert.equal(graph._test.userCanReviewCandidate(
    { id: "user-1", appMetadata: {} },
    { owner_id: "user-1" },
  ), true);
  assert.equal(graph._test.userCanReviewCandidate(
    { id: "user-2", appMetadata: {} },
    { owner_id: "user-1" },
  ), false);
  assert.equal(graph._test.userCanReviewCandidate(
    { id: "reviewer", appMetadata: { graph_role: "reviewer" } },
    { owner_id: null },
  ), true);
  assert.deepEqual(graph._test.refreshScopes.weekly.map(([scope]) => scope), [
    "publication_deltas", "company_team_deltas", "repository_deltas", "legal_registry_deltas",
  ]);
  assert.deepEqual(graph._test.refreshScopes.monthly.map(([scope]) => scope), ["lab_rosters", "thesis_repositories"]);
  assert.deepEqual(graph._test.refreshScopes.quarterly.map(([scope]) => scope), ["historical_site_availability"]);

  const relationships = [
    { id: "REL-0001", subject_entity_id: "ENT-0002", object_entity_id: "ENT-0001", predicate: "founded", conclusion_label: "Verified fact" },
    { id: "REL-0002", subject_entity_id: "ENT-0002", object_entity_id: "ENT-0003", predicate: "member_of", conclusion_label: "Verified fact" },
  ];
  const path = graph._test.shortestPath("ENT-0001", "ENT-0003", relationships);
  assert.deepEqual(path.relationshipIds, ["REL-0001", "REL-0002"]);
  assert.equal(path.steps[0].direction, "reverse");
  assert.equal(graph._test.relationshipActiveAt({ started_on: "2025-01-01", ended_on: null }, "2026-01-01"), true);
  assert.equal(graph._test.relationshipActiveAt({ started_on: "2027-01-01", ended_on: null }, "2026-01-01"), false);
  assert.equal(graph._test.relationshipActiveAt({ started_on: "2018-01-01", ended_on: "2020-01-01" }, "2026-01-01"), true);

  const originalFetch = global.fetch;
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") {
      return response({ id: "approved-user", email: "analyst@example.test", app_metadata: {} });
    }
    if (url.pathname.endsWith("/analyst_profiles")) {
      assert.equal(url.searchParams.get("user_id"), "eq.approved-user");
      return response([{ user_id: "approved-user", is_lead: true }]);
    }
    throw new Error(`Unexpected analyst verification path: ${url.pathname}`);
  };
  try {
    const approvedUser = await graph.verifyUser(
      { headers: { authorization: "Bearer user-token" } },
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
    );
    assert.equal(approvedUser.id, "approved-user");
    assert.equal(approvedUser.isLead, true);
  } finally {
    global.fetch = originalFetch;
  }

  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return response({ id: "unapproved-user", app_metadata: {} });
    if (url.pathname.endsWith("/analyst_profiles")) return response([]);
    throw new Error(`Unexpected unapproved-user path: ${url.pathname}`);
  };
  try {
    const publicUser = await graph.verifyUser(
      { headers: { authorization: "Bearer user-token" } },
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
    );
    assert.equal(publicUser, null);
    await assert.rejects(
      graph.verifyUser(
        { headers: { authorization: "Bearer user-token" } },
        { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
        { required: true },
      ),
      (error) => error.status === 403 && /approved analyst directory/i.test(error.message),
    );
  } finally {
    global.fetch = originalFetch;
  }

  let anonymousProfileRead = false;
  global.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") {
      return response({ id: "anonymous-user", is_anonymous: true, app_metadata: {} });
    }
    if (url.pathname.endsWith("/analyst_profiles")) {
      anonymousProfileRead = true;
      return response([{ user_id: "anonymous-user", is_lead: true }]);
    }
    throw new Error(`Unexpected anonymous-user path: ${url.pathname}`);
  };
  try {
    assert.equal(await graph.verifyUser(
      { headers: { authorization: "Bearer anonymous-token" } },
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
    ), null);
    await assert.rejects(
      graph.verifyUser(
        { headers: { authorization: "Bearer anonymous-token" } },
        { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
        { required: true },
      ),
      (error) => error.status === 403 && /anonymous accounts/i.test(error.message),
    );
    assert.equal(anonymousProfileRead, false);
  } finally {
    global.fetch = originalFetch;
  }

  const calls = [];
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    calls.push(url);
    if (table === "graph_entities") {
      if (url.searchParams.get("id") === "eq.ENT-0001") {
        return response([{ id: "ENT-0001", kind: "company", canonical_name: "Pilot Co", publication_status: "published" }]);
      }
      return response([
        { id: "ENT-0001", kind: "company", canonical_name: "Pilot Co", publication_status: "published" },
        { id: "ENT-0002", kind: "person", canonical_name: "Pilot Founder", publication_status: "published" },
        { id: "ENT-0003", kind: "lab", canonical_name: "Pilot Lab", publication_status: "published" },
        { id: "ENT-0004", kind: "paper", canonical_name: "Pilot Paper", publication_status: "published" },
      ]);
    }
    if (table === "graph_current_relationships") return response([
      { ...relationships[0], layer: "company", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
      { ...relationships[1], layer: "institutional", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
      { id: "REL-0003", subject_entity_id: "ENT-0002", object_entity_id: "ENT-0004", predicate: "authored", layer: "research", conclusion_label: "Verified fact", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
    ]);
    if (table === "graph_relationship_evidence") return response([
      { relationship_id: "REL-0001", revision: 1, evidence_id: "EVD-0001" },
    ]);
    if (table === "graph_evidence") return response([
      { id: "EVD-0001", source_id: "SRC-0001", snapshot_id: "SNP-0001", stance: "support", locator: "About", directness: "direct", retrieved_at: "2026-09-04T00:00:00Z" },
    ]);
    if (table === "graph_sources") return response([
      { id: "SRC-0001", canonical_url: "https://example.test/about", title: "About", source_type: "official_company", tier: "primary", accessibility_status: "accessible", last_retrieved_at: "2026-09-04T00:00:00Z" },
    ]);
    if (table === "graph_source_snapshots") return response([
      { id: "SNP-0001", source_id: "SRC-0001", retrieved_at: "2026-09-04T00:00:00Z", content_hash: "a".repeat(64), snapshot_status: "metadata_only" },
    ]);
    if (table === "graph_entity_aliases") return response([
      { entity_id: "ENT-0001", alias: "Pilot Company", alias_type: "name" },
    ]);
    if (table === "graph_external_ids") return response([
      { entity_id: "ENT-0001", provider: "website", external_id: "pilot.test", canonical_url: "https://pilot.test", is_verified: true },
    ]);
    if (["graph_entity_facts", "graph_entity_fact_evidence", "graph_collection_entities", "graph_collections"].includes(table)) return response([]);
    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const dossier = await graph.investigate(
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
      { id: "ENT-0001", hops: 2, asOf: "2026-09-04", user: null },
    );
    assert.equal(dossier.entity.id, "ENT-0001");
    assert.equal(dossier.privateAvailable, false);
    assert.equal(dossier.privateDossier, null);
    assert.deepEqual(dossier.entity.aliases, ["Pilot Company"]);
    assert.equal(dossier.entity.external_ids.website, "https://pilot.test");
    assert.equal(dossier.researchDna[0].entity.id, "ENT-0004");
    assert.equal(dossier.publicEvidenceSummary.conclusionLabel, "Derived signal");
    assert.equal(calls.some((url) => url.pathname.endsWith("graph_entity_signals")), false);
    assert.equal(calls.some((url) => url.pathname.endsWith("graph_review_candidates")), false);
    const relationshipRequest = calls.find((url) => url.pathname.endsWith("graph_current_relationships"));
    assert.equal(relationshipRequest.searchParams.get("conclusion_label"), "eq.Verified fact");
    assert.equal(relationshipRequest.searchParams.get("review_status"), "eq.approved");
  } finally {
    global.fetch = originalFetch;
  }

  const privateCalls = [];
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    privateCalls.push(url);
    if (table === "graph_entities") {
      if (url.searchParams.get("id") === "eq.ENT-0001") {
        return response([{ id: "ENT-0001", kind: "company", canonical_name: "Pilot Co", publication_status: "published" }]);
      }
      return response([
        { id: "ENT-0001", kind: "company", canonical_name: "Pilot Co", publication_status: "published" },
        { id: "ENT-0002", kind: "person", subtype: "PhD student", canonical_name: "Pilot Researcher", publication_status: "published" },
        { id: "ENT-0003", kind: "lab", canonical_name: "Pilot Lab", publication_status: "published" },
        { id: "ENT-0004", kind: "paper", canonical_name: "Recent Pilot Paper", publication_status: "published" },
      ]);
    }
    if (table === "graph_current_relationships") return response([
      { ...relationships[0], layer: "company", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
      { ...relationships[1], layer: "institutional", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
      { id: "REL-0003", subject_entity_id: "ENT-0002", object_entity_id: "ENT-0004", predicate: "authored", layer: "research", conclusion_label: "Verified fact", current_revision: 1, observed_at: "2026-01-01T00:00:00Z" },
    ]);
    if (table === "graph_relationship_evidence") return response([
      { relationship_id: "REL-0001", revision: 1, evidence_id: "EVD-0001" },
      { relationship_id: "REL-0002", revision: 1, evidence_id: "EVD-0002" },
    ]);
    if (table === "graph_author_mentions") return response([{
      id: "PAM-00000001",
      paper_entity_id: "ENT-0004",
      resolved_person_entity_id: "ENT-0002",
      resolution_status: "resolved",
      resolution_method: "exact_external_identifier",
      source_id: "SRC-0003",
      evidence_id: "EVD-0003",
      publication_status: "published",
    }]);
    if (table === "graph_relationships") return response([{
      id: "REL-0003",
      subject_entity_id: "ENT-0002",
      object_entity_id: "ENT-0004",
      predicate: "authored",
      current_revision: 1,
    }]);
    if (table === "graph_relationship_revisions") return response([{
      relationship_id: "REL-0003", revision: 1, started_on: "2026-01-01", conclusion_label: "Verified fact",
    }]);
    if (table === "graph_entity_facts") {
      if (url.searchParams.get("conclusion_label") === "eq.Derived signal") return response([{
        id: "FCT-9001",
        entity_id: "ENT-0001",
        fact_type: "valuation",
        display_value: "Undisclosed",
        disclosure_status: "undisclosed",
        metric_scope: "point_in_time",
        conclusion_label: "Derived signal",
        publication_status: "candidate",
        revision: 1,
      }]);
      if (url.searchParams.get("fact_type") === "eq.published_on") return response([{
        id: "FCT-9002",
        entity_id: "ENT-0004",
        fact_type: "published_on",
        display_value: "2026-01-01",
        as_of_date: "2026-01-01",
        conclusion_label: "Verified fact",
        publication_status: "published",
      }]);
      return response([]);
    }
    if (table === "graph_entity_fact_evidence") {
      return url.searchParams.get("fact_id")?.includes("FCT-9001")
        ? response([{ fact_id: "FCT-9001", evidence_id: "EVD-0004" }])
        : response([]);
    }
    if (table === "graph_evidence") {
      if (url.searchParams.get("is_public") === "eq.true") return response([
        { id: "EVD-0001", source_id: "SRC-0001", snapshot_id: "SNP-0001", stance: "support", retrieved_at: "2026-09-04T00:00:00Z" },
        { id: "EVD-0002", source_id: "SRC-0002", snapshot_id: "SNP-0002", stance: "support", retrieved_at: "2026-09-04T00:00:00Z" },
      ]);
      return response([
        { id: "EVD-0003", source_id: "SRC-0003", snapshot_id: "SNP-0003", stance: "support" },
        { id: "EVD-0004", source_id: "SRC-0004", snapshot_id: "SNP-0004", stance: "context" },
      ]);
    }
    if (table === "graph_sources") {
      if (url.searchParams.get("is_public") === "eq.true") return response([
        { id: "SRC-0001", canonical_url: "https://example.test/about", title: "About", source_type: "official_company", tier: "primary", accessibility_status: "accessible" },
        { id: "SRC-0002", canonical_url: "https://example.test/people", title: "Roster", source_type: "official_roster", tier: "primary", accessibility_status: "accessible" },
      ]);
      return response([
        { id: "SRC-0003", source_type: "publisher_record", accessibility_status: "accessible" },
        { id: "SRC-0004", source_type: "research_note", accessibility_status: "accessible" },
      ]);
    }
    if (table === "graph_source_snapshots") return response([
      { id: "SNP-0001", source_id: "SRC-0001", snapshot_status: "captured" },
      { id: "SNP-0002", source_id: "SRC-0002", snapshot_status: "captured" },
      { id: "SNP-0003", source_id: "SRC-0003", snapshot_status: "captured" },
      { id: "SNP-0004", source_id: "SRC-0004", snapshot_status: "captured" },
    ]);
    if (table === "graph_coverage_gaps") return response([{
      id: "GAP-0001",
      gap_type: "company_metric",
      display_label: "No valuation disclosure found",
      coverage_outcome: "Not found",
      reason: "Declared sources checked; no valuation was disclosed.",
      status: "open",
      as_of_date: "2026-09-04",
      entity_id: "ENT-0001",
      owner_id: null,
      is_shared: true,
    }]);
    if (table === "graph_entity_signals" || table === "graph_entity_aliases" || table === "graph_external_ids"
      || table === "graph_collection_entities" || table === "graph_collections") return response([]);
    throw new Error(`Unexpected private dossier table: ${table}`);
  };
  try {
    const dossier = await graph.investigate(
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
      { id: "ENT-0001", hops: 2, asOf: "2026-09-04", user: { id: "user-1", appMetadata: {} } },
    );
    assert.equal(dossier.privateAvailable, true);
    assert.equal(dossier.privateDossier.emergingResearchers[0].entity.id, "ENT-0002");
    assert.deepEqual(dossier.privateDossier.emergingResearchers[0].recentPaperEntityIds, ["ENT-0004"]);
    assert.equal(dossier.privateDossier.metricCoverage[0].conclusion_label, "Derived signal");
    assert.equal(dossier.privateDossier.metricCoverage[0].publication_status, "candidate");
    assert.equal(dossier.privateDossier.metricCoverage[0].disclosure_status, "undisclosed");
    assert.deepEqual(dossier.privateDossier.metricCoverage[0].source_ids, ["SRC-0004"]);
    assert.equal(dossier.privateDossier.gaps.some((gap) => gap.gapId === "GAP-0001" && gap.outcome === "Not found"), true);
    const metricRequest = privateCalls.find((url) => url.pathname.endsWith("graph_entity_facts")
      && url.searchParams.get("conclusion_label") === "eq.Derived signal");
    assert.equal(metricRequest.searchParams.get("publication_status"), "in.(candidate,published)");
    assert.match(metricRequest.searchParams.get("fact_type"), /^in\.\(headquarters,/);
    const gapRequest = privateCalls.find((url) => url.pathname.endsWith("graph_coverage_gaps"));
    assert.equal(gapRequest.searchParams.get("or"), "(is_shared.eq.true,owner_id.eq.user-1)");
  } finally {
    global.fetch = originalFetch;
  }

  const cronCalls = [];
  const cronHandler = createScheduledRefreshHandler("weekly", {
    today: () => "2026-09-04",
    setCors: () => {},
    verifyCron: (req, expectedJob) => {
      cronCalls.push(["verify", req.headers.authorization, expectedJob]);
      return { schedulerRunDate: "2026-09-03" };
    },
    getConfig: () => ({ test: true }),
    runRefresh: async (config, options) => {
      cronCalls.push(["refresh", config, options]);
      return { runId: "run-1", duplicate: false, stagingOnly: true };
    },
    sendJson: (_res, status, payload) => ({ status, payload }),
    sendError: (_res, error) => { throw error; },
  });
  const cronResult = await cronHandler({ method: "GET", headers: { authorization: "Bearer secret" } }, {});
  assert.equal(cronResult.status, 202);
  assert.deepEqual(cronCalls[1][2], {
    cadence: "weekly",
    asOf: "2026-09-03",
    scheduled: true,
  });
  assert.equal(cronCalls[0][1], "Bearer secret");
  assert.equal(cronCalls[0][2], "graph-refresh-weekly");

  const searchCalls = [];
  global.fetch = async (input) => {
    const url = new URL(String(input));
    searchCalls.push(url);
    const table = url.pathname.split("/").at(-1);
    if (table === "graph_entities") return response([
      { id: "ENT-0001", typed_key: "ORG-0001", kind: "company", canonical_name: "Pilot Co", publication_status: "published" },
    ]);
    if (table === "graph_entity_aliases" || table === "graph_external_ids") return response([]);
    throw new Error(`Unexpected stable-key search table: ${table}`);
  };
  try {
    const byEnt = await graph.searchEntities(
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
      "ent-0001",
      5,
    );
    assert.equal(byEnt[0].id, "ENT-0001");
    assert.equal(searchCalls.some((url) => url.searchParams.get("or") === "(id.eq.ENT-0001,typed_key.eq.ENT-0001)"), true);

    searchCalls.length = 0;
    const byTyped = await graph.searchEntities(
      { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" },
      "org-0001",
      5,
    );
    assert.equal(byTyped[0].typed_key, "ORG-0001");
    assert.equal(searchCalls.some((url) => url.searchParams.get("or") === "(id.eq.ORG-0001,typed_key.eq.ORG-0001)"), true);
  } finally {
    global.fetch = originalFetch;
  }

  let refreshInsertCount = 0;
  let batchCallCount = 0;
  const refreshCalls = [];
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    refreshCalls.push({ table, method: init.method || "GET", url, init });
    if (table === "graph_review_policies") {
      return response([{ id: "GRAPH-POLICY-V2", mode: "shadow", version: 2 }]);
    }
    if (table === "graph_refresh_runs" && init.method === "POST") {
      refreshInsertCount += 1;
      return response(refreshInsertCount === 1 ? [{
        id: "refresh-run-1",
        mode: "shadow",
        cadence: "weekly",
        status: "running",
        idempotency_key: "graph-refresh:weekly:2026-09-04",
      }] : []);
    }
    if (table === "graph_refresh_runs" && init.method === "PATCH") return response([]);
    if (table === "graph_refresh_runs") return response([{
      id: "refresh-run-1",
      mode: "shadow",
      cadence: "weekly",
      status: "completed",
      candidate_count: 2,
      published_count: 0,
      blocked_count: 1,
      idempotency_key: "graph-refresh:weekly:2026-09-04",
    }]);
    if (table === "research_runs" || table === "research_tasks") return response([]);
    if (table === "graph_try_auto_approve_batch") {
      batchCallCount += 1;
      return response({ processed: 2, published: 0, blocked: 1, shadowEligible: 1, errors: 0, remaining: 1 });
    }
    throw new Error(`Unexpected refresh table: ${table}`);
  };
  try {
    const config = { supabaseUrl: "https://project.supabase.co", serviceRoleKey: "service-secret" };
    const first = await graph.runRefresh(config, {
      cadence: "weekly",
      asOf: "2026-09-04",
      scheduled: true,
      batchLimit: 50,
    });
    assert.equal(first.duplicate, false);
    assert.equal(first.status, "staging_only");
    assert.equal(first.stagingOnly, true);
    assert.equal(first.sourceRefreshCompleted, false);
    assert.equal(first.publicationAttempted, false);
    assert.equal(first.candidates, 0);
    assert.equal(first.published, 0);
    assert.equal(first.blocked, 0);
    assert.equal(first.stagedTaskCount, 5);
    assert.equal(batchCallCount, 0);
    const taskInsert = refreshCalls.find((call) => call.table === "research_tasks" && call.method === "POST");
    const stagedTasks = JSON.parse(taskInsert.init.body);
    assert.equal(stagedTasks.length, 5);
    assert.equal(stagedTasks.every((task) => task.status === "blocked"), true);
    assert.equal(stagedTasks.every((task) => /graph-capable/.test(task.error)), true);
    const refreshPatch = refreshCalls.find((call) => call.table === "graph_refresh_runs" && call.method === "PATCH");
    assert.match(JSON.parse(refreshPatch.init.body).notes, /No sources were fetched/);
    const insertCall = refreshCalls.find((call) => call.table === "graph_refresh_runs" && call.method === "POST");
    assert.equal(insertCall.url.searchParams.get("on_conflict"), "idempotency_key");
    assert.match(insertCall.init.headers.Prefer, /resolution=ignore-duplicates/);

    const duplicate = await graph.runRefresh(config, {
      cadence: "weekly",
      asOf: "2026-09-04",
      scheduled: true,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.status, "completed");
    assert.equal(duplicate.stagingOnly, true);
    assert.equal(duplicate.sourceRefreshCompleted, false);
    assert.equal(duplicate.publicationAttempted, false);
    assert.equal(batchCallCount, 0);
  } finally {
    global.fetch = originalFetch;
  }

  process.stdout.write("graph API tests passed\n");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
