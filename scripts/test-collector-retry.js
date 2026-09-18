"use strict";
const assert = require("node:assert/strict");
const handler=require("../api/ingest-web-news");
const {schedulerDispatchToken}=require("../lib/scheduler-auth");
const secret="0123456789abcdef".repeat(4),today=new Date().toISOString().slice(0,10);
process.env.PHYSICAL_AI_SCHEDULER_SECRET=secret;process.env.SUPABASE_URL="https://db.example";process.env.SUPABASE_SERVICE_ROLE_KEY="test-service";process.env.INGEST_LLM_ENABLED="false";
process.env.INGEST_WEB_SOURCES=JSON.stringify([{name:"Test robots",query:"robots"}]);
delete process.env.VERCEL_ENV;
let checkpoint=null,failTelemetry=false,feedChanged=false,feedReads=0;const fetched=[];
const rss=`<rss><channel>${[1,2].map(n=>`<item><title>Unrelated report ${n}</title><link>https://publisher.example/${n}</link><pubDate>${new Date().toUTCString()}</pubDate><description>No new evidence.</description></item>`).join("")}</channel></rss>`;
global.fetch=async(raw,options={})=>{
 const url=String(raw);if (url.includes("rpc/get_physical_ai_scheduler_secret")) return {ok:true,text:async()=>JSON.stringify(secret)};if(url.includes("collector_checkpoints")){
   if(options.method==="POST"){checkpoint=JSON.parse(options.body);return {ok:true};}
   return {ok:true,json:async()=>checkpoint?[checkpoint]:[]};
 }
 if(url.includes("/rest/v1/ingestion_runs"))return failTelemetry ? {ok:false,status:500,text:async()=>"Storage unavailable"} : {ok:true};
 if(url.includes("/rest/v1/"))return {ok:true,json:async()=>[]};
 if(url.includes("news.google.com/rss/search")){feedReads+=1;return {ok:true,text:async()=>feedChanged ? rss.replace("https://publisher.example/1","https://publisher.example/new-X").replace("https://publisher.example/2","https://publisher.example/1") : rss};}
 fetched.push(url);return {ok:true,status:200,url,headers:{get:()=>"text/html"},text:async()=>"<html><title>Unrelated report</title><p>No new evidence.</p></html>"};
};
const req={method:"GET",headers:{authorization:`Bearer ${schedulerDispatchToken(secret,"ingest-web-news",today)}`,"x-physical-ai-scheduler":"v1","x-physical-ai-job":"ingest-web-news","x-physical-ai-run-key":`ingest-web-news:${today}`},body:{maxItems:1,maxResults:2}};
async function invoke(){const res={statusCode:0,setHeader(){},end(text){this.body=JSON.parse(text);}};await handler(req,res);return res;}
(async()=>{
 const first=await invoke();assert.equal(first.statusCode,503);assert.equal(first.body.status,"partial");assert.equal(first.body.retryable,true);assert.equal(first.body.stopReason,"max-items");assert(Object.values(checkpoint.checkpoint.processed)[0].includes("https://publisher.example/1"));
 feedChanged=true;
 const second=await invoke();assert.equal(second.statusCode,200);assert.equal(second.body.status,"completed");assert.equal(checkpoint.totals,undefined);assert.equal(checkpoint.checkpoint.totals.processed,2);assert.deepEqual(fetched,["https://publisher.example/1","https://publisher.example/2"]);
 assert.equal(feedReads,1,"Retry must replay frozen original selection despite new feed items");assert(Object.values(checkpoint.checkpoint.selected)[0].some(item=>item.link==="https://publisher.example/2"));
 const third=await invoke();assert.equal(third.body.duplicate,true);assert.equal(fetched.length,2);
 checkpoint=null;fetched.length=0;feedChanged=false;req.body.maxItems=100;failTelemetry=true;
 const failed=await invoke();assert.equal(failed.statusCode,502);assert.equal(checkpoint.status,"failed","Failed telemetry cannot mark checkpoint completed");
 failTelemetry=false;const recovered=await invoke();assert.equal(recovered.statusCode,200);assert.equal(recovered.body.duplicate,undefined,"Telemetry recovery must not short-circuit");assert.equal(checkpoint.status,"completed");assert.equal(fetched.length,2,"Evidence already processed is not fetched on telemetry recovery");
 console.log("collector retry tests passed: partial retry resumes, completed rerun is no-op");
})().catch(error=>{console.error(error);process.exitCode=1;});
