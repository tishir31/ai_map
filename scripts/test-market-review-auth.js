'use strict';
const assert=require('node:assert/strict');
const graph=require('../lib/graph-api');const worker=require('../lib/market-review-worker');
const {schedulerDispatchToken}=require('../lib/scheduler-auth');const router=require('../lib/physical-ai-router');
const root='0123456789abcdef'.repeat(4);process.env.PHYSICAL_AI_SCHEDULER_SECRET=root;
process.env.SUPABASE_URL='https://db.example';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
const date=new Date().toISOString().slice(0,10);let calls=0;
const saved=graph.restRequest;const savedFetch=global.fetch;global.fetch=async url=>{assert(url.includes('/rpc/get_physical_ai_scheduler_secret'));return {ok:true,text:async()=>JSON.stringify(root)};};process.env.CRON_SECRET='generic';graph.restRequest=async()=>{calls++;return {id:'PRIVATE RUN',run_date:date,status:'completed',selected:0,reviewed:0,input:'PRIVATE CAPTURE'};};
async function request(headers={},method='GET'){const res={statusCode:0,setHeader(){},end(t){this.body=t?JSON.parse(t):null;}};await router.handlePhysicalAiRoute({method,headers,query:{physicalAiRoute:'market-review-daily'}},res);return res;}
(async()=>{
 assert.equal((await request()).statusCode,401);assert.equal((await request({authorization:'Bearer generic'})).statusCode,401);
 const scoped=job=>({authorization:'Bearer '+schedulerDispatchToken(root,job,date),'x-physical-ai-scheduler':'v1','x-physical-ai-job':job,'x-physical-ai-run-key':job+':'+date});
 assert.equal((await request(scoped('graph-refresh-daily'))).statusCode,401);assert.equal((await request(scoped('market-review-daily'),'POST')).statusCode,405);assert.equal(calls,0);
 const success=await request(scoped('market-review-daily'));assert.equal(success.statusCode,200);assert.equal(calls,1);assert.equal(success.body.publicMarketReview.selected,0);assert(!JSON.stringify(success.body).includes('PRIVATE'));
 graph.restRequest=saved;global.fetch=savedFetch;console.log('market review auth tests passed: actual multiplex fixed HMAC job only, no generic/wrong-job/POST, zero subset safe projection');
})().catch(e=>{graph.restRequest=saved;global.fetch=savedFetch;console.error(e.message);process.exitCode=1;});
