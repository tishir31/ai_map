-- Reviewable activation template. Apply after schema and fixed authenticated backend verified.
begin;
create function private.resume_physical_ai_web_collection()returns bigint
language plpgsql security invoker set search_path=''as $$
declare secret text;token text;today text;request_id bigint;begin
 if not exists(select 1 from public.web_collection_runs r join public.web_collection_tasks t on t.run_id=r.id left join public.web_collection_daily_budget b on b.budget_date=(now()at time zone'utc')::date
  where r.status='running'and(t.status='running'and t.lease_until<now()or t.status='pending'and t.available_at<=now()and(case when t.kind='feed'then coalesce(b.feed_attempts,0)<16 else coalesce(b.item_attempts,0)<64 end)))then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 today:=(now()at time zone'utc')::date::text;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|ingest-web-news|'||today,secret,'sha256'),'hex');
 request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/ingest-web-news',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','ingest-web-news','x-physical-ai-run-key','ingest-web-news:'||today),timeout_milliseconds:=60000);
 return request_id;
end$$;
revoke all on function private.resume_physical_ai_web_collection()from public,anon,authenticated,service_role;
create or replace function private.resume_physical_ai_ecosystem()
returns bigint language plpgsql security invoker set search_path='' as $$
declare job text; root_secret text; token text; today text; request_id bigint; begin
  begin perform private.resume_physical_ai_web_collection(); exception when others then null; end;
  -- A review-only dispatch failure must never block graph continuation; no secret/error text is logged.
  begin perform private.resume_physical_ai_market_review(); exception when others then null; end;
  if not exists(select 1 from public.ecosystem_runs where status='running') then return null; end if;
  select decrypted_secret into strict root_secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
  if root_secret !~ '^[a-f0-9]{64}$' then raise exception 'Invalid scheduler credential'; end if;
  select case when cadence='daily' then 'graph-refresh-daily' else 'graph-refresh-weekly' end into job from public.ecosystem_runs where status='running' order by batch_date limit 1;
  today:=(now() at time zone 'utc')::date::text;
  token:=encode(extensions.hmac('physical-ai-scheduler|v1|'||job||'|'||today,root_secret,'sha256'),'hex');
  select net.http_get(url:='https://ai-map-cyan.vercel.app/api/'||job,headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job',job,'x-physical-ai-run-key',job||':'||today),timeout_milliseconds:=80000) into request_id;
  return request_id;
end $$;
revoke all on function private.resume_physical_ai_ecosystem() from public,anon,authenticated,service_role;

-- Fixed boolean only. Existing broader cron grants may still apply independently of these explicit grants.
grant usage on schema cron to service_role;
grant select(jobname,active,schedule)on cron.job to service_role;
create function public.web_collection_scheduler_status()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('configured',exists(select 1 from cron.job where jobname='physical-ai-ingest-web-news-daily'and active and schedule='15,45 13,14 * * *')and exists(select 1 from cron.job where jobname='physical-ai-ecosystem-resume'and active and schedule='*/2 * * * *'));
$$;
revoke all on function public.web_collection_scheduler_status()from public,anon,authenticated;
grant execute on function public.web_collection_scheduler_status()to service_role;
-- Reuses the existing two-minute job and existing four public-web launch probes. No Gmail continuation.
commit;
