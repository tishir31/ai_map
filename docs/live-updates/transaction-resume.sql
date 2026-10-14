-- Continue newly arrived source-verifiable financing/M&A, including unfamiliar
-- issuers, under the same daily cap and unchanged-hold policy as acquisition.
begin;
create or replace function private.resume_physical_ai_market_review() returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text;token text;today date;request_id bigint;begin
 today:=(now()at time zone'utc')::date;
 if not exists(select 1 from public.market_review_runs where status='running') and not(
 coalesce((select selected from public.market_review_runs where run_date=today),0)<10
 and exists(select 1 from public.review_queue_items q where q.status='pending' and q.gmail_message_id is null
 and lower(q.source_type)in('article','press release','company blog') and q.source_url~'^https?://'
 and q.activity_type in('financing','m&a') and q.duplicate_of_activity_id is null and q.candidate_date between today-30 and today
 and not exists(select 1 from public.market_review_tasks t join public.market_review_runs r on r.id=t.run_id where r.run_date=today and t.candidate_id=q.id)
 and not exists(select 1 from public.market_review_tasks prior where prior.candidate_id=q.id and prior.status in('held','nonqualifying')and prior.updated_at>now()-interval'7 days'and prior.input-'selectionOrder'=public.market_review_input(q))))then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|market-review-daily|'||today::text,secret,'sha256'),'hex');
 request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/market-review-daily',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','market-review-daily','x-physical-ai-run-key','market-review-daily:'||today::text),timeout_milliseconds:=80000);
 return request_id;
end $$;
revoke all on function private.resume_physical_ai_market_review()from public,anon,authenticated,service_role;

-- Keep public backlog telemetry aligned with the 30-day review lane. Queue age
-- and private-source age retain their separate seven-day diagnostic measures.
create or replace function public.backlog_triage_summary()returns jsonb language sql stable security invoker set search_path=''as $$
 with q as(select r as original,r.*,r.gmail_message_id is not null or lower(btrim(r.source_type))='gmail'as private_source,r.gmail_message_id is null and lower(btrim(r.source_type))in('article','press release','company blog')as public_source from public.review_queue_items r where r.status='pending'),utc_day as(select(now()at time zone'utc')::date as d)
 select jsonb_build_object('asOf',now(),'pending',count(*),'eventOlder7d',count(*)filter(where candidate_date<d-6),'queueAged7d',count(*)filter(where created_at<now()-interval'7 days'),
 'publicPending',count(*)filter(where public_source),'privatePending',count(*)filter(where private_source),'unknownSourcePending',count(*)filter(where not coalesce(public_source,false)and not coalesce(private_source,false)),
 'recentPublicPending',count(*)filter(where public_source and candidate_date between d-30 and d),'oldPublicPending',count(*)filter(where public_source and candidate_date<d-30),'unknownDatePublic',count(*)filter(where public_source and(candidate_date is null or candidate_date>d)),
 'recentPrivatePending',count(*)filter(where private_source and candidate_date between d-6 and d),'oldPrivatePending',count(*)filter(where private_source and candidate_date<d-6),'unknownDatePrivate',count(*)filter(where private_source and(candidate_date is null or candidate_date>d)),
 'missingCanonical',count(*)filter(where source_url is null or source_url!~'^https?://'),'unresolvedAggregator',count(*)filter(where source_url~'^https?://news.google.com/'),
 'withCautions',count(*)filter(where intelligence_cautions is not null and intelligence_cautions not in('[]'::jsonb,'""'::jsonb)),'linkedExisting',count(*)filter(where duplicate_of_activity_id is not null),
 'dailyReviewSelectable',count(*)filter(where public_source and lower(source_type)in('article','press release','company blog')and candidate_date between d-30 and d and activity_type in('financing','m&a')and source_url~'^https?://'and duplicate_of_activity_id is null
 and coalesce((select r.selected from public.market_review_runs r where r.run_date=d),0)<10
 and not exists(select 1 from public.market_review_tasks t join public.market_review_runs r on r.id=t.run_id where r.run_date=d and t.candidate_id=q.id)
 and not exists(select 1 from public.market_review_tasks prior where prior.candidate_id=q.id and prior.status in('held','nonqualifying')and prior.updated_at>now()-interval'7 days'and prior.input-'selectionOrder'=public.market_review_input(q.original))))from q cross join utc_day;
$$;
revoke all on function public.backlog_triage_summary()from public,anon,authenticated;
grant execute on function public.backlog_triage_summary()to service_role;
commit;
