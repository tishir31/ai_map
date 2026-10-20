-- Hourly public collection with immutable per-hour selections. No old task,
-- disposition, approval or daily ledger is reset. Existing daily launch job is reused.
begin;
alter table public.web_collection_runs drop constraint web_collection_runs_planned_queries_check;
alter table public.web_collection_runs add constraint web_collection_runs_planned_queries_check check(planned_queries between 1 and 32);
alter table public.web_collection_runs drop constraint web_collection_runs_selected_check;
alter table public.web_collection_runs add constraint web_collection_runs_selected_check check(selected between 0 and 128);
alter table public.web_collection_daily_budget drop constraint web_collection_daily_budget_feed_attempts_check;
alter table public.web_collection_daily_budget add constraint web_collection_daily_budget_feed_attempts_check check(feed_attempts between 0 and 64);
alter table public.web_collection_daily_budget drop constraint web_collection_daily_budget_item_attempts_check;
alter table public.web_collection_daily_budget add constraint web_collection_daily_budget_item_attempts_check check(item_attempts between 0 and 256);
alter table public.market_review_runs drop constraint market_review_runs_selected_check;
alter table public.market_review_runs add constraint market_review_runs_selected_check check(selected between 0 and 128);
alter table public.market_review_daily_budget drop constraint market_review_daily_budget_attempts_check;
alter table public.market_review_daily_budget add constraint market_review_daily_budget_attempts_check check(attempts between 0 and 256);
alter table public.market_review_daily_budget drop constraint market_review_daily_budget_task_ids_check;
alter table public.market_review_daily_budget add constraint market_review_daily_budget_task_ids_check check(cardinality(task_ids)<=128);
create table public.web_collection_slots(slot text primary key,run_id text not null references public.web_collection_runs(id),created_at timestamptz not null default now());
alter table public.web_collection_slots enable row level security;
revoke all on public.web_collection_slots from public,anon,authenticated;
grant select,insert on public.web_collection_slots to service_role;

create or replace function public.acquire_web_collection_run(p_run_date date,p_plan jsonb)returns jsonb language plpgsql security invoker set search_path=''as $$
declare r public.web_collection_runs;src jsonb;slot_key text:=to_char(now()at time zone'utc','YYYY-MM-DD-HH24');begin
 if p_run_date is null or p_run_date<>(now()at time zone'utc')::date then raise exception 'Current UTC day required';end if;
 if jsonb_typeof(p_plan)is distinct from'object'or jsonb_typeof(p_plan->'sources')is distinct from'array'or jsonb_array_length(p_plan->'sources')<>1
  or p_plan->'window'->>'endDate'is distinct from p_run_date::text
  or coalesce(p_plan->'window'->>'startDate','')!~'^\d{4}-\d{2}-\d{2}$'or(p_plan->'window'->>'startDate')::date not between p_run_date-30 and p_run_date then raise exception 'One bounded hourly public query required';end if;
 src:=p_plan->'sources'->0;
 if jsonb_typeof(src)is distinct from'object'or length(coalesce(src->>'query',''))not between 1 and 1000 or length(coalesce(src->>'name',''))not between 1 and 150 or src::text~*'(gmail:|@|forwarded message)'then raise exception 'Public source plan required';end if;
 perform pg_advisory_xact_lock(hashtext('web_collection_run'));
 select *into r from public.web_collection_runs where status='running'order by run_date limit 1;if found then return to_jsonb(r);end if;
 select *into r from public.web_collection_runs where run_date=p_run_date;
 if not found then
  insert into public.web_collection_runs(id,run_date,"window",planned_queries)values('web-collection-'||p_run_date,p_run_date,p_plan->'window',1)returning *into r;
 else
  if exists(select 1 from public.web_collection_slots where slot=slot_key)or r.planned_queries>=32 then return to_jsonb(r);end if;
  update public.web_collection_runs set status='running',planned_queries=planned_queries+1,completed_at=null where id=r.id returning *into r;
 end if;
 insert into public.web_collection_slots(slot,run_id)values(slot_key,r.id);
 insert into public.web_collection_tasks(id,run_id,kind,input)values(r.id||'-hour-'||slot_key,r.id,'feed',src||jsonb_build_object('order',r.planned_queries));
 return public.summarize_web_collection_run(r.id);
