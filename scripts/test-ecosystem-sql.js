"use strict";
const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");const crypto=require("node:crypto");
// Optional standalone Postgres engine; no connection to the live database.
const {PGlite}=require(process.env.ECOSYSTEM_PGLITE_PATH || "@electric-sql/pglite");
async function main(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema extensions;create schema cron;create schema net;create schema vault;
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create table public.graph_refresh_runs(id text default gen_random_uuid()::text,mode text,policy_id text,cadence text,status text,idempotency_key text);
 create unique index legacy_partial_refresh on public.graph_refresh_runs(idempotency_key) where idempotency_key is not null;
 create function extensions.digest(input text,algorithm text) returns bytea language sql immutable as $$ select sha256(convert_to(input,'UTF8')) $$;
 create function extensions.digest(input bytea,algorithm text) returns bytea language sql immutable as $$ select sha256(input) $$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
 create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
 create function extensions.hmac(text,text,text) returns bytea language sql as $$select convert_to('fixture','UTF8')$$;`);
 const migration=fs.readFileSync(path.resolve(__dirname,"../supabase/migrations/20260910065510_physical_ai_ecosystem_v3.sql"),"utf8");await db.exec(migration);
 await db.exec(fs.readFileSync(path.resolve(__dirname,"../supabase/migrations/20260910074154_physical_ai_ecosystem_bootstrap_upload.sql"),"utf8"));
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 let r=await q("select public.acquire_graph_refresh_run('monthly','2026-09-10','policy','shadow',true) as result");assert.equal(r[0].result.acquired,true);
 r=await q("select public.acquire_graph_refresh_run('monthly','2026-09-10','policy','shadow',true) as result");assert.equal(r[0].result.acquired,false);
 const packageFor=version=>{const shards=["core","research","discovery"].map(name=>{const payload=JSON.stringify(name==="discovery"?{version}:{metadata:{snapshotVersion:version}});return {name,payload,sha256:crypto.createHash('sha256').update(payload).digest('hex')};});return {shards,manifest:{version,schemaVersion:"1.0.0",status:"published",shards:shards.map(({name,sha256})=>({name,sha256}))}};};
 let pack=packageFor('test-base');await q("select public.publish_ecosystem_snapshot($1,$2,null,null,true,null)",[JSON.stringify(pack.manifest),JSON.stringify(pack.shards)]);
 r=await q("select public.acquire_ecosystem_run('2026-09-10') as result");const run=r[0].result;assert.equal(run.mode,'shadow');
 r=await q("select public.acquire_ecosystem_run('2026-09-11') as result");assert.equal(r[0].result.id,run.id,'Later authentication date must resume old batch');
 assert.equal((await q("select public.seed_ecosystem_tasks($1,'[]',array['https://unprocessed.org']) as seeded",[run.id]))[0].seeded,true);
 assert.equal((await q("select public.seed_ecosystem_tasks($1,'[]',array['https://different.org']) as seeded",[run.id]))[0].seeded,false,'Run plan must freeze on first seed');
 assert.deepEqual((await q('select source_backlog from public.ecosystem_runs where id=$1',[run.id]))[0].source_backlog,['https://unprocessed.org']);
 for(let i=1;i<=4;i++)await q("insert into public.ecosystem_tasks(id,run_id,kind,source_id,input)values($1,$2,'source',$1,'{}')",['task-'+i,run.id]);
 const claim=async()=> (await q('select public.claim_ecosystem_task($1) as result',[run.id]))[0].result;
 const first=await claim(),second=await claim();assert(first&&second);assert.equal(await claim(),null,'At most two leased workers globally');
 assert.equal((await q("select public.finish_ecosystem_task($1,$2,'{}','checked',false) as ok",[first.id,crypto.randomUUID()]))[0].ok,false,'Wrong lease cannot finish');
 await q("update public.ecosystem_tasks set lease_until=now()-interval '1 second' where id=$1",[first.id]);
 assert.equal((await q("select public.finish_ecosystem_task($1,$2,'{}','checked',false) as ok",[first.id,first.locked_by]))[0].ok,false,'Expired lease cannot finish');
 const third=await claim();assert(third);
 await q("update public.ecosystem_tasks set status='checked',locked_by=null,lease_until=null");
 await q("insert into public.ecosystem_tasks(id,run_id,kind,source_id,input)values('retry-task',$1,'source','retry','{}')",[run.id]);
 const retry1=await claim();assert.equal(retry1.id,'retry-task');
 await q("select public.finish_ecosystem_task($1,$2,'{\"outcome\":\"unresolved\"}','failed',true)",[retry1.id,retry1.locked_by]);
 assert.equal(await claim(),null,'Retry cooldown cannot be bypassed');
 await q("update public.ecosystem_tasks set available_at=now()-interval '1 second' where id='retry-task'");
 const retry2=await claim();assert.equal(retry2.attempts,2);
 await q("update public.ecosystem_tasks set lease_until=now()-interval '1 second' where id='retry-task'");
 const retry3=await claim();assert.equal(retry3.attempts,3);
 await q("update public.ecosystem_tasks set lease_until=now()-interval '1 second' where id='retry-task'");
 assert.equal(await claim(),null);assert.equal((await q("select status from public.ecosystem_tasks where id='retry-task'"))[0].status,'failed','Third interruption is terminal with a real failure');
 await q("update public.ecosystem_runs set max_new_entities=1 where id=$1",[run.id]);
 let entity=(await q("select public.resolve_ecosystem_entity($1,'https://official.org/team/alice','person','Alice') as id",[run.id]))[0].id;assert.match(entity,/^ENT-/);
 assert.equal((await q("select public.resolve_ecosystem_entity($1,'https://official.org/team/alice','person','Alice') as id",[run.id]))[0].id,entity);
 await assert.rejects(q("select public.resolve_ecosystem_entity($1,'https://official.org/team/alice','company','Alice')",[run.id]),/kind\/name conflict/);
 await assert.rejects(q("select public.resolve_ecosystem_entity($1,'https://other.org/alice','person','Alice')",[run.id]),/duplicate identity/);
 assert.equal((await q("select public.resolve_ecosystem_entity($1,'https://official.org/team/bob','person','Bob') as id",[run.id]))[0].id,null,'New entity budget enforced atomically');
 const lock=(await q('select public.claim_ecosystem_publication($1) as result',[run.id]))[0].result;assert(lock);
 pack=packageFor('test-next');
 await assert.rejects(q('select public.publish_ecosystem_snapshot($1,$2,$3,$4,true,$5)',[JSON.stringify(pack.manifest),JSON.stringify(pack.shards),run.id,'test-base',crypto.randomUUID()]),/not active/);
 let damaged=structuredClone(pack.shards);damaged[0].payload='{}';await assert.rejects(q('select public.publish_ecosystem_snapshot($1,$2,$3,$4,false,$5)',[JSON.stringify(pack.manifest),JSON.stringify(damaged),run.id,'test-base',lock]),/hash mismatch/);
 assert.equal((await q('select version from public.ecosystem_snapshot_releases where active'))[0].version,'test-base','Corrupt publication must retain baseline');
 await q('select public.publish_ecosystem_snapshot($1,$2,$3,$4,false,$5)',[JSON.stringify(pack.manifest),JSON.stringify(pack.shards),run.id,'test-base',lock]);
 assert.equal((await q('select version from public.ecosystem_snapshot_releases where active'))[0].version,'test-base','Shadow must not activate');
 assert.equal((await q('select status from public.ecosystem_runs where id=$1',[run.id]))[0].status,'shadow');
 assert.equal((await q("select is_public from public.ecosystem_snapshot_releases where version='test-next'"))[0].is_public,false,'Shadow release cannot be read publicly');
 await assert.rejects(q("update public.ecosystem_snapshot_shards set payload='{}' where version='test-base'"),/immutable/);
 await assert.rejects(q("update public.ecosystem_snapshot_releases set manifest='{}' where version='test-base'"),/immutable/);
 for(const role of ['anon','authenticated']){assert.equal((await q("select has_table_privilege($1,'public.ecosystem_tasks','select') as allowed",[role]))[0].allowed,false);assert.equal((await q("select has_function_privilege($1,'public.publish_ecosystem_snapshot(jsonb,jsonb,text,text,boolean,uuid)','execute') as allowed",[role]))[0].allowed,false);}
 assert.equal((await q("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ecosystem_%' and c.relkind='r' and not c.relrowsecurity"))[0].n,0);
 const audit=(await q(fs.readFileSync(path.resolve(__dirname,'audit-ecosystem.sql'),'utf8')))[0].ecosystem_audit;assert.equal(audit.batch.status,'shadow');assert(!JSON.stringify(audit).includes('capture.text'));
 // Chunk transport is private, byte exact, resumable and publishes atomically.
 for(const role of ['anon','authenticated']) {
   for(const table of ['ecosystem_bootstrap_uploads','ecosystem_bootstrap_chunks'])assert.equal((await q('select has_table_privilege($1,$2,\'select\') as ok',[role,'public.'+table]))[0].ok,false);
   for(const fn of ['begin_ecosystem_bootstrap(uuid,text,integer,integer,text)','put_ecosystem_bootstrap_chunk(uuid,integer,text)','finish_ecosystem_bootstrap(uuid)'])assert.equal((await q('select has_function_privilege($1,$2,\'execute\') as ok',[role,'public.'+fn]))[0].ok,false);
 }
 const envelopeFor=version=>({...packageFor(version),sources:[{id:'UP-SOURCE',url:'https://example.org/reviewed',descriptor:{title:'Robots 🤖 '.repeat(6000)},last_checked_at:'2026-09-10',last_outcome:'checked'}],identifiers:[{identifier:'https://example.org/person',entity_id:'ENT-919999',kind:'person',canonical_name:'Élodie'}]});
 const stage=async(envelope,expected='test-base',overrideHash=null)=>{const bytes=Buffer.from(JSON.stringify(envelope)),id=crypto.randomUUID(),sha=overrideHash||crypto.createHash('sha256').update(bytes).digest('hex'),chunks=[];for(let i=0;i<bytes.length;i+=48000)chunks.push(bytes.subarray(i,i+48000).toString('base64'));await q('select public.begin_ecosystem_bootstrap($1,$2,$3,$4,$5)',[id,sha,bytes.length,chunks.length,expected]);return {id,chunks,sha,bytes};};
 const put=async(s,i,b=s.chunks[i])=>q('select public.put_ecosystem_bootstrap_chunk($1,$2,$3)',[s.id,i,b]);
 const finish=s=>q('select public.finish_ecosystem_bootstrap($1) as result',[s.id]);
 let upload=await stage(envelopeFor('upload-valid'));
 await put(upload,0);await put(upload,0); // interrupted uploader resumes exact chunk idempotently
 await assert.rejects(put(upload,0,Buffer.from('different').toString('base64')),/chunk conflict/);
 await assert.rejects(finish(upload),/incomplete/);
 assert.equal((await q('select version from public.ecosystem_snapshot_releases where active'))[0].version,'test-base');
 for(let i=1;i<upload.chunks.length;i++)await put(upload,i);
 const finished=(await finish(upload))[0].result;assert.equal(finished.published,true);assert.equal(finished.version,'upload-valid');assert.deepEqual((await finish(upload))[0].result,finished);
 assert.equal((await q('select count(*)::int n from public.ecosystem_bootstrap_chunks where upload_id=$1',[upload.id]))[0].n,0,'Successful upload clears private chunks');
 assert.equal((await q("select descriptor->>'title' title from public.ecosystem_sources where id='UP-SOURCE'"))[0].title,'Robots 🤖 '.repeat(6000),'Byte chunk boundaries preserve UTF8');
 upload=await stage(envelopeFor('upload-hash-bad'),'upload-valid','0'.repeat(64));for(let i=0;i<upload.chunks.length;i++)await put(upload,i);await assert.rejects(finish(upload),/hash mismatch/);
 const bad=envelopeFor('upload-shard-bad');bad.shards[0].payload='{}';bad.sources[0].id='UP-ROLLBACK';bad.sources[0].url='https://example.org/rollback';upload=await stage(bad,'upload-valid');for(let i=0;i<upload.chunks.length;i++)await put(upload,i);await assert.rejects(finish(upload),/Snapshot hash mismatch/);
 assert.equal((await q("select count(*)::int n from public.ecosystem_sources where id='UP-ROLLBACK'"))[0].n,0,'Failed publication rolls back registrations');
 assert.equal((await q('select version from public.ecosystem_snapshot_releases where active'))[0].version,'upload-valid');
 const dir=process.env.ECOSYSTEM_BOOTSTRAP_UPLOAD_DIR;
 if(dir){for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));const expected=JSON.parse(fs.readFileSync(path.join(dir,'upload-manifest.json'),'utf8'));assert.equal((await q('select version from public.ecosystem_snapshot_releases where active'))[0].version,expected.version);assert.equal((await q('select result->>\'sha256\' as sha from public.ecosystem_bootstrap_uploads where id=$1',[expected.uploadId]))[0].sha,expected.sha256);console.log('Real bootstrap artifact validated in PostgreSQL: '+expected.chunks+' chunks, '+expected.bytes+' bytes');}
 await db.close();console.log('ecosystem SQL tests passed: migration, partial-index acquisition, day rollover, leases, budgets, atomic publication, shadow, RLS/ACL');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
