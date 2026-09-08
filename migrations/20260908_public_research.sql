begin;
alter table public.research_runs add column if not exists public_mode boolean not null default false;
create index if not exists research_runs_public_started on public.research_runs(started_at desc) where public_mode;
create table if not exists public.public_action_usage (
  bucket text primary key, hits integer not null default 0, expires_at timestamptz not null
);
alter table public.public_action_usage enable row level security;
revoke all on public.public_action_usage from public, anon, authenticated;
grant select, insert, update, delete on public.public_action_usage to service_role;
create or replace function public.consume_public_action(p_action text, p_actor text, p_hour_limit integer, p_day_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare hour_key text; day_key text; n integer;
begin
  if length(p_action) > 40 or length(p_actor) <> 64 or p_hour_limit < 1 or p_day_limit < 1 then return false; end if;
  -- Serializes both counters so concurrent serverless instances share one budget.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-action:' || p_action, 0));
  delete from public.public_action_usage where expires_at < now();
  hour_key := p_action || ':' || p_actor || ':' || to_char(now() at time zone 'UTC','YYYYMMDDHH24');
  day_key := p_action || ':global:' || to_char(now() at time zone 'UTC','YYYYMMDD');
  select hits into n from public.public_action_usage where bucket = hour_key;
  if coalesce(n,0) >= p_hour_limit then return false; end if;
  select hits into n from public.public_action_usage where bucket = day_key;
  if coalesce(n,0) >= p_day_limit then return false; end if;
  insert into public.public_action_usage(bucket,hits,expires_at) values(hour_key,1,now()+interval '2 days'),(day_key,1,now()+interval '2 days')
  on conflict(bucket) do update set hits = public.public_action_usage.hits + 1;
  return true;
end $$;
revoke all on function public.consume_public_action(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_public_action(text,text,integer,integer) to service_role;
create or replace function public.create_public_research_run(p_run jsonb, p_tasks jsonb, p_events jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  if length(p_run->>'prompt') not between 1 and 2000 or jsonb_array_length(p_tasks) > 20 then raise exception 'Invalid public research request'; end if;
  insert into public.research_runs select * from jsonb_populate_record(null::public.research_runs,
    jsonb_build_object('created_at',now(),'updated_at',now()) || p_run || jsonb_build_object('public_mode',true));
  insert into public.research_tasks select * from jsonb_populate_recordset(null::public.research_tasks,p_tasks);
  insert into public.research_events select * from jsonb_populate_recordset(null::public.research_events,p_events);
  return p_run->>'id';
end $$;
revoke all on function public.create_public_research_run(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_public_research_run(jsonb,jsonb,jsonb) to service_role;
commit;
