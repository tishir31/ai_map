create or replace function public.create_public_research_run(p_run jsonb, p_tasks jsonb, p_events jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  if length(p_run->>'prompt') not between 1 and 2000 or jsonb_array_length(p_tasks) > 20 then raise exception 'Invalid public research request'; end if;
  insert into public.research_runs select * from jsonb_populate_record(null::public.research_runs,
    jsonb_build_object('created_at',now(),'updated_at',now()) || p_run || jsonb_build_object('public_mode',true));
  insert into public.research_tasks select * from jsonb_populate_recordset(null::public.research_tasks,
    coalesce((select jsonb_agg(value || jsonb_build_object('public_attempts',0)) from jsonb_array_elements(p_tasks)),'[]'));
  insert into public.research_events select * from jsonb_populate_recordset(null::public.research_events,p_events);
  return p_run->>'id';
end $$;
