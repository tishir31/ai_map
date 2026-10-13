begin;
create or replace function private.resume_physical_ai_market_review() returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text;token text;today text;request_id bigint;begin
 today:=(now()at time zone'utc')::date::text;
 if not exists(select 1 from public.market_review_runs where status='running') and not(
 coalesce((select selected from public.market_review_runs where run_date=today::date),0)<10
 and exists(select 1 from public.review_queue_items q where q.status='pending' and q.gmail_message_id is null
 and lower(q.source_type)in('article','press release','company blog') and q.source_url~'^https?://'
 and q.activity_type='financing' and q.duplicate_of_activity_id is null and q.candidate_date between today::date-30 and today::date
 and public.market_resolve_company(q.candidate_company)is not null
 and not exists(select 1 from public.market_review_tasks t join public.market_review_runs r on r.id=t.run_id where r.run_date=today::date and t.candidate_id=q.id)))then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|market-review-daily|'||today,secret,'sha256'),'hex');
 request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/market-review-daily',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','market-review-daily','x-physical-ai-run-key','market-review-daily:'||today),timeout_milliseconds:=80000);
 return request_id;
end $$;
revoke all on function private.resume_physical_ai_market_review()from public,anon,authenticated,service_role;
commit;
