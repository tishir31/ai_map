begin;
delete from public.public_action_usage where bucket='research-provider-cooldown';
do $$
declare rid text:='qa-'||gen_random_uuid();t jsonb;
begin
  insert into public.research_runs(id,prompt,subject,public_mode) values(rid,'Public cooldown validation','Worker validation',true);
  insert into public.research_tasks(id,run_id,type,status,agent_name,input) values(rid||'-1',rid,'planner','pending','Planner','{}');
  t:=public.claim_public_research_task(rid);
  perform public.finish_public_research_task(t->>'id',t->>'locked_by','{"failed":true,"rateLimited":true,"summary":"Provider cooldown"}');
  if not exists(select 1 from public.research_tasks where id=rid||'-1' and status='pending' and public_attempts=0) then raise exception 'Quota failure exhausted the task';end if;
  if public.claim_public_research_task(rid) is not null then raise exception 'Provider cooldown ignored';end if;
end $$;
rollback;
