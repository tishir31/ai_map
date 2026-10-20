'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH||'@electric-sql/pglite');
const transaction=require('../lib/market-transaction-evidence');
async function setup(){
 const db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema extensions;create function extensions.digest(text,text)returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;");
 await db.exec(fs.readFileSync('docs/daily-market-review/test-base-schema.sql','utf8'));
 await db.exec('create table ingestion_runs(id text primary key,source_name text,source_type text,query text,started_at timestamptz,completed_at timestamptz,candidates_found integer,deduped_count integer,status text,llm_enriched_count integer,llm_rejected_count integer,llm_failed_count integer,stop_reason text,processed_items integer,requested_items integer);');
 for(const f of ['docs/daily-market-review/review-schema.sql','docs/live-updates/market-refresh.sql','docs/live-updates/market-transaction-review.sql','supabase/migrations/20261019214026_atlas_live_refresh_source_resolution.sql','supabase/migrations/20261020001800_market_uncrewed_application_evidence.sql','docs/collector-reliability/schema.sql','docs/live-updates/market-recovery-cycle.sql','docs/live-updates/market-recovery-facility-wording.sql'])await db.exec(fs.readFileSync(f,'utf8'));
 const q=async(s,p=[]) =>(await db.query(s,p)).rows;
 return {db,q,day:(await q('select current_date::text d'))[0].d};
}
async function begin(x){const id='market-recovery-'+x.day+'-test';await x.q('select begin_market_recovery_batch($1,$2,$3,$4)',[id,JSON.stringify([{name:'Public source',query:'robots funding'}]),JSON.stringify({startDate:x.day,endDate:x.day}),'Explicit user-authorized catch-up verification']);return id;}
async function completeCollection(x,id){const t=(await x.q('select claim_web_recovery_task($1)t',[id]))[0].t;await x.q('select finish_web_recovery_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify({disposition:'feed-completed',items:[]})]);}
async function stage(x,id,extra={}){const row={id,candidate_company:'Known Robotics',candidate_counterparty:'N/A',candidate_date:x.day,activity_type:'financing',subsector:'robotics',deal_value_usd:75000000,geography:'United States',description:'Known Robotics financing',source_type:'press release',source_url:'https://known-robotics.com/news/round',snippet:'Public financing',extracted_text:'Public financing',confidence:'reported',status:'pending',...extra};await x.q('insert into review_queue_items select(jsonb_populate_record(null::review_queue_items,$1)).*',[JSON.stringify(row)]);}
(async()=>{
 const x=await setup();await x.q("insert into companies(id,name,overview,subsector,geography,website)values('c-known','Known Robotics','Autonomous industrial robots','robotics','United States','https://known-robotics.com')");
 await x.q("insert into ingestion_runs(id,status)values($1,'partial')",['run-web-scheduled-'+x.day]);
 await x.q("insert into market_review_daily_budget(budget_date,attempts,task_ids)values($1,20,array(select 'daily-'||n from generate_series(1,10)n))",[x.day]);
 await stage(x,'rq-proof');await stage(x,'rq-held',{candidate_date:'2020-01-01'});await stage(x,'rq-private',{gmail_message_id:'PRIVATE-ID',source_type:'Gmail',description:'PRIVATE-BODY'});
 const id=await begin(x);await assert.rejects(x.q('select acquire_market_recovery_review($1)',[id]));await completeCollection(x,id);
 await begin(x);assert.equal((await x.q('select count(*)::int n from web_recovery_tasks'))[0].n,1,'rerun must not replace frozen source tasks');
 await x.q('select acquire_market_recovery_review($1)',[id]);assert.equal((await x.q('select selected from market_recovery_runs'))[0].selected,2);
 let t=(await x.q('select claim_market_recovery_task($1)t',[id]))[0].t;assert.equal(t.candidate_id,'rq-proof');assert.equal((await x.q('select claim_market_recovery_task($1)t',[id]))[0].t,null,'one live lease');
 const company=t.input.company,page={status:200,finalUrl:company.website+'/news/round',text:`${x.day}. Known Robotics has entered into a $75 million unsecured financing facility to support the development of its uncrewed surface vessel technology. Known Robotics builds autonomous industrial robots.`};
 const result=transaction.verifyTransaction(t.input.candidate,company,page,transaction.extractTransaction(page,company,x.day),x.day);assert.equal(result.disposition,'published');
 await assert.rejects(x.q('select finish_market_recovery_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify({...result,evidence:{...result.evidence,amountNative:90000000}})]));
 await x.q('select finish_market_recovery_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify(result)]);await x.q('select finish_market_recovery_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify(result)]);
 assert.equal((await x.q('select count(*)::int n from activities'))[0].n,1,'idempotent source-gated publication');assert.match((await x.q('select description from activities'))[0].description,/announced .*debt financing/);assert.doesNotMatch((await x.q('select description from activities'))[0].description,/closed/);
 t=(await x.q('select claim_market_recovery_task($1)t',[id]))[0].t;await x.q('select finish_market_recovery_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify({disposition:'held',reason:'historical_source_review_required'})]);
 await x.q('select close_market_recovery_batch($1)',[id]);await x.q('select close_market_recovery_batch($1)',[id]);assert.equal((await x.q("select status from review_queue_items where id='rq-held'"))[0].status,'held');
 assert.equal((await x.q("select status from review_queue_items where id='rq-private'"))[0].status,'pending','private queue unchanged');
 assert.equal((await x.q('select attempts from market_review_daily_budget'))[0].attempts,20,'daily budget untouched');
 assert.equal((await x.q('select status from ingestion_runs where id=$1',['run-web-scheduled-'+x.day]))[0].status,'partial','daily history untouched');
 assert.equal((await x.q('select status from market_recovery_runs'))[0].status,'completed');
 for(const role of ['anon','authenticated']){
  assert.equal((await x.q("select has_function_privilege($1,'public.begin_market_recovery_batch(text,jsonb,jsonb,text)','EXECUTE')ok",[role]))[0].ok,false);
  await x.db.exec('set role '+role);await assert.rejects(x.q('select *from market_recovery_review_tasks'));await x.db.exec('reset role');
 }
 await x.db.close();console.log('Recovery SQL passed: frozen operator selection, source-gated atomic publication, invalid evidence rollback, idempotence, leases, private exclusion, dispositions, independent budgets/history and RLS.');
})().catch(e=>{console.error(e.message,e.stack);process.exitCode=1;});