end$$;
-- Preserve earlier legacy/recovery telemetry under its original ID.
do $$declare f text;d text;begin
 foreach f in array array['public.summarize_web_collection_run(text)','public.claim_web_collection_task(text)','private.resume_physical_ai_web_collection()','public.acquire_market_review_run(date)','public.claim_market_review_task(text)','private.resume_physical_ai_market_review()','public.backlog_triage_summary()']loop
  select pg_get_functiondef(f::regprocedure)into d;
  d:=replace(d,'''run-web-scheduled-''||r.run_date','''run-web-hourly-''||r.run_date');
  d:=replace(replace(replace(replace(d,'b.feed_attempts<16','b.feed_attempts<64'),'b.item_attempts<64','b.item_attempts<256'),'coalesce(b.feed_attempts,0)<16','coalesce(b.feed_attempts,0)<64'),'coalesce(b.item_attempts,0)<64','coalesce(b.item_attempts,0)<256');
  d:=replace(replace(replace(replace(replace(replace(replace(replace(replace(d,'v.selected>=32','v.selected>=128'),'32-v.selected','128-v.selected'),'b.attempts>=64','b.attempts>=256'),'cardinality(b.task_ids)<32','cardinality(b.task_ids)<128'),'v.selected>=10','v.selected>=128'),'10-v.selected','128-v.selected'),'b.attempts>=20','b.attempts>=256'),'cardinality(b.task_ids)<10','cardinality(b.task_ids)<128'),',0)<10',',0)<128');
  execute d;
 end loop;
end$$;
create function private.dispatch_physical_ai_web_check()returns bigint language plpgsql security invoker set search_path=''as $$
declare secret text;token text;today text:=(now()at time zone'utc')::date::text;begin
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|ingest-web-news|'||today,secret,'sha256'),'hex');
 return net.http_get(url:='https://ai-map-cyan.vercel.app/api/ingest-web-news',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','ingest-web-news','x-physical-ai-run-key','ingest-web-news:'||today),timeout_milliseconds:=80000);
end$$;
revoke all on function private.dispatch_physical_ai_web_check()from public,anon,authenticated,service_role;
select cron.schedule('physical-ai-ingest-web-news-daily','15,20,25 * * * *',$job$select private.dispatch_physical_ai_web_check();$job$);
create or replace function public.web_collection_scheduler_status()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('configured',exists(select 1 from cron.job where jobname='physical-ai-ingest-web-news-daily'and active and schedule='15,20,25 * * * *')and exists(select 1 from cron.job where jobname='physical-ai-ecosystem-resume'and active and schedule='*/2 * * * *'),'cadence','hourly');
$$;
-- Keep Gmail's saved daily selection moving; other jobs retain their original caps.
do $$declare d text;begin
 select pg_get_functiondef('private.dispatch_physical_ai_job(text,date)'::regprocedure)into d;
 if position('prior.attempt_count >= 3'in d)=0 or position('interval ''20 minutes'''in d)=0 then raise exception 'Scheduler definition changed; review required';end if;
 d:=replace(d,'prior.attempt_count >= 3','prior.attempt_count >= (case when p_job_name=''ingest-gmail''then 24 else 3 end)');
 d:=replace(d,'interval ''20 minutes''','(case when p_job_name=''ingest-gmail''then interval ''2 minutes''else interval ''20 minutes''end)');
 execute d;
end$$;
create function private.resume_physical_ai_gmail()returns void language plpgsql security invoker set search_path=''as $$
begin
 if exists(select 1 from public.collector_checkpoints where id='run-gmail-scheduled-'||(now()at time zone'utc')::date::text and status in('partial','failed'))then
  perform private.dispatch_physical_ai_job('ingest-gmail');
 end if;
end$$;
revoke all on function private.resume_physical_ai_gmail()from public,anon,authenticated,service_role;
-- Add the continuation to the existing two-minute scheduler, retaining graph/public review work.
do $$declare d text;begin
 select pg_get_functiondef('private.resume_physical_ai_ecosystem()'::regprocedure)into d;
 d:=replace(d,'begin perform private.resume_physical_ai_web_collection();','begin perform private.resume_physical_ai_gmail(); exception when others then null; end;'||chr(10)||'  begin perform private.resume_physical_ai_web_collection();');
 if position('private.resume_physical_ai_gmail()'in d)=0 then raise exception 'Continuation insertion failed';end if;execute d;
end$$;
commit;
