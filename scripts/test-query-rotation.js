"use strict";

const assert = require("node:assert/strict");
const {
  buildRotationPlan,
  isDateInWindow,
  rotateQueries,
  rotationSafeLookbackDays,
  utcDayNumber,
  withLookbackClause,
} = require("../lib/query-rotation");

const queries = ["a", "b", "c"];
const day = new Date("2026-09-04T00:00:00Z");
const nextDay = new Date("2026-09-05T00:00:00Z");
const first = rotateQueries(queries, day);
const second = rotateQueries(queries, nextDay);

assert.deepEqual([...first].sort(), queries);
assert.deepEqual([...second].sort(), queries);
assert.equal(first.length, queries.length);
assert.equal(second[0], queries[(utcDayNumber(nextDay) % queries.length + queries.length) % queries.length]);
assert.notEqual(first[0], second[0]);
assert.deepEqual(rotateQueries(["only"], day), ["only"]);
assert.deepEqual(rotateQueries([], day), []);
assert.equal(rotationSafeLookbackDays(8, 2), 9);
assert.equal(rotationSafeLookbackDays(3, 2), 4);
assert.equal(withLookbackClause("robotics when:2d", "web", 9), "robotics when:9d");
assert.equal(withLookbackClause("robotics", "web", 9), "robotics when:9d");
assert.equal(withLookbackClause("newer_than:2d robotics", "gmail", 4), "newer_than:4d robotics");

const webQueries = Array.from({ length: 8 }, (_, index) => ({
  name: `query-${index + 1}`,
  query: `robotics funding query ${index + 1} when:2d`,
}));
const lastProcessedDay = new Map();
const seen = new Set();

// Simulate the worst bounded run: only the first rotated query completes each
// day. Every pack must still revisit within the widened source window, so an
// event on any intervening day remains eligible on the next visit.
for (let dayOffset = 0; dayOffset < webQueries.length * 2; dayOffset += 1) {
  const current = new Date(day.getTime() + dayOffset * 86_400_000);
  const plan = buildRotationPlan(webQueries, current, { provider: "web", baseLookbackDays: 2 });
  assert.equal(plan.effectiveLookbackDays, 9);
  assert.equal(plan.rotationCycleDays, 8);
  assert.match(plan.queries[0].query, /\bwhen:9d\b/);
  const processed = plan.queries[0].name;
  const priorDay = lastProcessedDay.get(processed);
  if (priorDay !== undefined) {
    assert.equal(dayOffset - priorDay, 8);
    const window = {
      startDate: new Date(current.getTime() - plan.effectiveLookbackDays * 86_400_000).toISOString().slice(0, 10),
      endDate: current.toISOString().slice(0, 10),
    };
    for (let eventDay = priorDay + 1; eventDay <= dayOffset; eventDay += 1) {
      const eventDate = new Date(day.getTime() + eventDay * 86_400_000).toISOString().slice(0, 10);
      assert.equal(isDateInWindow(eventDate, window), true);
    }
  }
  lastProcessedDay.set(processed, dayOffset);
  seen.add(processed);
}
assert.equal(seen.size, webQueries.length);

const gmailPlan = buildRotationPlan(
  Array.from({ length: 3 }, (_, index) => ({ name: `gmail-${index}`, query: `newer_than:2d topic-${index}` })),
  day,
  { provider: "gmail", baseLookbackDays: 2 },
);
assert.equal(gmailPlan.effectiveLookbackDays, 4);
assert.equal(gmailPlan.queries.every((item) => /\bnewer_than:4d\b/.test(item.query)), true);

console.log("query rotation tests passed");
