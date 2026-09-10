-- Read-only bounded audit. Captured page text, full model outputs and credentials are excluded.
with latest as (
  select id,batch_date,status,mode,base_version,planned,fetches,max_fetches,new_entities,max_new_entities,backlog,created_at,updated_at,completed_at
  from public.ecosystem_runs order by created_at desc limit 1
), totals as (
  select t.kind,t.status,count(*) as count,coalesce(sum(t.attempts),0) as attempts
  from public.ecosystem_tasks t join latest r on r.id=t.run_id group by t.kind,t.status
), samples as (
  select t.id,t.kind,t.status,t.attempts,t.area_id,t.input#>>'{source,url}' as source_url,t.result->>'contentHash' as capture_hash,
    t.result->>'parser' as parser,t.result->>'model' as model,
    jsonb_array_length(coalesce(t.result->'accepted','[]'::jsonb)) as eligible_items,
    jsonb_array_length(coalesce(t.result->'held','[]'::jsonb)) as held_items,
    (select jsonb_agg(reason) from (select distinct reason from jsonb_array_elements(coalesce(t.result->'held','[]'::jsonb)) h
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(h->'reasons')='array' then h->'reasons' else jsonb_build_array(coalesce(h->>'reason','unspecified')) end) reason limit 10) reasons) as held_reasons,
    t.result->>'outcome' as retrieval_outcome,t.result->>'checkedAt' as checked_at,
    case when t.status='failed' then left(t.result->>'error',200) else null end as failure
  from public.ecosystem_tasks t join latest r on r.id=t.run_id where t.result is not null
  order by t.updated_at desc,t.id limit 12
), public_release as (
  select version,manifest->>'publishedAt' as published_at,manifest->'coverage' as coverage
  from public.ecosystem_snapshot_releases where active and is_public
)
select jsonb_build_object(
 'batch',(select to_jsonb(r) from latest r),
 'taskCounts',coalesce((select jsonb_agg(to_jsonb(t)) from totals t),'[]'::jsonb),
 'sourceSamples',coalesce((select jsonb_agg(to_jsonb(s)) from samples s),'[]'::jsonb),
 'publicRelease',(select to_jsonb(p) from public_release p),
 'policy',(select jsonb_build_object('version',policy_version,'mode',mode,'maxFetches',max_fetches,'maxNewEntities',max_new_entities) from public.ecosystem_settings where id)
) as ecosystem_audit;
