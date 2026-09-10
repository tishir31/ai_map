-- Additive public snapshot and resumable public-source pipeline. No existing graph rows are modified.
begin;
create table public.ecosystem_settings (
  id boolean primary key default true check (id), policy_version integer not null default 3 check(policy_version=3),
  mode text not null default 'shadow' check(mode in ('shadow','auto','disabled')),
  max_fetches integer not null default 300 check(max_fetches between 1 and 300),
  max_new_entities integer not null default 80 check(max_new_entities between 0 and 80)
);
insert into public.ecosystem_settings(id) values(true);
create table public.ecosystem_snapshot_releases (
  version text primary key check(version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$'),
  manifest jsonb not null, is_public boolean not null default false, active boolean not null default false, created_at timestamptz not null default now()
);
create unique index ecosystem_single_active_snapshot on public.ecosystem_snapshot_releases(active) where active;
create table public.ecosystem_snapshot_shards (
  version text references public.ecosystem_snapshot_releases(version), name text check(name in ('core','research','discovery')),
  payload text not null, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), primary key(version,name),
  check(octet_length(payload)<=10000000)
);
create table public.ecosystem_runs (
  id text primary key, batch_date date not null unique, base_version text not null references public.ecosystem_snapshot_releases(version),
  status text not null default 'running' check(status in ('running','partial','failed','checked','published','shadow')),
  policy_version integer not null default 3, mode text not null check(mode in ('auto','shadow')),
  max_fetches integer not null, max_new_entities integer not null, fetches integer not null default 0,
  new_entities integer not null default 0, backlog integer not null default 0, planned boolean not null default false, source_backlog text[] not null default array[]::text[],
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  publication_lock uuid, publication_lease timestamptz, result jsonb not null default '{}'
);
create table public.ecosystem_sources (
  id text primary key, url text not null unique, descriptor jsonb not null, active boolean not null default true,
  last_checked_at timestamptz, content_hash text, last_outcome text
);
create table public.ecosystem_tasks (
  id text primary key, run_id text not null references public.ecosystem_runs(id), kind text not null check(kind in ('source','search')),
  source_id text, area_id text, input jsonb not null,
  status text not null default 'pending' check(status in ('pending','running','checked','unchanged','held','failed')),
  attempts integer not null default 0, locked_by uuid, lease_until timestamptz, available_at timestamptz not null default now(),
  result jsonb, updated_at timestamptz not null default now(), unique(run_id,kind,source_id)
);
create index ecosystem_task_queue on public.ecosystem_tasks(run_id,status,available_at);
create table public.ecosystem_entity_identifiers (
  identifier text primary key, entity_id text not null check(entity_id ~ '^ENT-[0-9]{4,}$'), kind text not null, canonical_name text not null
);
create sequence public.ecosystem_entity_sequence start with 910000;

