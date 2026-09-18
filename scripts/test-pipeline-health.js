"use strict";
const assert = require("node:assert/strict");
const health = require("../api/pipeline-health")._test;
const queue = health.summarizeQueue([
 {status:"pending",source_type:"Gmail",created_at:"2026-05-20T00:00:00Z",candidate_date:"2026-09-16"},
 {status:"pending",source_type:"article",source_url:"https://publisher.example/news",created_at:"2026-09-16T00:00:00Z",candidate_date:"2026-09-15"},
 {status:"approved",source_type:"article",created_at:"2026-01-01T00:00:00Z"}
]);
assert.equal(queue.pending,2); assert.equal(queue.gmailOnly,1); assert.equal(queue.oldestPendingAt,"2026-05-20T00:00:00Z"); assert.equal(queue.newestCandidateDate,"2026-09-16"); assert.equal(queue.complete,true);
assert.equal(health.summarizeQueue(Array.from({length:1000},()=>({status:"pending"}))).complete,false);
const latestBySource=health.summarizeRuns([{id:"run",source_name:"Gmail",status:"partial",started_at:new Date().toISOString(),stop_reason:"time-budget",checkpoint:{processed:{secret:["private-message-id"]}}}]);
assert.equal(latestBySource.Gmail.stopReason,"time-budget");assert.equal(latestBySource.Gmail.processedItems,null);assert.equal(JSON.stringify(latestBySource).includes("private-message-id"),false);
const findings=health.buildFindings({latestBySource,queue,investorStatus:{applied:true},runWindow:[],schemaWarnings:[],llmConfigured:true,approvedDataset:{latestActivityDate:"2026-09-01",lastPublicationAt:"2026-09-05"},ecosystem:{status:"partial"}});
for(const code of ["latest-run-partial","event-age","publication-stall","ecosystem-partial"]) assert(findings.some(f=>f.code===code),code);
assert.equal(health.nextDailyCheck({hour:13,minute:15},new Date("2026-09-18T13:16:00Z")),"2026-09-19T13:15:00.000Z");
console.log("pipeline health tests passed");

// Exercise the actual anonymous handler, including privacy projection and response wiring.
const handler=require("../api/pipeline-health");
process.env.SUPABASE_URL="https://db.example";process.env.SUPABASE_SERVICE_ROLE_KEY="test";
const publicRow={id:"a-public",company_id:"c-public",date_announced:"2026-09-10",review_status:"approved",source_type:"press release",source_url:"https://official.example/news",confidence:"reported",is_sample:false,description:"A public source announcement.",approved_at:"2026-09-18T00:00:00Z"};
global.fetch=async(url)=>({ok:true,json:async()=>{
 if(url.includes("ingestion_runs?"))return [{id:"run",source_name:"Public web news",status:"partial",stop_reason:"time-budget",started_at:new Date().toISOString(),query:"PRIVATE QUERY"}];
 if(url.includes("review_queue_items?"))return [{id:"pending",status:"pending",source_type:"Gmail",created_at:"2026-05-20",candidate_date:"2026-09-16"}];
 if(url.includes("activities?"))return [publicRow,{...publicRow,id:"a-private",source_type:"Gmail",date_announced:"2026-09-18",approved_at:"2026-09-19T00:00:00Z"}];
 if(url.includes("companies?"))return [{id:"c-public",name:"Public company",is_sample:false}];
 if(url.includes("ecosystem_runs?"))return [{id:"eco",status:"partial",cadence:"daily",result:{private:"RAW CAPTURE"}}];
 if(url.includes("ecosystem_snapshot_releases?"))return [{manifest:{publishedAt:"2026-09-18",version:"test",coverage:{checked:1,remaining:2}}}];
 return [];
}});
(async()=>{
 const res={statusCode:0,setHeader(){},end(text){this.payload=JSON.parse(text);}};
 await handler({method:"GET",headers:{},query:{}},res);
 assert.equal(res.statusCode,200);assert.equal(res.payload.ok,true);
 assert.equal(res.payload.approvedDataset.publicSafeRows,1);assert.equal(res.payload.approvedDataset.latestActivityDate,"2026-09-10");assert.equal(res.payload.approvedDataset.lastPublicationAt,"2026-09-18T00:00:00Z");
 assert.equal(res.payload.ecosystem.status,"partial");assert.equal(res.payload.reviewQueue.complete,true);
 assert.equal(JSON.stringify(res.payload).includes("PRIVATE QUERY"),false);assert.equal(JSON.stringify(res.payload).includes("RAW CAPTURE"),false);
 console.log("pipeline health handler integration tests passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
