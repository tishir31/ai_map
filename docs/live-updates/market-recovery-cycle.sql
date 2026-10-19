-- Owner-created catch-up cycle. Daily selections, attempts and history are untouched.
begin;
create table public.market_recovery_batches(
 id text primary key check(id ~ '^market-recovery-[0-9-]{10}-[a-z0-9-]{1,40}$'),
 run_date date not null, requested_at timestamptz not null default now(),
 reason text not null check(length(reason) between 10 and 500)
);
create table public.web_recovery_runs(like public.web_collection_runs including defaults including constraints);
alter table public.web_recovery_runs add primary key(id),add foreign key(id)references public.market_recovery_batches(id);
create table public.web_recovery_tasks(like public.web_collection_tasks including defaults including constraints);
alter table public.web_recovery_tasks add primary key(id),add foreign key(run_id)references public.web_recovery_runs(id);
create table public.web_recovery_daily_budget(like public.web_collection_daily_budget including defaults including constraints);
alter table public.web_recovery_daily_budget add primary key(budget_date);
create table public.market_recovery_runs(like public.market_review_runs including defaults);
alter table public.market_recovery_runs add primary key(id),add foreign key(id)references public.market_recovery_batches(id),
 add check(selected between 0 and 200),add check(status in('running','completed','partial')),
 add check(reviewed=published+held+duplicates+nonqualifying),add check(reviewed+errors<=selected);
create table public.market_recovery_review_tasks(like public.market_review_tasks including defaults including constraints);
alter table public.market_recovery_review_tasks add primary key(id),add foreign key(run_id)references public.market_recovery_runs(id),add unique(run_id,candidate_id);
create table public.market_recovery_daily_budget(budget_date date primary key,task_ids text[]not null default '{}',attempts integer not null default 0 check(attempts between 0 and 400),check(cardinality(task_ids)<=200));
do $$declare t text;begin
 foreach t in array array['market_recovery_batches','web_recovery_runs','web_recovery_tasks','web_recovery_daily_budget','market_recovery_runs','market_recovery_review_tasks','market_recovery_daily_budget']loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;

