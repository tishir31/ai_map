create or replace function public.cloud_market_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('execution','cloud','cadenceHours',4,'configured',exists(select 1 from cron.job where jobname='physical-ai-cloud-market-research' and active),
 'latestRun',(select to_jsonb(r) from public.cloud_market_runs r order by slot desc limit 1),
 'lastCompletedAt',(select max(completed_at) from public.cloud_market_runs where status='completed'),
 'lastSuccessfulSearchAt',(select max(updated_at) from public.cloud_market_tasks where kind='discover' and status='completed'),
 'lastDispatchAt',(select max(dispatched_at) from public.cloud_market_dispatch),
 'pending',(select count(*) from public.cloud_market_tasks where status in('pending','running')),
 'latestCounts',(select jsonb_object_agg(status,n) from(select t.status,count(*) n from public.cloud_market_tasks t where t.run_id=(select id from public.cloud_market_runs order by slot desc limit 1)group by t.status)s),
 'attention',(select jsonb_agg(jsonb_build_object('reason',reason,'count',n))from(select result->>'reason' reason,count(*) n from public.cloud_market_tasks where (status in('held','failed') or (status='pending' and result->>'disposition'='error')) and run_id=(select id from public.cloud_market_runs order by slot desc limit 1)group by 1)s),
 'overdue',not exists(select 1 from public.cloud_market_runs where last_progress_at>now()-interval'5 hours'),
 'scope','Public physical-AI market research, original-source verification, transaction checks and publication. Evidence gaps remain held; no private mail.')
$$;
