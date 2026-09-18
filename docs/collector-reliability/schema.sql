-- Reviewable migration template. Apply once before compatible backend deployment.
begin;
create table public.web_collection_runs(
 id text primary key,run_date date not null unique,"window" jsonb not null,status text not null default 'running'check(status in('running','completed','partial')),
 planned_queries integer not null check(planned_queries between 1 and 8),completed_queries integer not null default 0,
 selected integer not null default 0 check(selected between 0 and 32),processed integer not null default 0,staged integer not null default 0,duplicates integer not null default 0,rejected integer not null default 0,errors integer not null default 0,remaining integer not null default 0,
 stop_reason text,started_at timestamptz not null default now(),last_progress_at timestamptz,completed_at timestamptz,
 check(selected=processed+remaining)
);
create table public.web_collection_tasks(
 id text primary key,run_id text not null references public.web_collection_runs(id),kind text not null check(kind in('feed','item')),input jsonb not null,
 status text not null default 'pending'check(status in('pending','running','feed-completed','staged','duplicate','rejected','error')),
 attempts integer not null default 0 check(attempts between 0 and 2),locked_by uuid,lease_until timestamptz,available_at timestamptz not null default now(),
 result jsonb,attempt_results jsonb not null default '[]',updated_at timestamptz not null default now()
);
create index web_collection_queue on public.web_collection_tasks(run_id,status,available_at);
create table public.web_collection_daily_budget(budget_date date primary key,feed_attempts integer not null default 0 check(feed_attempts between 0 and 16),item_attempts integer not null default 0 check(item_attempts between 0 and 64));
alter table public.web_collection_runs enable row level security;
alter table public.web_collection_tasks enable row level security;
alter table public.web_collection_daily_budget enable row level security;
revoke all on public.web_collection_runs,public.web_collection_tasks,public.web_collection_daily_budget from public,anon,authenticated;
grant all on public.web_collection_runs,public.web_collection_tasks,public.web_collection_daily_budget to service_role;

create function public.summarize_web_collection_run(p_run_id text)returns jsonb language plpgsql security invoker set search_path=''as $$
declare r public.web_collection_runs;n integer;model_enriched integer;model_rejected integer;model_failed integer;begin
 select * into r from public.web_collection_runs where id=p_run_id for update;if not found then raise exception 'Web collection run missing';end if;
 select count(*)filter(where status in('pending','running'))into n from public.web_collection_tasks where run_id=p_run_id;
 update public.web_collection_runs set
 completed_queries=(select count(*)from public.web_collection_tasks where run_id=p_run_id and status='feed-completed'),
 selected=(select count(*)from public.web_collection_tasks where run_id=p_run_id and kind='item'),
 processed=(select count(*)from public.web_collection_tasks where run_id=p_run_id and kind='item'and status in('staged','duplicate','rejected','error')),
 staged=(select count(*)from public.web_collection_tasks where run_id=p_run_id and status='staged'),duplicates=(select count(*)from public.web_collection_tasks where run_id=p_run_id and status='duplicate'),rejected=(select count(*)from public.web_collection_tasks where run_id=p_run_id and status='rejected'),
 errors=(select count(*)from public.web_collection_tasks where run_id=p_run_id and status='error'),remaining=(select count(*)from public.web_collection_tasks where run_id=p_run_id and kind='item'and status in('pending','running')),
 status=case when n>0 then'running'when exists(select 1 from public.web_collection_tasks where run_id=p_run_id and status='error')then'partial'else'completed'end,
 stop_reason=case when n=0 and exists(select 1 from public.web_collection_tasks where run_id=p_run_id and status='error')then'attempts-exhausted'when n>0 then coalesce(stop_reason,'continuation-pending')else null end,
 last_progress_at=(select max(updated_at)from public.web_collection_tasks where run_id=p_run_id and status not in('pending','running')),
 completed_at=case when n=0 then coalesce(completed_at,now())else null end where id=p_run_id returning * into r;
 select count(*)filter(where a.result->'provenance'->>'modelStatus'='enriched'),
 count(*)filter(where a.result->'provenance'->>'modelStatus'='rejected'),
 count(*)filter(where a.result->'provenance'->>'modelStatus'='failed')into model_enriched,model_rejected,model_failed
 from public.web_collection_tasks t cross join lateral jsonb_to_recordset(t.attempt_results)as a(at timestamptz,attempt integer,result jsonb)where t.run_id=p_run_id;
 -- A partial collection never becomes a successful check merely because HTTP dispatch succeeded.
 insert into public.ingestion_runs(id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,status,llm_enriched_count,llm_rejected_count,llm_failed_count,stop_reason,processed_items,requested_items)
 values('run-web-scheduled-'||r.run_date,'Public web news','rss',r.started_at,coalesce(r.last_progress_at,r.started_at),r.staged,r.duplicates+r.rejected,case when r.status='completed'then'completed'else'partial'end,model_enriched,model_rejected,model_failed,r.stop_reason,r.processed,r.selected)
 on conflict(id)do update set completed_at=excluded.completed_at,candidates_found=excluded.candidates_found,deduped_count=excluded.deduped_count,status=excluded.status,llm_enriched_count=excluded.llm_enriched_count,llm_rejected_count=excluded.llm_rejected_count,llm_failed_count=excluded.llm_failed_count,stop_reason=excluded.stop_reason,processed_items=excluded.processed_items,requested_items=excluded.requested_items;
 return to_jsonb(r);
