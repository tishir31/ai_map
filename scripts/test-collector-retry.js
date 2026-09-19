'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/ingest-web-news'),publicWeb=require('../lib/public-web');
const {schedulerDispatchToken}=require('../lib/scheduler-auth');
const secret='0123456789abcdef'.repeat(4),today=new Date().toISOString().slice(0,10);
Object.assign(process.env,{PHYSICAL_AI_SCHEDULER_SECRET:secret,SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',INGEST_LLM_ENABLED:'true',GEMINI_API_KEY:'synthetic-key',OPENAI_API_KEY:'synthetic-unused',INGEST_WEB_SOURCES:JSON.stringify([{name:'Test robots',query:'robots'}])});delete process.env.VERCEL_ENV;
let run=null,tasks=[],feedChanged=false,feedMode='items',feedReads=0,modelCalls=0,openAiCalls=0,failFinish=false;const fetched=[];
const sourceItems=['A','B'].map(id=>({title:'Known Robotics raises US$70 million Series C '+id,link:'https://publisher.example/'+id,pubDate:today,source:'Publisher'}));
const summarize=()=>{const items=tasks.filter(t=>t.kind==='item');run.selected=items.length;run.processed=items.filter(t=>['rejected','staged','duplicate','error'].includes(t.status)).length;run.remaining=run.selected-run.processed;run.rejected=items.filter(t=>t.status==='rejected').length;run.completed_queries=tasks.filter(t=>t.kind==='feed'&&t.status==='feed-completed').length;run.status=tasks.some(t=>['pending','running'].includes(t.status))?'running':'completed';return run;};
global.fetch=async(raw,options={})=>{
 const url=String(raw);if(url.includes('rpc/get_physical_ai_scheduler_secret'))return{ok:true,text:async()=>JSON.stringify(secret)};
 if(url.includes('generativelanguage.googleapis.com')){modelCalls++;if(modelCalls===1)return{ok:false,status:429,json:async()=>({error:'quota'})};return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({keep:false,physicalAi:false,fundingEvent:false,rejectReason:'not a funding announcement'})}]}}]})};}
 if(url.includes('api.openai.com')){openAiCalls++;throw Error('Unexpected provider fallback');}
 const name=url.split('/rpc/')[1];assert(name,url);const body=JSON.parse(options.body||'{}');let value;
 if(name==='acquire_web_collection_run'){if(!run){run={id:'web',run_date:today,window:body.p_plan.window,status:'running',planned_queries:1,staged:0,duplicates:0,errors:0,stop_reason:'continuation-pending'};tasks=[{id:'feed',kind:'feed',status:'pending',attempts:0,input:body.p_plan.sources[0]}];}value=summarize();}
 if(name==='claim_web_collection_task'){const task=tasks.find(t=>t.status==='pending');if(task){task.status='running';task.attempts++;task.locked_by='synthetic-lock';}value=task||null;}
 if(name==='web_collection_dedupe_context')value={companies:[],activities:[],pending:[]};
 if(name==='finish_web_collection_task'){
  if(failFinish){failFinish=false;return{ok:false,status:503,text:async()=>JSON.stringify({message:'synthetic storage failure'})};}
  const t=tasks.find(t=>t.id===body.p_task_id),r=body.p_result;t.result=r;
  if(r.disposition==='feed-completed'){tasks.push(...r.items.map((item,i)=>({id:'item-'+i,kind:'item',status:'pending',attempts:0,input:{item,sourceName:'Test robots'}})));t.status='feed-completed';}
  else if(r.disposition==='error'){t.status=t.attempts<2?'pending':'error';run.stop_reason='provider-error';}
  else{t.status=r.disposition;run.stop_reason='continuation-pending';}value=summarize();
 }
 if(name==='summarize_web_collection_run')value=summarize();
 assert.notEqual(value,undefined,name);return{ok:true,text:async()=>JSON.stringify(value)};
};
publicWeb.readPublicPage=async(url,_redirects,_deadline,options)=>{
 if(String(url).includes('news.google.com/rss')){assert.equal(options.allowXml,true);feedReads++;if(feedMode==='challenge')return{status:200,text:'<html><title>Challenge</title></html>',finalUrl:url};if(feedMode==='truncated')return{status:200,text:'<rss><channel><item><title>cut off',finalUrl:url};const rows=feedMode==='empty'?[]:(feedChanged?[{...sourceItems[0],link:'https://publisher.example/X'},sourceItems[0]]:sourceItems);return{status:200,text:`<rss><channel>${rows.map(i=>`<item><title>${i.title}</title><link>${i.link}</link><pubDate>${new Date(i.pubDate+'T00:00Z').toUTCString()}</pubDate><source>${i.source}</source></item>`).join('')}</channel></rss>`,finalUrl:url};}
 fetched.push(url);return{status:200,finalUrl:url,text:'<title>Known Robotics financing</title><p>Known Robotics builds industrial robots and announces financing.</p>'};
};
const headers={authorization:`Bearer ${schedulerDispatchToken(secret,'ingest-web-news',today)}`,'x-physical-ai-scheduler':'v1','x-physical-ai-job':'ingest-web-news','x-physical-ai-run-key':'ingest-web-news:'+today};
async function invoke(h=headers){const res={statusCode:0,setHeader(){},end(text){this.body=JSON.parse(text);}};await handler({method:'GET',headers:h},res);return res;}
(async()=>{
 assert.equal((await invoke({})).statusCode,401);assert.equal(tasks.length,0);
 let result=await invoke();assert.equal(result.statusCode,202);assert.equal(run.selected,2);feedChanged=true;
 result=await invoke();assert.equal(result.statusCode,202);assert.equal(result.body.collection.stopReason,'provider-error');assert.equal(run.remaining,2);assert.equal(tasks[1].status,'pending');assert(tasks[1].result.provenance.captureHash);assert.equal(openAiCalls,0);
 await invoke();assert.equal(tasks[1].status,'rejected');assert.equal(run.remaining,1);
 result=await invoke();assert.equal(result.statusCode,200);assert.equal(result.body.status,'completed');assert.deepEqual(fetched,['https://publisher.example/A','https://publisher.example/A','https://publisher.example/B']);assert.equal(feedReads,1);assert.equal(modelCalls,3);await invoke();assert.equal(modelCalls,3);assert.equal(openAiCalls,0);assert(!JSON.stringify(result.body).includes('captureText'));assert(!JSON.stringify(result.body).includes('robot funding'));
 // HTTP 200 challenge/truncation is a retryable source failure; a well-formed empty RSS is complete.
 for(const invalid of ['challenge','truncated']){run=null;tasks=[];feedMode=invalid;result=await invoke();assert.equal(result.statusCode,202);assert.equal(tasks[0].status,'pending');assert.equal(tasks[0].result.reason,'source-response');}
 run=null;tasks=[];feedMode='empty';result=await invoke();assert.equal(result.statusCode,200);assert.equal(result.body.collection.selected,0);
 // A durable finish failure is a retryable request failure, never a false completed run.
 run=null;tasks=[];feedMode='items';feedChanged=false;failFinish=true;result=await invoke();assert.equal(result.statusCode,502);assert.equal(tasks[0].status,'running');assert.equal(run.status,'running');
 console.log('collector continuation tests passed: actual HMAC handler, frozen A/B, one-task request, 429 unfinished-only retry/provenance, malformed-vs-empty RSS, no fallback, no-op completion and durable finish failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
