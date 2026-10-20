const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema vault;create schema extensions;create schema net;create table vault.decrypted_secrets(name text,decrypted_secret text);insert into vault.decrypted_secrets values('physical_ai_scheduler_v1',repeat('1',64));create table net.calls(url text,headers jsonb);create function extensions.hmac(text,text,text)returns bytea language sql immutable as $$select sha256(convert_to($1||$2,'UTF8'))$$;create function net.http_get(url text,headers jsonb,timeout_milliseconds integer)returns bigint language plpgsql as $$begin insert into net.calls values(url,headers);return 1;end$$;create table activities(id text);");
 await db.exec(fs.readFileSync('docs/live-updates/tyrant-news-links.sql','utf8'));
 const q=async(sql,p=[]) =>(await db.query(sql,p)).rows;
 const source='https://www.tesollo.com/news/press/robotic-hands';
 for(const url of require('../docs/live-updates/tyrant-producer-links.json'))assert.equal((await q('select public.is_tyrant_public_news_url($1) ok',[url]))[0].ok,true);
 const receive=async(url)=>(await q('select private.submit_tyrant_public_news($1) r',[url]))[0].r;
 const first=await receive(source);assert.equal(first.status,'link_only');assert.equal(first.financialTotalsEligible,false);assert.equal(first.headlineRequestQueued,true);
 assert.equal((await receive(source)).id,first.id);assert.equal((await q('select count(*)::int n from net.calls'))[0].n,1);
 assert.equal((await q('select count(*)::int n from tyrant_news_links'))[0].n,1);
 for(const bad of ['https://chatgpt.com/c/private','https://mail.google.com/mail/u/0','https://www.extendrobotics.com/news','https://www.tesollo.com/news/press/robotic-hands?token=private','https://127.0.0.1/news'])await assert.rejects(receive(bad));
 for(const role of ['anon','authenticated','service_role'])assert.equal((await q("select has_function_privilege($1,'private.submit_tyrant_public_news(text)','execute') ok",[role]))[0].ok,false);
 for(const role of ['anon','authenticated']){
  for(const privilege of ['select','insert','update','delete'])assert.equal((await q('select has_table_privilege($1,\'public.tyrant_news_links\',$2) ok',[role,privilege]))[0].ok,false);
  assert.equal((await q("select has_function_privilege($1,'public.claim_tyrant_news_headline(uuid)','execute') ok",[role]))[0].ok,false);
 }
 const claim=async()=>(await q('select public.claim_tyrant_news_headline($1) t',[first.id]))[0].t;
 const task=await claim();assert(task);assert.equal(await claim(),null);
 await assert.rejects(q('select public.finish_tyrant_news_headline($1,$2,$3,$4)',[first.id,task.leaseId,'PRIVATE@example.org','source_headline']));
 assert.equal((await q('select public.finish_tyrant_news_headline($1,$2,$3,$4) ok',[first.id,'00000000-0000-4000-8000-000000000000','Robotics source headline','source_headline']))[0].ok,false);
 await q('select public.finish_tyrant_news_headline($1,$2,null,$3)',[first.id,task.leaseId,'source_unavailable']);
 const retry=await claim();assert(retry);await q('select public.finish_tyrant_news_headline($1,$2,$3,$4)',[first.id,retry.leaseId,'Robotic hands project announced','source_headline']);
 assert.equal(await claim(),null);assert.equal((await q('select source_title from tyrant_news_links'))[0].source_title,'Robotic hands project announced');
 assert.equal((await q('select count(*)::int n from activities'))[0].n,0);
 // Local integration: the producer contract, real SQL lease/finish, public API
 // projection and its source headline operate together. This is not evidence
 // that the actual Tyrant instance has submitted anything.
 const news=require('../lib/tyrant-news'),graph=require('../lib/graph-api');
 const local=await receive('https://www.tesollo.com/news/press/local-pipeline');
 const outcome=await news.enrichNews({},local.id,{call:async(_config,name,body)=>{
  if(name==='claim_tyrant_news_headline')return(await q('select public.claim_tyrant_news_headline($1) r',[body.p_id]))[0].r;
  assert.equal(name,'finish_tyrant_news_headline');return(await q('select public.finish_tyrant_news_headline($1,$2,$3,$4) r',[body.p_id,body.p_lease,body.p_title,body.p_result]))[0].r;
 },read:async()=>({status:200,finalUrl:'https://www.tesollo.com/news/press/local-pipeline',text:'<title>Robotic systems enter field trials</title><p>Unpublished capture stays private</p>'})});
 assert.equal(outcome.status,'source_headline');
 const savedRequest=graph.restRequest,savedConfig=graph.getConfig;
 graph.getConfig=()=>({});graph.restRequest=async(_config,table)=>{assert.equal(table,'tyrant_news_links');return q('select *from tyrant_news_links where withdrawn_at is null');};
 try{
  const response={setHeader(){},end(body){this.body=JSON.parse(body);}};await news.handler({method:'GET',headers:{}},response);
  assert.equal(response.statusCode,200);const item=response.body.news.find(row=>row.id===local.id);assert.equal(item.headline,'Robotic systems enter field trials');assert.equal(item.financialTotalsEligible,false);
  assert.equal(JSON.stringify(response.body).includes('Unpublished capture'),false);assert.equal(JSON.stringify(response.body).includes('lease_'),false);
 }finally{graph.restRequest=savedRequest;graph.getConfig=savedConfig;}
 // Replaying a withdrawn source must never republish it.
 await q('update tyrant_news_links set withdrawn_at=now()where id=$1',[first.id]);assert.equal((await receive(source)).status,'withdrawn');
 for(let n=2;n<50;n++)await receive('https://www.tesollo.com/news/press/robotic-hands-'+n);
 await assert.rejects(receive('https://www.tesollo.com/news/press/robotic-hands-51'),/daily budget/);
 await db.close();console.log('Tyrant news SQL passed: owner-only URL handoff, exact source dedupe, one dispatch per retry window, 50/day, two attempts, leases, withdrawal, privacy ACLs and zero activity/financial writes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