end$$;
create function public.acquire_web_collection_run(p_run_date date,p_plan jsonb)returns jsonb language plpgsql security invoker set search_path=''as $$
declare r public.web_collection_runs;src jsonb;i integer:=0;begin
 if p_run_date is null or p_run_date<>(now()at time zone'utc')::date then raise exception 'Current UTC utc_day required';end if;
 perform pg_advisory_xact_lock(hashtext('web_collection_run'));
 select * into r from public.web_collection_runs where status='running'order by run_date limit 1;if found then return to_jsonb(r);end if;
 select * into r from public.web_collection_runs where run_date=p_run_date;if found then return to_jsonb(r);end if;
 -- A legacy successful dispatcher has no reproducible saved selection. Never reset or replay it.
 if exists(select 1 from public.ingestion_runs where id='run-web-scheduled-'||p_run_date)then return jsonb_build_object('legacy',true,'status','partial','stop_reason','historical-checkpoint-missing','run_date',p_run_date);end if;
 if jsonb_typeof(p_plan)is distinct from'object'or jsonb_typeof(p_plan->'sources')is distinct from'array'or jsonb_array_length(p_plan->'sources')not between 1 and 8 or jsonb_typeof(p_plan->'window')is distinct from'object'or p_plan->'window'->>'endDate'is distinct from p_run_date::text then raise exception 'Invalid bounded public source plan';end if;
 if coalesce(p_plan->'window'->>'startDate','')!~'^\d{4}-\d{2}-\d{2}$'or(p_plan->'window'->>'startDate')::date>p_run_date or(p_plan->'window'->>'startDate')::date<p_run_date-30 then raise exception 'Invalid bounded public source window';end if;
 if exists(select 1 from jsonb_array_elements(p_plan->'sources')s where jsonb_typeof(s)is distinct from'object')or(select count(distinct s->>'query')from jsonb_array_elements(p_plan->'sources')s)<>jsonb_array_length(p_plan->'sources')then raise exception 'Invalid bounded public source list';end if;
 insert into public.web_collection_runs(id,run_date,"window",planned_queries)values('web-collection-'||p_run_date,p_run_date,p_plan->'window',jsonb_array_length(p_plan->'sources'))returning * into r;
 for src in select value from jsonb_array_elements(p_plan->'sources')loop
  if length(coalesce(src->>'query',''))not between 1 and 1000 or length(coalesce(src->>'name',''))not between 1 and 150 then raise exception 'Invalid public query';end if;
  i:=i+1;insert into public.web_collection_tasks(id,run_id,kind,input)values(r.id||'-feed-'||i,r.id,'feed',src||jsonb_build_object('order',i));
 end loop;return public.summarize_web_collection_run(r.id);