-- All source captures, unpublished snapshots and task results are server-only.
do $$ declare t text; begin
  foreach t in array array['ecosystem_settings','ecosystem_snapshot_releases','ecosystem_snapshot_shards','ecosystem_runs','ecosystem_sources','ecosystem_tasks','ecosystem_entity_identifiers'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;
revoke all on sequence public.ecosystem_entity_sequence from public,anon,authenticated;
grant usage,select on sequence public.ecosystem_entity_sequence to service_role;

create or replace function public.ecosystem_snapshot_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$ begin
  if tg_op='DELETE' then raise exception 'Snapshot rows are immutable'; end if;
  if tg_table_name='ecosystem_snapshot_shards' then raise exception 'Snapshot shards are immutable'; end if;
  if old.version<>new.version or old.manifest<>new.manifest or old.is_public<>new.is_public then raise exception 'Snapshot release content is immutable'; end if;
  return new;
end $$;
create trigger ecosystem_shards_immutable before update or delete on public.ecosystem_snapshot_shards for each row execute function public.ecosystem_snapshot_immutable();
create trigger ecosystem_releases_immutable before update or delete on public.ecosystem_snapshot_releases for each row execute function public.ecosystem_snapshot_immutable();
revoke all on function public.ecosystem_snapshot_immutable() from public,anon,authenticated;
grant execute on function public.ecosystem_snapshot_immutable() to service_role;

-- Existing non-weekly graph routes use an atomic function, avoiding ON CONFLICT
-- inference against the legacy partial unique idempotency index.
create or replace function public.acquire_graph_refresh_run(p_cadence text,p_as_of date,p_policy_id text,p_mode text,p_scheduled boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.graph_refresh_runs; k text; begin
  k:=case when p_scheduled then 'graph-refresh:'||p_cadence||':'||p_as_of::text else null end;
  perform pg_advisory_xact_lock(hashtext(coalesce(k,'graph-refresh-manual')));
  if k is not null then select * into r from public.graph_refresh_runs where idempotency_key=k;
    if found then return jsonb_build_object('acquired',false,'run',to_jsonb(r)); end if;
  end if;
  insert into public.graph_refresh_runs(mode,policy_id,cadence,status,idempotency_key)
    values(p_mode,p_policy_id,p_cadence,'running',k) returning * into r;
  return jsonb_build_object('acquired',true,'run',to_jsonb(r));
end $$;

create or replace function public.acquire_ecosystem_run(p_batch_date date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_runs; s public.ecosystem_settings; v text; begin
  perform pg_advisory_xact_lock(hashtext('ecosystem_run'));
  select * into s from public.ecosystem_settings where id;
  if s.mode='disabled' then raise exception 'Ecosystem policy disabled'; end if;
  -- An authenticated request on a later UTC date resumes the original batch.
  select * into r from public.ecosystem_runs where status='running' order by batch_date limit 1;
  if found then return to_jsonb(r); end if;
  select * into r from public.ecosystem_runs where batch_date=p_batch_date;
  if found then return to_jsonb(r); end if;
  select version into v from public.ecosystem_snapshot_releases where active;
  if v is null then raise exception 'Bootstrap public snapshot required'; end if;
  insert into public.ecosystem_runs(id,batch_date,base_version,mode,max_fetches,max_new_entities)
    values('ecosystem-'||p_batch_date::text,p_batch_date,v,s.mode,s.max_fetches,s.max_new_entities) returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.seed_ecosystem_tasks(p_run_id text,p_tasks jsonb,p_backlog_urls text[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_runs; t jsonb; begin
  select * into r from public.ecosystem_runs where id=p_run_id for update;
  if r.id is null or r.status<>'running' or r.planned then return false; end if;
  if jsonb_array_length(p_tasks)>r.max_fetches+8 then raise exception 'Initial task budget exceeded'; end if;
  for t in select value from jsonb_array_elements(p_tasks) loop
    if t->>'run_id'<>p_run_id then raise exception 'Task run mismatch'; end if;
    insert into public.ecosystem_tasks(id,run_id,kind,source_id,area_id,input) values(t->>'id',p_run_id,t->>'kind',t->>'source_id',t->>'area_id',t->'input') on conflict(id) do nothing;
  end loop;
  update public.ecosystem_runs set planned=true,source_backlog=p_backlog_urls,backlog=cardinality(p_backlog_urls),updated_at=now() where id=p_run_id;
  return true;
end $$;

create or replace function public.claim_ecosystem_task(p_run_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.ecosystem_tasks; r public.ecosystem_runs; begin
  perform pg_advisory_xact_lock(hashtext('ecosystem_task_claim'));
  select * into r from public.ecosystem_runs where id=p_run_id for update;
  if r.status<>'running' then return null; end if;
  update public.ecosystem_tasks set status=case when attempts>=3 then 'failed' else 'pending' end,locked_by=null,lease_until=null,
    result=case when attempts>=3 then '{"outcome":"failed","error":"Task lease expired after three attempts"}'::jsonb else result end
    where status='running' and lease_until<=now();
  if (select count(*) from public.ecosystem_tasks where status='running' and lease_until>now())>=2 then return null; end if;
  select * into t from public.ecosystem_tasks where run_id=p_run_id and status='pending' and available_at<=now() and attempts<3
    and (kind='search' or r.fetches<r.max_fetches) order by attempts,updated_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.ecosystem_tasks set status='running',attempts=attempts+1,locked_by=gen_random_uuid(),lease_until=now()+interval '85 seconds',updated_at=now()
    where id=t.id returning * into t;
  update public.ecosystem_runs set fetches=fetches+case when t.kind='source' then 1 else 0 end,updated_at=now() where id=p_run_id;
  return to_jsonb(t);
end $$;

create or replace function public.finish_ecosystem_task(p_task_id text,p_lock uuid,p_result jsonb,p_status text,p_retry boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.ecosystem_tasks; begin
  select * into t from public.ecosystem_tasks where id=p_task_id and status='running' and locked_by=p_lock and lease_until>now() for update;
  if not found then return false; end if;
  if p_status not in ('checked','unchanged','held','failed') or octet_length(p_result::text)>1000000 then raise exception 'Invalid task result'; end if;
  update public.ecosystem_tasks set status=case when p_retry and attempts<3 then 'pending' else p_status end,result=p_result,
    available_at=now()+case when p_retry then interval '5 minutes' else interval '0 seconds' end,locked_by=null,lease_until=null,updated_at=now() where id=t.id;
  if t.kind='source' and p_status in ('checked','unchanged','held') then
    update public.ecosystem_sources set last_checked_at=now(),content_hash=p_result->>'contentHash',last_outcome=p_status where id=t.source_id;
  end if;
  update public.ecosystem_runs set updated_at=now() where id=t.run_id;
  return true;
end $$;

create or replace function public.resolve_ecosystem_entity(p_run_id text,p_identifier text,p_kind text,p_name text)
returns text language plpgsql security invoker set search_path='' as $$
declare found_id text; r public.ecosystem_runs; begin
  perform pg_advisory_xact_lock(hashtext('ecosystem_identity'));
  select entity_id into found_id from public.ecosystem_entity_identifiers where identifier=p_identifier;
  if found_id is not null then
    if not exists(select 1 from public.ecosystem_entity_identifiers where identifier=p_identifier and kind=p_kind and lower(canonical_name)=lower(p_name)) then raise exception 'Identifier kind/name conflict'; end if;
    return found_id;
  end if;
  if exists(select 1 from public.ecosystem_entity_identifiers where lower(canonical_name)=lower(p_name) and identifier<>p_identifier) then raise exception 'Possible duplicate identity'; end if;
  select * into r from public.ecosystem_runs where id=p_run_id for update;
  if r.id is null or r.status<>'running' or r.new_entities>=r.max_new_entities then return null; end if;
  if p_identifier !~ '^https://' or length(p_identifier)>2000 or p_kind not in ('person','company','lab','project','software','paper','dataset','model','benchmark') or length(p_name) not between 2 and 200 then raise exception 'Invalid entity identity'; end if;
  found_id:='ENT-'||nextval('public.ecosystem_entity_sequence')::text;
  insert into public.ecosystem_entity_identifiers values(p_identifier,found_id,p_kind,p_name);
  update public.ecosystem_runs set new_entities=new_entities+1 where id=p_run_id;
  return found_id;
end $$;

create or replace function public.claim_ecosystem_publication(p_run_id text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare lock_id uuid; begin
  perform pg_advisory_xact_lock(hashtext('ecosystem_publication'));
  if exists(select 1 from public.ecosystem_tasks where run_id=p_run_id and (status='running' or (status='pending' and exists(select 1 from public.ecosystem_runs r where r.id=p_run_id and (r.fetches<r.max_fetches or kind='search'))))) then return null; end if;
  update public.ecosystem_runs set publication_lock=gen_random_uuid(),publication_lease=now()+interval '85 seconds'
    where id=p_run_id and status='running' and (publication_lease is null or publication_lease<=now()) returning publication_lock into lock_id;
  return lock_id;
end $$;

create or replace function public.publish_ecosystem_snapshot(p_manifest jsonb,p_shards jsonb,p_run_id text default null,p_expected_version text default null,p_activate boolean default true,p_lock uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v text:=p_manifest->>'version'; current_v text; item jsonb; expected_hash text; existing public.ecosystem_snapshot_releases; begin
  perform pg_advisory_xact_lock(hashtext('ecosystem_snapshot_publish'));
  select version into current_v from public.ecosystem_snapshot_releases where active;
  if p_expected_version is distinct from current_v then raise exception 'Active snapshot changed during publication'; end if;
  if p_manifest->>'schemaVersion'<>'1.0.0' or jsonb_array_length(p_shards)<>3 or jsonb_array_length(p_manifest->'shards')<>3 then raise exception 'Incomplete snapshot manifest'; end if;
  if (select count(distinct x->>'name') from jsonb_array_elements(p_shards)x where x->>'name' in ('core','research','discovery'))<>3 then raise exception 'Incomplete snapshot shards'; end if;
  if p_run_id is not null and not exists(select 1 from public.ecosystem_runs where id=p_run_id and base_version=current_v and status='running' and publication_lock=p_lock and publication_lease>now()) then raise exception 'Publication run is not active'; end if;
  if p_run_id is not null and p_activate and not exists(select 1 from public.ecosystem_runs where id=p_run_id and mode='auto') then raise exception 'Shadow runs cannot activate snapshots'; end if;
  select * into existing from public.ecosystem_snapshot_releases where version=v;
  if found then
    if existing.manifest<>p_manifest then raise exception 'Snapshot versions are immutable'; end if;
    return existing.manifest;
  end if;
  for item in select value from jsonb_array_elements(p_shards) loop
    select x->>'sha256' into expected_hash from jsonb_array_elements(p_manifest->'shards')x where x->>'name'=item->>'name';
    if item->>'sha256' is distinct from expected_hash or encode(extensions.digest(item->>'payload','sha256'),'hex') is distinct from expected_hash then raise exception 'Snapshot hash mismatch'; end if;
    if item->>'name'='discovery' then
      if (item->>'payload')::jsonb->>'version' is distinct from v then raise exception 'Discovery version mismatch'; end if;
    elsif (item->>'payload')::jsonb#>>'{metadata,snapshotVersion}' is distinct from v then raise exception 'Graph version mismatch'; end if;
  end loop;
  insert into public.ecosystem_snapshot_releases(version,manifest,is_public) values(v,p_manifest,p_activate);
  insert into public.ecosystem_snapshot_shards(version,name,payload,sha256) select v,x->>'name',x->>'payload',x->>'sha256' from jsonb_array_elements(p_shards)x;
  if p_activate then
    update public.ecosystem_snapshot_releases set active=false where active;
    update public.ecosystem_snapshot_releases set active=true where version=v;
  end if;
  if p_run_id is not null then update public.ecosystem_runs set status=case when p_activate then case when p_manifest->>'status'='partial' then 'partial' else 'published' end else 'shadow' end,completed_at=now(),updated_at=now(),result=jsonb_build_object('manifest',p_manifest,'activated',p_activate),publication_lock=null,publication_lease=null where id=p_run_id; end if;
  return p_manifest;
end $$;

-- Resume only unfinished batches, using today's HMAC and the batch's persisted identity.
create or replace function private.resume_physical_ai_ecosystem()
returns bigint language plpgsql security invoker set search_path='' as $$
declare root_secret text; token text; today text; request_id bigint; begin
  if not exists(select 1 from public.ecosystem_runs where status='running') then return null; end if;
  select decrypted_secret into strict root_secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
  if root_secret !~ '^[a-f0-9]{64}$' then raise exception 'Invalid scheduler credential'; end if;
  today:=(now() at time zone 'utc')::date::text;
  token:=encode(extensions.hmac('physical-ai-scheduler|v1|graph-refresh-weekly|'||today,root_secret,'sha256'),'hex');
  select net.http_get(url:='https://ai-map-cyan.vercel.app/api/graph-refresh-weekly',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','graph-refresh-weekly','x-physical-ai-run-key','graph-refresh-weekly:'||today),timeout_milliseconds:=80000) into request_id;
  return request_id;
end $$;
revoke all on function private.resume_physical_ai_ecosystem() from public,anon,authenticated,service_role;
select cron.schedule('physical-ai-ecosystem-resume','*/2 * * * *','select private.resume_physical_ai_ecosystem()');

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('acquire_graph_refresh_run','seed_ecosystem_tasks','acquire_ecosystem_run','claim_ecosystem_task','finish_ecosystem_task','resolve_ecosystem_entity','claim_ecosystem_publication','publish_ecosystem_snapshot') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