-- Copy the already-tested lease, exact-evidence publication and duplicate gates.
-- Only the audit namespace and explicitly authorized catch-up budget differ.
do $$declare f text;d text;begin
 foreach f in array array['web_collection_rate_limit_guard()','summarize_web_collection_run(text)','claim_web_collection_task(text)','finish_web_collection_task(text,uuid,jsonb)','summarize_market_review_run(text)','claim_market_review_task(text)','finish_market_review_task_v2(text,uuid,jsonb)','finish_market_review_task(text,uuid,jsonb)']loop
  select pg_get_functiondef(('public.'||f)::regprocedure)into d;
  d:=replace(d,'web_collection','web_recovery');
  d:=replace(d,'market_review','market_recovery');
  -- The task namespace includes "review" to avoid the existing recovery-events table.
  d:=replace(d,'public.market_recovery_tasks','public.market_recovery_review_tasks');
  d:=replace(d,'''run-web-scheduled-''||r.run_date','''run-web-recovery-''||r.id');
  d:=replace(d,'b.attempts>=20','b.attempts>=400');
  d:=replace(d,'cardinality(b.task_ids)<10','cardinality(b.task_ids)<200');
  execute d;
 end loop;
end$$;
create trigger web_recovery_rate_limit_guard before update of result on public.web_recovery_tasks for each row execute function public.web_recovery_rate_limit_guard();
revoke all on function public.web_recovery_rate_limit_guard()from public,anon,authenticated,service_role;

create function public.begin_market_recovery_batch(p_id text,p_sources jsonb,p_window jsonb,p_reason text)returns jsonb
language plpgsql security invoker set search_path=''as $$
declare src jsonb;i integer:=0;utc_day date:=(now()at time zone'utc')::date;begin
 if p_id!~'^market-recovery-[0-9-]{10}-[a-z0-9-]{1,40}$'or substring(p_id from 17 for 10)<>utc_day::text
  or jsonb_typeof(p_sources)is distinct from'array'or jsonb_array_length(p_sources)not between 1 and 8
  or jsonb_typeof(p_window)is distinct from'object'or p_window->>'endDate'is distinct from utc_day::text
  or coalesce(p_window->>'startDate','')!~'^\d{4}-\d{2}-\d{2}$'or(p_window->>'startDate')::date not between utc_day-30 and utc_day
  or coalesce(length(p_reason),0)not between 10 and 500 then raise exception 'Explicit bounded recovery scope required';end if;
 perform pg_advisory_xact_lock(hashtext('begin_market_recovery_batch'));
 if exists(select 1 from public.market_recovery_batches where id=p_id)then return jsonb_build_object('id',p_id,'duplicate',true);end if;
 if exists(select 1 from public.web_recovery_runs where status='running')or exists(select 1 from public.market_recovery_runs where status='running')then raise exception 'Existing recovery must finish first';end if;
 insert into public.market_recovery_batches(id,run_date,reason)values(p_id,utc_day,p_reason);
 insert into public.web_recovery_runs(id,run_date,"window",planned_queries)values(p_id,utc_day,p_window,jsonb_array_length(p_sources));
 for src in select value from jsonb_array_elements(p_sources)loop
  if jsonb_typeof(src)is distinct from'object'or length(coalesce(src->>'query',''))not between 1 and 1000 or length(coalesce(src->>'name',''))not between 1 and 150
   or src::text~*'(gmail:|@|forwarded message)'then raise exception 'Public source plan required';end if;
  i:=i+1;insert into public.web_recovery_tasks(id,run_id,kind,input)values(p_id||'-feed-'||i,p_id,'feed',src||jsonb_build_object('order',i));
 end loop;return public.summarize_web_recovery_run(p_id);
end$$;

create function public.acquire_market_recovery_review(p_id text)returns jsonb
language plpgsql security invoker set search_path=''as $$
declare b public.market_recovery_batches;v public.market_recovery_runs;begin
 select *into b from public.market_recovery_batches where id=p_id;
 if not found then raise exception 'Owner-created recovery missing';end if;
 perform pg_advisory_xact_lock(hashtext('market_recovery_review:'||p_id));
 if exists(select 1 from public.web_recovery_runs where id=p_id and status='running')then raise exception 'Collection must finish before review';end if;
 select *into v from public.market_recovery_runs where id=p_id;if found then return to_jsonb(v);end if;
 insert into public.market_recovery_runs(id,run_date,collector_window_status)select p_id,b.run_date,status from public.web_recovery_runs where id=p_id;
 insert into public.market_recovery_review_tasks(id,run_id,candidate_id,input)
 select p_id||'-'||q.id,p_id,q.id,public.market_review_input(q)||jsonb_build_object('selectionOrder',row_number()over(order by q.candidate_date desc nulls last,q.created_at desc,q.id))
 from public.review_queue_items q where q.status='pending'and q.gmail_message_id is null and lower(btrim(q.source_type))in('article','press release','company blog')
  and not exists(select 1 from public.data_exclusions e where e.restored_at is null and e.target_id=q.id)
 order by q.candidate_date desc nulls last,q.created_at desc,q.id limit 200;
 update public.market_recovery_runs set selected=(select count(*)from public.market_recovery_review_tasks where run_id=p_id)where id=p_id;
 return public.summarize_market_recovery_run(p_id);
end$$;

-- A terminal catch-up disposition is visible to triage without deleting the lead.
create function public.close_market_recovery_disposition(p_task_id text)returns void
language plpgsql security invoker set search_path=''as $$
declare t public.market_recovery_review_tasks;begin
 select *into t from public.market_recovery_review_tasks where id=p_task_id;
 if not found or t.status not in('held','nonqualifying','error')then return;end if;
 update public.review_queue_items q set status=case when t.status='nonqualifying'then'rejected'else'held'end,
 intelligence_evidence=coalesce(q.intelligence_evidence,'[]'::jsonb)||jsonb_build_array('Public recovery review: '||coalesce(t.result->>'reason','source_evidence_required'))
 where q.id=t.candidate_id and q.status='pending'and q.gmail_message_id is null and lower(btrim(q.source_type))in('article','press release','company blog');
end$$;

create function public.market_recovery_status(p_id text)returns jsonb
language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',b.id,'runDate',b.run_date,'requestedAt',b.requested_at,'collection',(select to_jsonb(c)from public.web_recovery_runs c where c.id=b.id),'review',(select to_jsonb(r)from public.market_recovery_runs r where r.id=b.id))from public.market_recovery_batches b where b.id=p_id;
$$;

create function public.close_market_recovery_batch(p_id text)returns void
language plpgsql security invoker set search_path=''as $$
declare t record;begin
 for t in select id from public.market_recovery_review_tasks where run_id=p_id and status in('held','nonqualifying','error')loop
  perform public.close_market_recovery_disposition(t.id);
 end loop;
end$$;

create function private.dispatch_market_recovery(p_id text)returns bigint
language plpgsql security invoker set search_path=''as $$
declare secret text;token text;utc_day text:=(now()at time zone'utc')::date::text;begin
 if not exists(select 1 from public.market_recovery_batches where id=p_id)then raise exception 'Owner-created recovery missing';end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|market-review-daily|'||utc_day,secret,'sha256'),'hex');
 return net.http_get(url:='https://ai-map-cyan.vercel.app/api/market-recovery?batch='||p_id,
 headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','market-review-daily','x-physical-ai-run-key','market-review-daily:'||utc_day),timeout_milliseconds:=120000);
end$$;

do $$declare fn_row record;begin
 for fn_row in select proc.oid::regprocedure as f from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public'and proc.proname in(
 'summarize_web_recovery_run','claim_web_recovery_task','finish_web_recovery_task','summarize_market_recovery_run','claim_market_recovery_task','finish_market_recovery_task_v2','finish_market_recovery_task','begin_market_recovery_batch','acquire_market_recovery_review','close_market_recovery_disposition','close_market_recovery_batch','market_recovery_status')loop
 execute format('revoke all on function %s from public,anon,authenticated',fn_row.f);
 execute format('grant execute on function %s to service_role',fn_row.f);
 end loop;
end$$;
revoke all on function private.dispatch_market_recovery(text)from public,anon,authenticated,service_role;
commit;
