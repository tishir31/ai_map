"use strict";
const assert=require("node:assert/strict");
const handler=require("../api/ingest-gmail");
const {schedulerDispatchToken}=require("../lib/scheduler-auth");
const secret="0123456789abcdef".repeat(4),today=new Date().toISOString().slice(0,10);
Object.assign(process.env,{PHYSICAL_AI_SCHEDULER_SECRET:secret,SUPABASE_URL:"https://db.example",SUPABASE_SERVICE_ROLE_KEY:"test-service",INGEST_LLM_ENABLED:"false",GMAIL_CLIENT_ID:"test-client",GMAIL_CLIENT_SECRET:"test-secret",GMAIL_REFRESH_TOKEN:"test-token",GMAIL_USER_EMAIL:"synthetic@fixture.example",INGEST_SOURCES:JSON.stringify([{name:"Test",query:"robots"}])});
delete process.env.VERCEL_ENV;
let checkpoint=null,listReads=0,changed=false;const fetched=[];
global.fetch=async(raw,options={})=>{
 const url=String(raw);
 if(url.includes("rpc/get_physical_ai_scheduler_secret"))return {ok:true,text:async()=>JSON.stringify(secret)};
 if(url.includes("collector_checkpoints")){if(options.method==="POST"){checkpoint=JSON.parse(options.body);return {ok:true};}return {ok:true,json:async()=>checkpoint?[checkpoint]:[]};}
 if(url.includes("/rest/v1/ingestion_runs"))return {ok:true};
 if(url.includes("/rest/v1/"))return {ok:true,json:async()=>[]};
 if(url.includes("oauth2.googleapis.com/token"))return {ok:true,json:async()=>({access_token:"synthetic-access"})};
 if(url.includes("/messages?")){listReads+=1;return {ok:true,json:async()=>({messages:changed?[{id:"X"},{id:"A"}]:[{id:"A"},{id:"B"}]})};}
 const id=url.match(/\/messages\/([^?]+)/)?.[1];assert(id,url);fetched.push(id);
 return {ok:true,json:async()=>({id,internalDate:String(Date.now()),snippet:"No relevant evidence",payload:{headers:[{name:"Subject",value:"Unrelated report"}],body:{data:Buffer.from("No relevant evidence").toString("base64url")}}})};
};
const req={method:"GET",headers:{authorization:`Bearer ${schedulerDispatchToken(secret,"ingest-gmail",today)}`,"x-physical-ai-scheduler":"v1","x-physical-ai-job":"ingest-gmail","x-physical-ai-run-key":`ingest-gmail:${today}`},body:{maxItems:1,maxResults:2}};
async function invoke(){const res={statusCode:0,setHeader(){},end(text){this.body=JSON.parse(text);}};await handler(req,res);return res;}
(async()=>{
 const first=await invoke();assert.equal(first.statusCode,503);assert.equal(first.body.status,"partial");assert.equal(fetched[0],"A");
 changed=true;const second=await invoke();assert.equal(second.statusCode,200);assert.equal(second.body.status,"completed");assert.deepEqual(fetched,["A","B"]);assert.equal(listReads,1,"Frozen selection prevents new X from displacing B");assert(Object.values(checkpoint.checkpoint.selected)[0].some(message=>message.id==="B"));
 const third=await invoke();assert.equal(third.body.duplicate,true);assert.equal(fetched.length,2);
 console.log("Gmail collector changed-feed retry tests passed: frozen A/B, no X displacement");
})().catch(error=>{console.error(error);process.exitCode=1;});
