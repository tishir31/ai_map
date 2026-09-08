begin;
do $$
declare rid text:='qa-'||gen_random_uuid(); t jsonb; payload jsonb;
begin
  insert into public.research_runs(id,prompt,subject,public_mode) values(rid,'Public worker transaction validation','Worker validation',true);
  insert into public.research_tasks(id,run_id,type,status,agent_name,input) values(rid||'-1',rid,'planner','pending','Planner','{}'),(rid||'-2',rid,'discovery','pending','Discovery','{}');
  t:=public.claim_public_research_task(rid);
  if t->>'id' is distinct from rid||'-1' then raise exception 'Wrong claim'; end if;
  if public.claim_public_research_task(rid) is not null then raise exception 'Concurrent claim allowed'; end if;
  if public.finish_public_research_task(t->>'id','incorrect','{}') then raise exception 'Bad lease allowed'; end if;
  payload:=jsonb_build_object('summary','Atomic sourced finding','rows',jsonb_build_array(jsonb_build_object('id',rid||'-row','run_id',rid,'company_name','Figure AI','normalized_name','figure ai','rank',1,'relevance_score',90)),
    'cells',jsonb_build_array(jsonb_build_object('id',rid||'-cell','run_id',rid,'row_id',rid||'-row','column_key','product','value','Research candidate','citation_ids',jsonb_build_array(rid||'-citation'))),
    'citations',jsonb_build_array(jsonb_build_object('id',rid||'-citation','run_id',rid,'row_id',rid||'-row','cell_id',rid||'-cell','url','https://www.figure.ai','title','Company website','evidence','Needs review')));
  if not public.finish_public_research_task(t->>'id',t->>'locked_by',payload) then raise exception 'Completion rejected'; end if;
  if not exists(select 1 from public.research_cells where id=rid||'-cell' and confidence='unverified' and status='unverified') then raise exception 'Unverified cell missing'; end if;
  if not exists(select 1 from public.research_citations where id=rid||'-citation') then raise exception 'Citation missing'; end if;
  if public.finish_public_research_task(t->>'id',t->>'locked_by',payload) then raise exception 'Double completion allowed'; end if;
  t:=public.claim_public_research_task(rid);
  perform public.finish_public_research_task(t->>'id',t->>'locked_by','{"failed":true,"summary":"Transient provider failure"}');
  t:=public.claim_public_research_task(rid);
  if (t->>'public_attempts')::integer<>2 then raise exception 'Failed task cannot retry'; end if;
  update public.research_tasks set locked_at=now()-interval '5 minutes' where id=t->>'id';
  t:=public.claim_public_research_task(rid);
  if (t->>'public_attempts')::integer<>3 then raise exception 'Expired lease cannot recover'; end if;
  perform public.finish_public_research_task(t->>'id',t->>'locked_by','{"failed":true,"summary":"Bounded final failure"}');
  if public.claim_public_research_task(rid) is not null then raise exception 'Retry limit exceeded'; end if;
  if has_function_privilege('anon','public.claim_public_research_task(text)','execute') then raise exception 'Anonymous database command allowed'; end if;
end $$;
rollback;
