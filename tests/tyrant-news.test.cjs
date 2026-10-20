const {test}=require('node:test');
const assert=require('node:assert/strict');
const news=require('../lib/tyrant-news');
const publicWeb=require('../lib/public-web');
const graph=require('../lib/graph-api');
const {schedulerDispatchToken}=require('../lib/scheduler-auth');
const url='https://www.tesollo.com/news/press/robotic-hands';
const id='00000000-0000-4000-8000-000000000001';
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body?JSON.parse(body):null;}};}
test('public news URLs exclude chats, private links, unsupported origins, query credentials and fragments',()=>{
 news.validateNewsUrl(url);
 for(const source of require('../docs/live-updates/tyrant-producer-links.json'))news.validateNewsUrl(source);
 for(const value of ['https://chatgpt.com/c/private','https://mail.google.com/mail/u/0/','https://127.0.0.1/news','https://www.tesollo.com/news/press/robotic-hands?token=private','https://www.tesollo.com/news/press/robotic-hands#private','https://www.extendrobotics.com/news/funding','http://www.tesollo.com/news/press/robots','https://www.tesollo.com@evil.invalid/news'])assert.throws(()=>news.validateNewsUrl(value));
});
test('only the publisher headline is parsed; scripts, source bodies, email addresses and login challenges are withheld',()=>{
 assert.equal(news.sourceHeadline('<meta content="New robotic hands &amp; perception" property="og:title"><script>PRIVATE CHAT</script>'),'New robotic hands & perception');
 assert.equal(news.sourceHeadline('<title>New robotics &quot;launch&quot;</title><p>PRIVATE BODY</p>'),'New robotics "launch"');
 for(const title of ['Just a moment...','Access Denied','Page Unavailable','Log in to your account','Email private@example.org','&lt;script&gt;private&lt;/script&gt;'])assert.equal(news.sourceHeadline('<title>'+title+'</title>'),null);
});
test('public DTO never leaks producer receipt, source capture, lease, errors or private text; link-only fallback stays unverified',()=>{
 const rows=news.publicNews([{id,source_url:url,shared_at:'2026-10-19T15:00:00Z',headline_status:'link_only',event_key:'PRIVATE',capture_text:'PRIVATE',lease_id:'PRIVATE',source_title:null},
  {id:'bad',source_url:'https://chatgpt.com/private',shared_at:'2026-10-19T15:00:00Z'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].headline,null);assert.equal(rows[0].financialTotalsEligible,false);assert.equal(rows[0].attribution,'Tyrant');assert(!JSON.stringify(rows).includes('PRIVATE'));
});
test('worker extracts the public source headline under a lease and never writes an activity or financing value',async()=>{
 const calls=[];const result=await news.enrichNews({},id,{call:async(_config,name,body)=>{calls.push({name,body});return name==='claim_tyrant_news_headline'?{id,sourceUrl:url,leaseId:id}:true;},read:async(source,redirects,deadline,options)=>{assert.equal(source,url);assert.throws(()=>options.validateUrl('https://chatgpt.com/private'));return{status:200,finalUrl:url,text:'<title>Robotic hand project announced</title><p>PRIVATE BODY</p>'};}});
 assert.equal(result.status,'source_headline');assert.equal(calls[1].body.p_title,'Robotic hand project announced');assert(!JSON.stringify(calls).includes('PRIVATE'));assert.deepEqual(calls.map(x=>x.name),['claim_tyrant_news_headline','finish_tyrant_news_headline']);
});
test('unavailable or off-scope source leaves the link visible without inventing a headline',async()=>{
 for(const read of [async()=>{throw new Error('403');},async()=>({status:200,finalUrl:'https://chatgpt.com/private',text:'<title>PRIVATE</title>'})]){
  let payload;const result=await news.enrichNews({},id,{call:async(_config,name,body)=>name==='claim_tyrant_news_headline'?{id,sourceUrl:url,leaseId:id}:(payload=body,true),read});
  assert.equal(result.status,'source_unavailable');assert.equal(payload.p_title,null);
 }
});
test('origin validator runs before DNS or any source request',async()=>{
 await assert.rejects(publicWeb.readPublicPage('https://unlisted.publisher.org/news',0,Date.now()+9000,{validateUrl:news.validateNewsUrl}),/Unsupported public news URL/);
});
test('headline enrichment requires its exact scoped job; anonymous and market-review tokens cannot write news',async()=>{
 const original={...process.env},savedFetch=global.fetch,savedRequest=graph.restRequest;
 process.env.PHYSICAL_AI_SCHEDULER_SECRET='1'.repeat(64);process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';process.env.VERCEL_ENV='production';
 const day=new Date().toISOString().slice(0,10);let calls=0;
 global.fetch=async target=>{assert.equal(target,'https://project.supabase.co/rest/v1/rpc/get_physical_ai_scheduler_secret');return {ok:true,text:async()=>JSON.stringify('1'.repeat(64))};};graph.restRequest=async()=>{calls++;return null;};
 try{
  for(const job of [null,'market-review-daily','tyrant-news-enrich']){
   const req={method:'GET',query:{id},headers:job?{authorization:'Bearer '+schedulerDispatchToken(process.env.PHYSICAL_AI_SCHEDULER_SECRET,job,day),'x-physical-ai-scheduler':'v1','x-physical-ai-job':job,'x-physical-ai-run-key':job+':'+day}:{}};const res=response();
   await news.enrichmentHandler(req,res);assert.equal(res.statusCode,job==='tyrant-news-enrich'?200:401);
  }
  assert.equal(calls,1);
 }finally{process.env=original;global.fetch=savedFetch;graph.restRequest=savedRequest;}
});
