const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema extensions;create function extensions.digest(text,text)returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;");
 for(const file of ['docs/daily-market-review/test-base-schema.sql','docs/daily-market-review/review-schema.sql','docs/live-updates/market-refresh.sql','docs/live-updates/market-transaction-review.sql','docs/live-updates/market-review-dispositions.sql']){if(file.includes('review-schema'))await db.exec('create table ingestion_runs(id text,status text)');await db.exec(fs.readFileSync(file,'utf8'));}
 const q=async(sql,p=[]) =>(await db.query(sql,p)).rows;
 await q("insert into market_review_daily_budget(budget_date,task_ids,attempts)values(current_date-1,array(select 'historic-'||n from generate_series(1,10)n),20)");
 await db.exec(fs.readFileSync('docs/live-updates/market-review-capacity.sql','utf8'));
 assert.equal((await q('select attempts from market_review_daily_budget where budget_date=current_date-1'))[0].attempts,20);
 for(let i=0;i<34;i++)await q("insert into review_queue_items(id,candidate_company,candidate_counterparty,candidate_date,activity_type,subsector,geography,description,source_type,source_url,snippet,extracted_text,confidence)values($1,'Known Robotics','N/A',current_date,'financing','robotics','US','Public financing','press release','https://issuer.example/news','Public','Public','reported')",['rq-'+i]);
 await q("insert into review_queue_items(id,candidate_company,candidate_counterparty,candidate_date,activity_type,subsector,geography,description,source_type,source_url,snippet,extracted_text,confidence,gmail_message_id)values('private','Private','N/A',current_date,'financing','robotics','N/A','PRIVATE','Gmail','gmail:PRIVATE','PRIVATE','PRIVATE','reported','PRIVATE')");
 const day=(await q('select current_date::text d'))[0].d;
 const run=(await q('select acquire_market_review_run($1)r',[day]))[0].r;assert.equal(run.selected,32);
 assert.equal(JSON.stringify(await q('select input from market_review_tasks')).includes('PRIVATE'),false);
 for(let i=0;i<32;i++){
  let t=(await q('select claim_market_review_task($1)t',[run.id]))[0].t;assert(t);assert.equal((await q('select claim_market_review_task($1)t',[run.id]))[0].t,null);
  await q('select finish_market_review_task($1,$2,$3)',[t.id,t.locked_by,JSON.stringify({disposition:'error',reason:'provider_timeout'})]);
  await q('update market_review_tasks set available_at=now() where id=$1',[t.id]);
  const retry=(await q('select claim_market_review_task($1)t',[run.id]))[0].t;assert.equal(retry.id,t.id);assert.equal(retry.attempts,2);
  await q('select finish_market_review_task($1,$2,$3)',[retry.id,retry.locked_by,JSON.stringify({disposition:'held',reason:'source_evidence_required'})]);
 }
 assert.equal((await q('select attempts from market_review_daily_budget where budget_date=current_date'))[0].attempts,64);
 assert.equal((await q('select acquire_market_review_run($1)r',[day]))[0].r.selected,32);
 assert.equal((await q('select claim_market_review_task($1)t',[run.id]))[0].t,null);
 assert.equal((await q("select count(*)::int n from review_queue_items where status='held'"))[0].n,32);
 for(const role of ['anon','authenticated'])assert.equal((await q("select has_function_privilege($1,'public.claim_market_review_task(text)','execute')ok",[role]))[0].ok,false);
 await assert.rejects(q('update market_review_daily_budget set attempts=65 where budget_date=current_date'));
 await db.close();console.log('Review capacity passed: 32 frozen public candidates, 64 maximum attempts, two per candidate, one lease, private exclusion, retained history and unchanged ACL/publication gates.');
})().catch(e=>{console.error(e.message,e.stack);process.exitCode=1;});
