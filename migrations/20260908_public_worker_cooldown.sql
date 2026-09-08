-- Public tasks use the site's configured runtime. No browser or scheduler receives database credentials.
alter table public.research_tasks add column if not exists public_attempts integer not null default 0;
create or replace function public.claim_public_research_task(p_run_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.research_tasks; rid text; lock_id text;
begin
  perform pg_advisory_xact_lock(hashtext('public_research_claim'));
  if exists(select 1 from public.public_action_usage where bucket='research-provider-cooldown' and expires_at>now()) then return null; end if;
  update public.research_tasks q set status=case when q.public_attempts<3 then 'pending' else 'failed' end,locked_at=null,locked_by=null where q.status='running' and q.locked_at<=now()-interval '150 seconds' and exists(select 1 from public.research_runs r where r.id=q.run_id and r.public_mode and (p_run_id is null or r.id=p_run_id));
  select r.id into rid from public.research_runs r where r.public_mode and (p_run_id is null or r.id=p_run_id)
    and exists (select 1 from public.research_tasks q where q.run_id=r.id and q.status in ('pending','failed') and q.public_attempts<3)
    and not exists (select 1 from public.research_tasks q where q.run_id=r.id and q.status='running' and q.locked_at>now()-interval '150 seconds')
    order by r.started_at limit 1;
  if rid is null then return null; end if;
  -- Expired leases cannot be completed by an old invocation.
  update public.research_tasks set status='pending',locked_at=null,locked_by=null where run_id=rid and status='running' and locked_at<=now()-interval '150 seconds' and public_attempts<3;
  select * into t from public.research_tasks where run_id=rid and status in ('pending','failed') and public_attempts<3 order by case when status='pending' then 0 else 1 end,created_at,id limit 1 for update;
  if t.id is null then return null; end if;
  lock_id:=gen_random_uuid()::text;
  update public.research_tasks set status='running',started_at=now(),locked_at=now(),locked_by=lock_id,public_attempts=public_attempts+1,error=null where id=t.id returning * into t;
  update public.research_runs set status='running',updated_at=now() where id=rid;
  return to_jsonb(t);
end $$;

create or replace function public.finish_public_research_task(p_task_id text,p_lock text,p_result jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare t public.research_tasks; item jsonb; failed boolean; rate_limited boolean; total_n integer; done_n integer; state text;
begin
  select * into t from public.research_tasks where id=p_task_id and locked_by=p_lock and status='running' for update;
  if t.id is null or not exists(select 1 from public.research_runs where id=t.run_id and public_mode) then return false; end if;
  if octet_length(p_result::text)>200000 then raise exception 'Result too large'; end if;
  failed:=coalesce((p_result->>'failed')::boolean,false);
  rate_limited:=coalesce((p_result->>'rateLimited')::boolean,false);
  if rate_limited then insert into public.public_action_usage(bucket,hits,expires_at) values('research-provider-cooldown',0,now()+interval '5 minutes') on conflict(bucket) do update set expires_at=excluded.expires_at; end if;
  if not failed then
    for item in select value from jsonb_array_elements(coalesce(p_result->'rows','[]')) loop
      if item->>'run_id' is distinct from t.run_id then raise exception 'Run mismatch'; end if;
      insert into public.research_rows(id,run_id,company_name,normalized_name,rank,relevance_score,status,website)
      values(item->>'id',t.run_id,item->>'company_name',item->>'normalized_name',(item->>'rank')::integer,(item->>'relevance_score')::numeric,'candidate',item->>'website')
      on conflict(run_id,normalized_name) do update set website=coalesce(excluded.website,public.research_rows.website);
    end loop;
    for item in select value from jsonb_array_elements(coalesce(p_result->'cells','[]')) loop
      if item->>'run_id' is distinct from t.run_id or not exists(select 1 from public.research_rows where id=item->>'row_id' and run_id=t.run_id) then raise exception 'Row mismatch'; end if;
      insert into public.research_cells(id,run_id,row_id,column_key,value,status,confidence,source_tier,publisher_decision,agent_name,last_checked_at,citation_ids)
      values(item->>'id',t.run_id,item->>'row_id',item->>'column_key',item->>'value','unverified','unverified','weak','staged_review',t.agent_name,now(),array(select jsonb_array_elements_text(item->'citation_ids')))
      on conflict(run_id,row_id,column_key) do nothing;
    end loop;
    for item in select value from jsonb_array_elements(coalesce(p_result->'citations','[]')) loop
      if item->>'run_id' is distinct from t.run_id or not exists(select 1 from public.research_rows where id=item->>'row_id' and run_id=t.run_id) then raise exception 'Row mismatch'; end if;
      insert into public.research_citations(id,run_id,row_id,cell_id,url,title,source_tier,retrieved_at,evidence)
      values(item->>'id',t.run_id,item->>'row_id',item->>'cell_id',item->>'url',item->>'title','weak',now(),item->>'evidence') on conflict(id) do nothing;
    end loop;
  end if;
  insert into public.research_events(id,run_id,task_id,event_type,agent_name,message,metadata,created_at)
    values('evt-'||t.id||'-'||t.public_attempts,t.run_id,t.id,case when failed then 'error' else 'decision' end,t.agent_name,left(coalesce(p_result->>'summary','Research step completed; review the cited findings.'),3000),'{}',now());
  update public.research_tasks set status=case when rate_limited then 'pending' when failed then 'failed' else 'completed' end,public_attempts=case when rate_limited then greatest(public_attempts-1,0) else public_attempts end,completed_at=case when rate_limited then null else now() end,locked_at=null,locked_by=null,output=jsonb_build_object('summary',left(p_result->>'summary',3000)),error=case when failed then 'Research provider could not complete this task.' else null end where id=t.id;
  select count(*),count(*) filter(where status in ('completed','failed','blocked')) into total_n,done_n from public.research_tasks where run_id=t.run_id;
  state:=case when total_n=done_n then case when exists(select 1 from public.research_tasks where run_id=t.run_id and status='failed') then 'failed' else 'completed' end else 'running' end;
  update public.research_runs set status=state,coverage_score=round(100.0*done_n/greatest(total_n,1)),candidate_rows=(select count(*) from public.research_rows where run_id=t.run_id),accepted_rows=0,total_cells=(select count(*) from public.research_cells where run_id=t.run_id),completed_cells=(select count(*) from public.research_cells where run_id=t.run_id),summary='Public research findings are staged for citation review; model assertions are unverified.',completed_at=case when total_n=done_n then now() else null end,last_refresh_at=now(),updated_at=now() where id=t.run_id;
  return true;
end $$;
revoke all on function public.claim_public_research_task(text) from public,anon,authenticated;
revoke all on function public.finish_public_research_task(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_public_research_task(text), public.finish_public_research_task(text,text,jsonb) to service_role;
