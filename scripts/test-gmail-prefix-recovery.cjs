'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/ingest-gmail');
const {schedulerDispatchToken}=require('../lib/scheduler-auth');
const secret='0123456789abcdef'.repeat(4),today=new Date().toISOString().slice(0,10);
Object.assign(process.env,{PHYSICAL_AI_SCHEDULER_SECRET:secret,SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'fixture',INGEST_LLM_ENABLED:'false',GMAIL_CLIENT_ID:'fixture',GMAIL_CLIENT_SECRET:'fixture',GMAIL_REFRESH_TOKEN:'fixture',GMAIL_USER_EMAIL:'synthetic@fixture.example',INGEST_SOURCES:JSON.stringify([{name:'Fixture',query:'robots'}])});
delete process.env.VERCEL_ENV;
let checkpoint,fail=true,reads=[];
global.fetch=async(raw,options={})=>{
 const url=String(raw);if(url.includes('rpc/get_physical_ai_scheduler_secret'))return {ok:true,text:async()=>JSON.stringify(secret)};assert(options.signal,'every Gmail, database and model request needs a finite abort signal');
 if(url.includes('collector_checkpoints')){if(options.method==='POST'){checkpoint=JSON.parse(options.body);return {ok:true};}return {ok:true,json:async()=>checkpoint?[checkpoint]:[]};}
 if(url.includes('/rest/v1/ingestion_runs'))return {ok:true};
 if(url.includes('/rest/v1/'))return {ok:true,json:async()=>[]};
 if(url.includes('oauth2.googleapis.com'))return {ok:true,json:async()=>({access_token:'fixture'})};
 if(url.includes('/messages?'))return {ok:true,json:async()=>({messages:[{id:'A'},{id:'B'}]})};
 const id=url.match(/\/messages\/([^?]+)/)?.[1];assert(id);reads.push(id);
 if(id==='B'&&fail)return {ok:false,status:503,text:async()=> 'Temporary provider failure'};
 return {ok:true,json:async()=>({id,snippet:'Unrelated report',payload:{headers:[{name:'Subject',value:'Unrelated report'}],body:{data:Buffer.from('Unrelated report').toString('base64url')}}})};
};
const req={method:'GET',headers:{authorization:'Bearer '+schedulerDispatchToken(secret,'ingest-gmail',today),'x-physical-ai-scheduler':'v1','x-physical-ai-job':'ingest-gmail','x-physical-ai-run-key':'ingest-gmail:'+today},body:{}};
async function invoke(){const res={setHeader(){},end(text){this.body=JSON.parse(text)}};await handler(req,res);return res;}
(async()=>{
 const first=await invoke();assert.equal(first.statusCode,502);assert.equal(first.body.retryable,true);assert.deepEqual(Object.values(checkpoint.checkpoint.processed)[0],['A']);assert.equal(checkpoint.checkpoint.totals.processed,1);assert.equal(checkpoint.checkpoint.totals.requested,2);
 fail=false;const second=await invoke();assert.equal(second.statusCode,200);assert.equal(second.body.status,'completed');assert.deepEqual(reads,['A','B','B'],'successful prefix must not be fetched or classified again');assert.equal(checkpoint.checkpoint.totals.processed,2);
 console.log('Gmail prefix recovery passed: all requests bounded, mid-source provider failure retains committed A, retries B only, and counts unique completed messages.');
})().catch(e=>{console.error(e);process.exitCode=1;});
