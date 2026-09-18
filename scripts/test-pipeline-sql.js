"use strict";
const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const {PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH || "@electric-sql/pglite");
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema private;create schema extensions;create schema cron;create schema net;create schema vault;
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create table public.ingestion_runs(id text primary key);
 create table public.graph_refresh_runs(id text default gen_random_uuid()::text,mode text,policy_id text,cadence text,status text,idempotency_key text);
 create unique index legacy_partial_refresh on public.graph_refresh_runs(idempotency_key) where idempotency_key is not null;
 create function extensions.digest(input text,algorithm text) returns bytea language sql immutable as $$select sha256(convert_to(input,'UTF8'))$$;
 create function extensions.digest(input bytea,algorithm text) returns bytea language sql immutable as $$select sha256(input)$$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
 create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
 create function extensions.hmac(text,text,text) returns bytea language sql as $$select convert_to('fixture','UTF8')$$;`);
 await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260910065510_physical_ai_ecosystem_v3.sql"),"utf8"));
 await db.exec(fs.readFileSync(path.join(__dirname,"../docs/live-feedback/pipeline-telemetry.sql"),"utf8"));
 const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
 await db.exec(`insert into public.ecosystem_snapshot_releases(version,manifest,is_public,active) values('test-base','{}',true,true);update public.ecosystem_settings set mode='auto';`);
 let weekly=(await query(`select public.acquire_ecosystem_run('2026-09-21') as run`))[0].run;
 assert.equal(weekly.planned,false);assert.equal(weekly.fetches,0);assert.equal(weekly.max_fetches,300);
 const sameDate=(await query(`select public.acquire_ecosystem_incremental_run('2026-09-21') as run`))[0].run;
 assert.equal(sameDate.cadence,"weekly");assert.equal(sameDate.max_fetches,300);assert.equal(sameDate.max_new_entities,80);assert.equal(sameDate.id,weekly.id);
 const later=(await query(`select public.acquire_ecosystem_incremental_run('2026-09-22') as run`))[0].run;
 assert.equal(later.id,weekly.id,"In-flight weekly work resumes unchanged even on a later date");assert.equal(later.max_fetches,300);
 await db.exec(`update public.ecosystem_runs set status='partial' where id='ecosystem-2026-09-21';`);
 const finished=(await query(`select public.acquire_ecosystem_incremental_run('2026-09-21') as run`))[0].run;
 assert.equal(finished.status,"partial");assert.equal(finished.cadence,"weekly");
 const daily=(await query(`select public.acquire_ecosystem_incremental_run('2026-09-22') as run`))[0].run;
 assert.equal(daily.cadence,"daily");assert.equal(daily.max_fetches,30);assert.equal(daily.max_new_entities,8);assert.equal(daily.base_version,"test-base");
 await db.exec(`set role service_role;insert into public.collector_checkpoints(id,checkpoint,status) values('test','{"selected":{"query":[{"id":"synthetic-private-id"}]}}','partial');reset role;`);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);let denied=false;try{await query('select * from public.collector_checkpoints');}catch(error){denied=true;}assert(denied,`${role} cannot read private checkpoints`);await db.exec('reset role');
  const grants=(await query(`select has_function_privilege($1,'public.acquire_ecosystem_incremental_run(date)','execute') as allowed`,[role]))[0];assert.equal(grants.allowed,false);
 }
 assert.equal((await query(`select has_function_privilege('service_role','public.acquire_ecosystem_incremental_run(date)','execute') as allowed`))[0].allowed,true);
 await db.exec(`create table private.physical_ai_scheduler_dispatches (
  job_name text check(job_name in ('ingest-gmail','ingest-web-news','graph-refresh-weekly','graph-refresh-monthly','graph-refresh-quarterly')),
  run_date date, request_id bigint unique, attempt_count smallint default 1,
  status text default 'pending',last_http_status integer,last_error text,
  first_dispatched_at timestamptz default now(),last_dispatched_at timestamptz default now(),completed_at timestamptz,primary key(job_name,run_date)
 );create table net._http_response(id bigint,status_code integer,error_msg text,timed_out boolean);
 insert into vault.decrypted_secrets(name,decrypted_secret) values('physical_ai_scheduler_v1',repeat('0',64));`);
 await db.exec(fs.readFileSync(path.join(__dirname,"../docs/live-feedback/pipeline-scheduler.sql"),"utf8"));
 const dispatch=(await query(`select * from private.dispatch_physical_ai_job('graph-refresh-daily')`))[0];
 assert.equal(dispatch.dispatched,true);assert.equal(dispatch.attempt_count,1);
 await db.exec(`insert into net._http_response(id,status_code,timed_out) values(1,200,false);`);
 const acknowledged=(await query(`select * from private.dispatch_physical_ai_job('graph-refresh-daily')`))[0];
 assert.equal(acknowledged.dispatched,false);assert.equal(acknowledged.dispatch_status,"succeeded");
 assert.equal((await query(`select has_function_privilege('anon','private.dispatch_physical_ai_job(text,date)','execute') as allowed`))[0].allowed,false);
 await db.close();console.log("pipeline SQL tests passed: existing weekly preserved, new daily bounded, private checkpoint ACLs");
})().catch(error=>{console.error(error);process.exitCode=1;});
