"use strict";

const DAY_MS = 86_400_000;
const DEFAULT_SCHEDULE_INTERVAL_DAYS = 1;
const DEFAULT_OVERLAP_DAYS = 1;

function utcDayNumber(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.floor(time / DAY_MS);
}

function rotateQueries(queries, value = new Date()) {
  if (!Array.isArray(queries) || queries.length < 2) return Array.isArray(queries) ? [...queries] : [];
  const offset = ((utcDayNumber(value) % queries.length) + queries.length) % queries.length;
  return [...queries.slice(offset), ...queries.slice(0, offset)];
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function rotationSafeLookbackDays(
  queryCount,
  baseLookbackDays = 2,
  scheduleIntervalDays = DEFAULT_SCHEDULE_INTERVAL_DAYS,
  overlapDays = DEFAULT_OVERLAP_DAYS,
) {
  const count = Math.max(1, Math.floor(positiveNumber(queryCount, 1)));
  const base = Math.max(1, Math.ceil(positiveNumber(baseLookbackDays, 2)));
  const interval = Math.max(1, positiveNumber(scheduleIntervalDays, DEFAULT_SCHEDULE_INTERVAL_DAYS));
  const overlap = nonNegativeNumber(overlapDays, DEFAULT_OVERLAP_DAYS);
  return Math.max(base, Math.ceil(count * interval + overlap));
}

function withLookbackClause(query, provider, lookbackDays) {
  const value = String(query || "").trim();
  const days = Math.max(1, Math.ceil(positiveNumber(lookbackDays, 2)));
  const isGmail = provider === "gmail";
  const clause = isGmail ? `newer_than:${days}d` : `when:${days}d`;
  const detector = isGmail ? /\bnewer_than:\d+d\b/i : /\bwhen:\d+d\b/i;
  const replacer = isGmail ? /\bnewer_than:\d+d\b/ig : /\bwhen:\d+d\b/ig;
  return detector.test(value) ? value.replace(replacer, clause) : `${value} ${clause}`.trim();
}

function buildRotationPlan(queries, value = new Date(), options = {}) {
  const list = Array.isArray(queries) ? queries : [];
  const scheduleIntervalDays = positiveNumber(options.scheduleIntervalDays, DEFAULT_SCHEDULE_INTERVAL_DAYS);
  const effectiveLookbackDays = rotationSafeLookbackDays(
    list.length,
    options.baseLookbackDays,
    scheduleIntervalDays,
    options.overlapDays,
  );
  const provider = options.provider === "gmail" ? "gmail" : "web";
  return {
    queries: rotateQueries(list, value).map((source) => ({
      ...source,
      query: withLookbackClause(source?.query, provider, effectiveLookbackDays),
    })),
    effectiveLookbackDays,
    rotationCycleDays: Math.max(1, list.length) * scheduleIntervalDays,
  };
}

function isDateInWindow(value, window) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Boolean(window?.startDate)
    && Boolean(window?.endDate)
    && value >= window.startDate
    && value <= window.endDate;
}

module.exports = {
  buildRotationPlan,
  isDateInWindow,
  rotateQueries,
  rotationSafeLookbackDays,
  utcDayNumber,
  withLookbackClause,
};
