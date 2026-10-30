'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH||'@electric-sql/pglite');
const worker=require('../lib/cloud-market-research');
async function setup(){
 const db=new PGlite(),q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema extensions;create schema private;create schema cron;create schema vault;create schema net;
 create function extensions.digest(text,text)returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
 create function extensions.gen_random_uuid()returns uuid language sql as $$select gen_random_uuid()$$;
 create table cron.job(jobname text,active boolean);create table vault.decrypted_secrets(name text,decrypted_secret text);
 create function extensions.hmac(text,text,text)returns bytea language sql as $$select sha256(convert_to($1||$2,'UTF8'))$$;
 create table net.requests(id bigserial,url text,headers jsonb);
 create function net.http_get(url text,headers jsonb,timeout_milliseconds int)returns bigint language sql as $$insert into net.requests(url,headers)values($1,$2)returning id$$;
 create table public.audit_log(id bigserial,table_name text,row_id text,action text,"before"jsonb,"after"jsonb);`);
 for(const p of ['docs/daily-market-review/test-base-schema.sql','docs/daily-market-review/review-schema.sql','docs/live-updates/market-refresh.sql','docs/live-updates/market-transaction-review.sql','docs/live-updates/market-review-dispositions.sql','docs/cloud-market-research/schema.sql']){
  if(p.includes('review-schema'))await db.exec('create table ingestion_runs(id text,status text)');
  await db.exec(fs.readFileSync(p,'utf8'));
 }
 return{db,q,day:(await q('select current_date::text as d'))[0].d};
}
(async()=>{
 const x=await setup();
 for(const role of ['anon','authenticated']){
  assert.equal((await x.q("select has_function_privilege($1,'public.claim_cloud_market_task()','execute') as allowed",[role]))[0].allowed,false);
  await x.db.exec('set role '+role);await assert.rejects(x.q('select * from cloud_market_tasks'));await x.db.exec('reset role');
 }
 const task=(await x.q('select claim_cloud_market_task()t'))[0].t;assert.equal(task.kind,'discover');assert.equal((await x.q('select count(*)::int n from cloud_market_tasks'))[0].n,6);assert.equal((await x.q('select claim_cloud_market_task()t'))[0].t,null);
 await x.q('select finish_cloud_market_task($1,$2,$3)',[task.id,task.locked_by,JSON.stringify({disposition:'discovered',items:[{company:'Test Robotics',date:x.day,type:'partnership',url:'https://testrobotics.com/news/pilot',summary:'A robotics pilot',title:'Test pilot'}]})]);
 assert.equal((await x.q('select count(*)::int n from review_queue_items'))[0].n,1);
 await x.db.exec("update cloud_market_tasks set status='completed'where kind='discover';insert into companies(id,name,overview,subsector,geography,website)values('c-test','Test Robotics','Autonomous robots','robotics','United States','https://testrobotics.com');");
 let t=(await x.q('select claim_cloud_market_task()t'))[0].t;assert.equal(t.input.company.id,'c-test');
 const event='Test Robotics announced a partnership with Acme to pilot autonomous warehouse robots in 2027.',physical='Test Robotics develops autonomous warehouse robots.';
 const page={status:200,finalUrl:'https://testrobotics.com/news/pilot',text:`${x.day}. ${event} ${physical}`};
 const e={qualifying:true,date:x.day,dateQuote:x.day,issuerQuote:'Test Robotics',eventQuote:event,physicalQuote:physical,type:'partnership',counterparty:'Acme',summary:'Test Robotics announced a warehouse robotics pilot with Acme planned for 2027. The source does not establish an operating deployment.',status:'planned'};
 const check={supported:true,identityCorrect:true,dateCorrect:true,typeCorrect:true,statusCorrect:true,physicalRelevance:true,noUnsupportedClaims:true,noConflict:true,issues:[]};
 const result=worker.verifyEditorial(t.input.company,page,e,check,x.day);assert.equal(result.disposition,'published');result.activity.id='a-cloud-'+'a'.repeat(24);result.activity.source_id='s-cloud-'+'a'.repeat(24);
 for(const key of ['captureHash','eventDate','issuerQuote','verification','summary']){
  const broken=structuredClone(result);broken.evidence[key]=key==='verification'?{...check,supported:false}:'bad';
  await assert.rejects(x.q('select finish_cloud_market_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify(broken)]),undefined,key);
  assert.equal((await x.q('select count(*)::int n from activities'))[0].n,0);
 }
 await x.q('select finish_cloud_market_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify(result)]);
 await x.q('select finish_cloud_market_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify(result)]);
 assert.equal((await x.q('select count(*)::int n from activities'))[0].n,1);assert.equal((await x.q('select deal_value_usd from activities'))[0].deal_value_usd,null);
 assert.equal((await x.q('select count(*)::int n from audit_log'))[0].n,1);
 assert.equal((await x.q('select status from review_queue_items'))[0].status,'approved');
 // Lease recovery is bounded, and running work is never claimed twice.
 await x.q("insert into cloud_market_tasks(id,run_id,kind,input,status,attempts,lease_until)values('expired',$1,'discover',$2,'running',2,now()-interval'1 second')",[t.run_id,JSON.stringify({topic:0,window:{start:x.day,end:x.day}})]);
 t=(await x.q('select claim_cloud_market_task()t'))[0].t;assert.equal(t.id,'expired');assert.equal(t.attempts,3);
 await assert.rejects(x.q('select finish_cloud_market_task($1,$2,$3)',[t.id,'11111111-1111-1111-1111-111111111111',JSON.stringify({disposition:'error',reason:'provider_timeout'})]));
 await x.q('select finish_cloud_market_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify({disposition:'error',reason:'provider_timeout'})]);
 assert.equal((await x.q("select status from cloud_market_tasks where id='expired'"))[0].status,'pending');
 const state=(await x.q('select cloud_market_status()s'))[0].s;assert.equal(state.execution,'cloud');assert.equal(state.cadenceHours,4);
 await x.db.close();console.log('Cloud SQL checks passed: discovery, private ACL, serial leases, publication, independent evidence gates, exact audit, idempotency, retries and status.');
})().catch(e=>{console.error(e.message);process.exit(1);});
