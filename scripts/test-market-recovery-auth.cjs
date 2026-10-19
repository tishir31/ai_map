'use strict';
const assert=require('node:assert/strict'),graph=require('../lib/graph-api');
const {schedulerDispatchToken}=require('../lib/scheduler-auth'),router=require('../lib/physical-ai-router');
const root='0123456789abcdef'.repeat(4),date=new Date().toISOString().slice(0,10);
process.env.PHYSICAL_AI_SCHEDULER_SECRET=root;process.env.SUPABASE_URL='https://db.example';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.CRON_SECRET='generic';
const originalRpc=graph.restRequest,originalFetch=global.fetch;let calls=0;
global.fetch=async url=>{assert(url.includes('/rpc/get_physical_ai_scheduler_secret'));return {ok:true,text:async()=>JSON.stringify(root)};};
graph.restRequest=async(_,name)=>{calls++;if(name==='close_market_recovery_batch')return null;assert.equal(name,'market_recovery_status');return {id:'market-recovery-'+date+'-test',runDate:date,collection:{status:'completed'},review:{status:'completed'},privateCapture:'MUST NOT LEAK'};};
async function request(headers={},method='GET',batch='market-recovery-'+date+'-test'){const res={statusCode:0,setHeader(){},end(t){this.body=t?JSON.parse(t):null;}};await router.handlePhysicalAiRoute({method,headers,query:{physicalAiRoute:'market-recovery',batch}},res);return res;}
(async()=>{
 const scoped=job=>({authorization:'Bearer '+schedulerDispatchToken(root,job,date),'x-physical-ai-scheduler':'v1','x-physical-ai-job':job,'x-physical-ai-run-key':job+':'+date});
 assert.equal((await request()).statusCode,401);assert.equal((await request({authorization:'Bearer generic'})).statusCode,401);
 assert.equal((await request(scoped('ingest-web-news'))).statusCode,401);assert.equal((await request(scoped('market-review-daily'),'POST')).statusCode,405);assert.equal(calls,0);
 assert.equal((await request(scoped('market-review-daily'),'GET','../private')).statusCode,400);
 const result=await request(scoped('market-review-daily'));assert.equal(result.statusCode,200);assert(result.body.recovery.done);assert(!JSON.stringify(result.body).includes('MUST NOT LEAK'));
 console.log('Recovery route auth passed: Vault-resolved scoped HMAC, wrong/generic/POST rejection, batch validation and safe summary.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{graph.restRequest=originalRpc;global.fetch=originalFetch;});