end$$;
create function public.claim_web_collection_task(p_run_id text)returns jsonb language plpgsql security invoker set search_path=''as $$
declare t public.web_collection_tasks;b public.web_collection_daily_budget;utc_day date:=(now()at time zone'utc')::date;begin
 perform pg_advisory_xact_lock(hashtext('web_collection_claim:'||p_run_id));
 update public.web_collection_tasks set status='error',locked_by=null,lease_until=null,result=jsonb_build_object('disposition','error','reason','lease-attempts-exhausted'),attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('at',now(),'attempt',attempts,'reason','lease-attempts-exhausted')),updated_at=now()
 where run_id=p_run_id and status='running'and lease_until<now()and attempts>=2;
 if exists(select 1 from public.web_collection_tasks where run_id=p_run_id and status='running'and lease_until>=now())then return null;end if;
 insert into public.web_collection_daily_budget(budget_date)values(utc_day)on conflict do nothing;select * into b from public.web_collection_daily_budget where budget_date=utc_day for update;
 select * into t from public.web_collection_tasks where run_id=p_run_id and attempts<2 and available_at<=now()and(status='pending'or status='running'and lease_until<now())and(case when kind='feed'then b.feed_attempts<16 else b.item_attempts<64 end)order by (input->>'order')::numeric,id for update skip locked limit 1;
 if not found then
  if exists(select 1 from public.web_collection_tasks where run_id=p_run_id and status='pending'and available_at<=now())then update public.web_collection_runs set stop_reason='daily-budget'where id=p_run_id;end if;
  perform public.summarize_web_collection_run(p_run_id);return null;
 end if;
 update public.web_collection_daily_budget set feed_attempts=feed_attempts+case when t.kind='feed'then 1 else 0 end,item_attempts=item_attempts+case when t.kind='item'then 1 else 0 end where budget_date=utc_day;
 update public.web_collection_tasks set status='running',attempts=attempts+1,locked_by=gen_random_uuid(),lease_until=now()+interval'90 seconds',updated_at=now()where id=t.id returning * into t;return to_jsonb(t);
end$$;
create function public.finish_web_collection_task(p_task_id text,p_lock uuid,p_result jsonb)returns jsonb language plpgsql security invoker set search_path=''as $$
declare t public.web_collection_tasks;r public.web_collection_runs;x jsonb;i integer:=0;d text;candidate public.review_queue_items;inserted integer;begin
 select * into t from public.web_collection_tasks where id=p_task_id for update;if not found then raise exception 'Web task missing';end if;
 if t.status in('feed-completed','staged','duplicate','rejected','error')then return public.summarize_web_collection_run(t.run_id);end if;
 if t.status is distinct from'running'or p_lock is null or t.locked_by is distinct from p_lock or t.lease_until is null or t.lease_until<=now()then raise exception 'Web lease invalid';end if;
 if p_result is null or jsonb_typeof(p_result)is distinct from'object'or octet_length(p_result::text)>80000 or coalesce(p_result->>'disposition','')not in('feed-completed','staged','duplicate','rejected','error')then raise exception 'Web task result invalid';end if;
 select * into r from public.web_collection_runs where id=t.run_id;
 d:=p_result->>'disposition';
 if d='feed-completed'then
  if t.kind is distinct from'feed'or jsonb_typeof(p_result->'items')is distinct from'array'or jsonb_array_length(p_result->'items')>4 then raise exception 'Bounded frozen feed invalid';end if;
  for x in select value from jsonb_array_elements(p_result->'items')loop
   if jsonb_typeof(x)is distinct from'object'or length(coalesce(x->>'title',''))not between 1 and 1000 or length(coalesce(x->>'link',''))not between 1 and 2000 or x->>'link'!~'^https?://[a-zA-Z0-9.-]+/'then raise exception 'Public feed item invalid';end if;
   i:=i+1;insert into public.web_collection_tasks(id,run_id,kind,input)values(t.id||'-item-'||i,t.run_id,'item',jsonb_build_object('item',x,'sourceName',t.input->>'name','order',(t.input->>'order')::numeric+i::numeric/10));
  end loop;
 elsif d in('staged','duplicate','rejected')and t.kind is distinct from'item'then raise exception 'Item disposition required';
 elsif d='staged'then
  if jsonb_typeof(p_result->'candidate')is distinct from'object'then raise exception 'Candidate payload missing';end if;
  candidate:=jsonb_populate_record(null::public.review_queue_items,p_result->'candidate');
  if coalesce(candidate.id,'')!~'^rq-web-[a-zA-Z0-9_-]+$'or candidate.status is distinct from'pending'or candidate.source_type is distinct from'article'or candidate.gmail_message_id is not null or candidate.sender is not null or candidate.subject is distinct from t.input->'item'->>'title'or candidate.candidate_date is null or candidate.candidate_date::text not between r.window->>'startDate'and r.window->>'endDate'or coalesce(candidate.source_url,'')!~'^https?://[a-zA-Z0-9.-]+/'then raise exception 'Public pending candidate gate';end if;
  candidate.created_at:=now();insert into public.review_queue_items select candidate.* on conflict(id)do nothing;get diagnostics inserted=row_count;
  if inserted=0 then d:='duplicate';p_result:=p_result||jsonb_build_object('disposition','duplicate','reason','candidate-id-exists');end if;
 end if;
 if d in('error','rejected','duplicate')and coalesce(p_result->>'reason','')!~'^[a-z-]{1,80}$'then raise exception 'Safe result reason required';end if;
 update public.web_collection_tasks set status=case when d='error'and attempts<2 then'pending'else d end,available_at=case when d='error'then now()+interval'5 minutes'else now()end,result=p_result,attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('at',now(),'attempt',attempts,'result',p_result)),locked_by=null,lease_until=null,updated_at=now()where id=t.id;
 update public.web_collection_runs set stop_reason=case when d='error'then p_result->>'reason'else coalesce(stop_reason,'continuation-pending')end where id=t.run_id;
 return public.summarize_web_collection_run(t.run_id);
