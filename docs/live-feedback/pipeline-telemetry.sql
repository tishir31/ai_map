-- Operational artifact: generate the migration filename with `supabase migration new pipeline_telemetry`
-- then copy this SQL into that file. Apply only after review; no production changes were made.
begin;
alter table public.ingestion_runs add column if not exists stop_reason text;
alter table public.ingestion_runs add column if not exists processed_items integer check (processed_items >= 0);
alter table public.ingestion_runs add column if not exists requested_items integer check (requested_items >= 0);
-- Cursor keys can contain Gmail IDs and query text. Never place them in ingestion_runs,
-- the public health payload, snapshot shards or any authenticated/public readable table.
create table if not exists public.collector_checkpoints (
 id text primary key,
 checkpoint jsonb not null default '{"processed":{},"completed":[]}'::jsonb,
 status text not null check(status in ('completed','partial','failed')),
 updated_at timestamptz not null default now()
);
alter table public.collector_checkpoints enable row level security;
revoke all on table public.collector_checkpoints from public,anon,authenticated;
grant all on table public.collector_checkpoints to service_role;
alter table public.ecosystem_runs add column if not exists cadence text not null default 'weekly' check(cadence in ('daily','weekly'));
create or replace function public.acquire_ecosystem_incremental_run(p_batch_date date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_runs; settings public.ecosystem_settings; active_version text; begin
  -- Match the weekly acquisition lock. Never recategorize or shrink an existing batch,
  -- even if a weekly caller has acquired it but has not yet planned its tasks.
  perform pg_advisory_xact_lock(hashtext('ecosystem_run'));
  select * into settings from public.ecosystem_settings where id;
  if settings.mode='disabled' then raise exception 'Ecosystem policy disabled'; end if;
  select * into r from public.ecosystem_runs where status='running' order by batch_date limit 1;
  if found then return to_jsonb(r); end if;
  select * into r from public.ecosystem_runs where batch_date=p_batch_date;
  if found then return to_jsonb(r); end if;
  select version into active_version from public.ecosystem_snapshot_releases where active;
  if active_version is null then raise exception 'Bootstrap public snapshot required'; end if;
  insert into public.ecosystem_runs(id,batch_date,base_version,mode,cadence,max_fetches,max_new_entities)
    values('ecosystem-'||p_batch_date::text,p_batch_date,active_version,settings.mode,'daily',least(settings.max_fetches,30),least(settings.max_new_entities,8)) returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.acquire_ecosystem_incremental_run(date) from public,anon,authenticated;
grant execute on function public.acquire_ecosystem_incremental_run(date) to service_role;
alter table public.ecosystem_sources add column if not exists last_attempt_at timestamptz;
alter table public.ecosystem_sources add column if not exists retry_after timestamptz;
create or replace function public.finish_ecosystem_task(p_task_id text,p_lock uuid,p_result jsonb,p_status text,p_retry boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.ecosystem_tasks; begin
  select * into t from public.ecosystem_tasks where id=p_task_id and status='running' and locked_by=p_lock and lease_until>now() for update;
  if not found then return false; end if;
  if p_status not in ('checked','unchanged','held','failed') or octet_length(p_result::text)>1000000 then raise exception 'Invalid task result'; end if;
  update public.ecosystem_tasks set status=case when p_retry and attempts<3 then 'pending' else p_status end,result=p_result,
    available_at=now()+case when p_retry then interval '5 minutes' else interval '0 seconds' end,locked_by=null,lease_until=null,updated_at=now() where id=t.id;
  if t.kind='source' and p_status in ('checked','unchanged','held') then
    update public.ecosystem_sources set last_attempt_at=now(),retry_after=null,last_checked_at=now(),content_hash=p_result->>'contentHash',last_outcome=p_status where id=t.source_id;
  end if;
  if t.kind='source' and p_status='failed' then
    update public.ecosystem_sources set last_attempt_at=now(),last_outcome='failed',retry_after=now()+case when p_retry then interval '1 day' else interval '7 days' end where id=t.source_id;
  end if;
  update public.ecosystem_runs set updated_at=now() where id=t.run_id;
  return true;
end $$;

revoke all on function public.finish_ecosystem_task(text,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_ecosystem_task(text,uuid,jsonb,text,boolean) to service_role;
commit;
