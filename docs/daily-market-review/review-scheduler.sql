-- Apply only after schema and authenticated fixed backend route verified. No activation performed.
begin;
alter table private.physical_ai_scheduler_dispatches drop constraint physical_ai_scheduler_dispatches_job_name_check;
alter table private.physical_ai_scheduler_dispatches add constraint physical_ai_scheduler_dispatches_job_name_check check(job_name in('ingest-gmail','ingest-web-news','market-review-daily','graph-refresh-daily','graph-refresh-weekly','graph-refresh-monthly','graph-refresh-quarterly'));
create or replace function private.dispatch_physical_ai_job(
  p_job_name text,
  p_run_date date default ((now() at time zone 'utc')::date)
)
returns table (
  run_key text,
  request_id bigint,
  dispatched boolean,
  dispatch_status text,
  attempt_count smallint
)
language plpgsql
security invoker
set search_path = pg_catalog, private
as $$
declare
  endpoint_path text;
  scheduler_secret text;
  dispatch_token text;
  secret_count integer;
  prior private.physical_ai_scheduler_dispatches%rowtype;
  response_status integer;
  response_error text;
  response_timed_out boolean;
  next_request_id bigint;
  next_attempt smallint;
  canonical_run_key text;
begin
  endpoint_path := case p_job_name
    when 'ingest-gmail' then '/api/ingest-gmail'
    when 'ingest-web-news' then '/api/ingest-web-news'
    when 'market-review-daily' then '/api/market-review-daily'
    when 'graph-refresh-daily' then '/api/graph-refresh-daily'
    when 'graph-refresh-weekly' then '/api/graph-refresh-weekly'
    when 'graph-refresh-monthly' then '/api/graph-refresh-monthly'
    when 'graph-refresh-quarterly' then '/api/graph-refresh-quarterly'
    else null
  end;
  if endpoint_path is null then
    raise exception 'Unsupported Physical AI scheduler job';
  end if;
  if p_run_date is null then
    raise exception 'Physical AI scheduler run date is required';
  end if;
  if p_run_date <> ((now() at time zone 'utc')::date) then
    raise exception 'Physical AI scheduler run date must be the current UTC date';
  end if;

  canonical_run_key := p_job_name || ':' || p_run_date::text;
  perform pg_advisory_xact_lock(hashtextextended('physical-ai-scheduler:' || canonical_run_key, 0));

  select * into prior
    from private.physical_ai_scheduler_dispatches
   where job_name = p_job_name
     and run_date = p_run_date;

  if found then
    select response.status_code, response.error_msg, response.timed_out
      into response_status, response_error, response_timed_out
      from net._http_response response
     where response.id = prior.request_id;

    if response_status between 200 and 299 and coalesce(response_timed_out, false) = false then
      update private.physical_ai_scheduler_dispatches
         set status = 'succeeded',
             last_http_status = response_status,
             last_error = null,
             completed_at = coalesce(completed_at, now())
       where job_name = p_job_name and run_date = p_run_date
       returning * into prior;
      return query select canonical_run_key, prior.request_id, false, prior.status, prior.attempt_count;
      return;
    end if;

    if prior.attempt_count >= 3 then
      update private.physical_ai_scheduler_dispatches
         set status = 'failed',
             last_http_status = response_status,
             last_error = left(coalesce(response_error,
               case when response_timed_out then 'pg_net request timed out' else 'No successful response after three attempts' end), 500),
             completed_at = null
       where job_name = p_job_name and run_date = p_run_date
       returning * into prior;
      return query select canonical_run_key, prior.request_id, false, prior.status, prior.attempt_count;
      return;
    end if;

    if prior.last_dispatched_at > now() - interval '20 minutes' then
      return query select canonical_run_key, prior.request_id, false, prior.status, prior.attempt_count;
      return;
    end if;
  end if;

  select count(*), max(decrypted_secret)
    into secret_count, scheduler_secret
    from vault.decrypted_secrets
   where name = 'physical_ai_scheduler_v1';
  if secret_count <> 1 or coalesce(scheduler_secret, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Physical AI scheduler credential is unavailable';
  end if;

  dispatch_token := encode(
    extensions.hmac(
      'physical-ai-scheduler|v1|' || p_job_name || '|' || p_run_date::text,
      scheduler_secret,
      'sha256'
    ),
    'hex'
  );

  next_request_id := net.http_get(
    url := 'https://ai-map-cyan.vercel.app' || endpoint_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || dispatch_token,
      'X-Physical-AI-Scheduler', 'v1',
      'X-Physical-AI-Job', p_job_name,
      'X-Physical-AI-Run-Key', canonical_run_key
    ),
    timeout_milliseconds := 120000
  );

  if prior.job_name is null then
    insert into private.physical_ai_scheduler_dispatches (
      job_name, run_date, request_id, attempt_count, status
    ) values (
      p_job_name, p_run_date, next_request_id, 1, 'pending'
    )
    returning physical_ai_scheduler_dispatches.attempt_count into next_attempt;
  else
    update private.physical_ai_scheduler_dispatches
       set request_id = next_request_id,
           attempt_count = physical_ai_scheduler_dispatches.attempt_count + 1,
           status = 'pending',
           last_http_status = response_status,
           last_error = left(coalesce(response_error,
             case when response_timed_out then 'pg_net request timed out' else null end), 500),
           last_dispatched_at = now(),
           completed_at = null
     where job_name = p_job_name and run_date = p_run_date
     returning physical_ai_scheduler_dispatches.attempt_count into next_attempt;
  end if;

  return query select canonical_run_key, next_request_id, true, 'pending'::text, next_attempt;
end;
$$;

revoke all on function private.dispatch_physical_ai_job(text, date)
  from public, anon, authenticated, service_role;

create function private.resume_physical_ai_market_review() returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text;token text;today text;request_id bigint;begin
 if not exists(select 1 from public.market_review_runs where status='running')then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 today:=(now()at time zone'utc')::date::text;
 token:=encode(extensions.hmac('physical-ai-scheduler|v1|market-review-daily|'||today,secret,'sha256'),'hex');
 request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/market-review-daily',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','market-review-daily','x-physical-ai-run-key','market-review-daily:'||today),timeout_milliseconds:=80000);
 return request_id;
end $$;
revoke all on function private.resume_physical_ai_market_review() from public,anon,authenticated,service_role;
create or replace function private.resume_physical_ai_ecosystem()
returns bigint language plpgsql security invoker set search_path='' as $$
declare job text; root_secret text; token text; today text; request_id bigint; begin
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
select cron.schedule('physical-ai-market-review-daily','10,40 15,16 * * *',$job$select * from private.dispatch_physical_ai_job('market-review-daily');$job$);
-- Expose only a fixed boolean. Column-level grants exclude all cron command/credential text.
grant usage on schema cron to service_role;
grant select(jobname,active,schedule)on cron.job to service_role;
create function public.market_review_scheduler_status()returns jsonb
language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('configured',
  exists(select 1 from cron.job where jobname='physical-ai-market-review-daily'and active and schedule='10,40 15,16 * * *')
  and exists(select 1 from cron.job where jobname='physical-ai-ecosystem-resume'and active and schedule='*/2 * * * *'));
$$;
revoke all on function public.market_review_scheduler_status()from public,anon,authenticated;
grant execute on function public.market_review_scheduler_status()to service_role;
-- Existing postgres-owned two-minute resumer job now continues both independent lanes.
commit;