end$$;

create function public.web_collection_dedupe_context()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('companies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]')from(select c.id,c.name from public.companies c where not c.is_sample and not exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id=c.id or e.company_id=c.id))order by c.name,c.id limit 2000)x),
 'activities',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select a.id,a.company_id,a.date_announced,a.counterparty,a.activity_type,a.deal_value_usd,a.description,a.source_url,a.review_status from public.activities a where not a.is_sample and a.review_status='approved'and lower(a.confidence)<>'estimated'and lower(btrim(a.source_type))<>'gmail'and a.source_url~'^https://'and lower(a.source_url)!~'(news\.google\.com|example\.com|@)'and coalesce(a.source_reference,'')||coalesce(a.description,'')||coalesce(a.counterparty,'')!~*'(@|gmail:|forwarded message|placeholder)'and not exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(a.id,a.source_id,a.company_id)or e.company_id=a.company_id))order by a.date_announced desc limit 600)x),
 'pending',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select q.id,q.candidate_company,q.candidate_date,q.activity_type,q.deal_value_usd,q.source_url,q.status,q.description,q.duplicate_of_activity_id from public.review_queue_items q where q.gmail_message_id is null and lower(btrim(q.source_type))in('article','press release','company blog')and not exists(select 1 from public.data_exclusions e where e.restored_at is null and e.target_id=q.id)order by q.created_at desc limit 1000)x));
$$;
create function public.backlog_triage_summary()returns jsonb language sql stable security invoker set search_path=''as $$
 with q as(select *,gmail_message_id is not null or lower(btrim(source_type))='gmail'as private_source,gmail_message_id is null and lower(btrim(source_type))in('article','press release','company blog')as public_source from public.review_queue_items where status='pending'), utc_day as(select(now()at time zone'utc')::date as d)
 select jsonb_build_object('asOf',now(),'pending',count(*),'eventOlder7d',count(*)filter(where candidate_date<d-6),'queueAged7d',count(*)filter(where created_at<now()-interval'7 days'),
 'publicPending',count(*)filter(where public_source),'privatePending',count(*)filter(where private_source),'unknownSourcePending',count(*)filter(where not coalesce(public_source,false)and not coalesce(private_source,false)),
 'recentPublicPending',count(*)filter(where public_source and candidate_date between d-6 and d),'oldPublicPending',count(*)filter(where public_source and candidate_date<d-6),'unknownDatePublic',count(*)filter(where public_source and(candidate_date is null or candidate_date>d)),
 'recentPrivatePending',count(*)filter(where private_source and candidate_date between d-6 and d),'oldPrivatePending',count(*)filter(where private_source and candidate_date<d-6),'unknownDatePrivate',count(*)filter(where private_source and(candidate_date is null or candidate_date>d)),
 'missingCanonical',count(*)filter(where source_url is null or source_url!~'^https?://'),'unresolvedAggregator',count(*)filter(where source_url~'^https?://news.google.com/'),
 'withCautions',count(*)filter(where intelligence_cautions is not null and intelligence_cautions not in('[]'::jsonb,'""'::jsonb)),'linkedExisting',count(*)filter(where duplicate_of_activity_id is not null),
 'dailyReviewSelectable',count(*)filter(where public_source and candidate_date between d-6 and d and source_url~'^https?://'and duplicate_of_activity_id is null))from q cross join utc_day;
$$;
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('acquire_web_collection_run','claim_web_collection_task','finish_web_collection_task','summarize_web_collection_run','web_collection_dedupe_context','backlog_triage_summary')loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end$$;
commit;
