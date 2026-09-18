"use strict";
const assert=require("node:assert/strict");
const payload=require("../docs/live-feedback/public-recovery-payload.json");
const {buildSnapshot,isPublicSafeActivity}=require("../lib/market-snapshot");
assert.equal(payload.records.length,2);
for(const record of payload.records){assert.equal(isPublicSafeActivity(record.activityInsertIfMissing),true);assert.equal(record.activityInsertIfMissing.id,`a-${record.candidateId}`);assert.equal(record.activityInsertIfMissing.source_id,record.sourceInsertIfMissing.id);assert.equal(record.activityInsertIfMissing.approved_at,null);assert.equal(record.activityInsertIfMissing.confidence,"reported");}
const snapshot=buildSnapshot({activities:payload.records.map(x=>x.activityInsertIfMissing),companies:payload.records.map(x=>x.companyInsertIfMissing),exclusions:[],ingestionRuns:[]});
assert.equal(snapshot.counts.activities,2);assert.equal(snapshot.counts.companies,2);assert.equal(snapshot.latestActivityDate,"2026-09-15");assert.equal(payload.records.find(x=>x.candidateId==="rq-web-lg7d8y").activityInsertIfMissing.date_announced,"2026-09-10");
assert.equal(JSON.stringify(snapshot).includes("news.google.com"),false);
console.log("reviewed public recovery payload tests passed: dates, deterministic IDs, existing privacy gates");
