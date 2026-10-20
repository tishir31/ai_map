-- Public RSS headlines form a separate source-report feed. They never create
-- companies, approved activities, financing amounts or financial total inputs.
begin;
create table public.market_source_reports(
 id text primary key,headline text not null check(length(headline)between 8 and 500),
 source_url text not null,source_label text not null,reported_date date,
 first_seen_at timestamptz not null default now(),withdrawn_at timestamptz,
 financial_totals_eligible boolean not null default false check(not financial_totals_eligible)
);
alter table public.market_source_reports enable row level security;
revoke all on public.market_source_reports from public,anon,authenticated;
grant select,insert on public.market_source_reports to service_role;
create function public.publish_market_source_report_items(p_items jsonb)returns void
language plpgsql security invoker set search_path=''as $$
declare x jsonb;u text;h text;d date;begin
 if jsonb_typeof(p_items)is distinct from'array'or jsonb_array_length(p_items)>4 then raise exception 'Bounded public feed items required';end if;
  for x in select value from jsonb_array_elements(p_items)loop
   h:=left(x->>'title',500);u:=split_part(split_part(x->>'link','#',1),'?',1);
   if length(h)between 8 and 500 and h!~'[<>@]' and h~*'\m(robots?|robotic|robotics|humanoids?|autonomous|autonomy|embodied|physical AI|lidar|drones?|uncrewed|unmanned|industrial automation)\M'
    and h~*'\m(funding|financing|raises?|raised|secures?|secured|series|seed|acqui\w*|merger|launch\w*|unveil\w*|partner\w*|deploy\w*|contract|investment|invests?|announc\w*)\M'
    and h!~*'\m(market size|forecast|CAGR|class action|investor alert|shareholder investigation|Extend Robotics)\M'
    and u~'^https://[a-zA-Z0-9.-]+/'and u!~*'(localhost|127\.|192\.168\.|10\.[0-9]+\.|169\.254\.|chatgpt\.com|mail\.google\.com|extendrobotics\.com)'
   then
    d:=case when x->>'pubDate'~'^\d{4}-\d{2}-\d{2}$'then(x->>'pubDate')::date else null end;
    if d is null or d between(now()at time zone'utc')::date-30 and(now()at time zone'utc')::date then
     insert into public.market_source_reports(id,headline,source_url,source_label,reported_date)
     values('news-'||encode(extensions.digest(u,'sha256'),'hex'),h,u,left(regexp_replace(coalesce(nullif(x->>'source',''),'Public RSS'),'[<>@]','','g'),100),d)on conflict(id)do nothing;
    end if;
   end if;
  end loop;
end$$;
revoke all on function public.publish_market_source_report_items(jsonb)from public,anon,authenticated;
grant execute on function public.publish_market_source_report_items(jsonb)to service_role;
alter function public.finish_web_collection_task(text,uuid,jsonb)rename to finish_web_collection_task_before_reports;
create function public.finish_web_collection_task(p_task_id text,p_lock uuid,p_result jsonb)returns jsonb
language plpgsql security invoker set search_path=''as $$
declare t public.web_collection_tasks;r jsonb;begin
 select *into t from public.web_collection_tasks where id=p_task_id;
 r:=public.finish_web_collection_task_before_reports(p_task_id,p_lock,p_result);
 if t.status='running'and t.kind='feed'and p_result->>'disposition'='feed-completed'then
  perform public.publish_market_source_report_items(p_result->'items');
 end if;
 return r;
end$$;
revoke all on function public.finish_web_collection_task(text,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.finish_web_collection_task(text,uuid,jsonb)to service_role;
-- Replay only the saved public RSS feed results, never private queue text.
do $$declare r record;begin
 for r in select t.result->'items'as items from public.web_collection_tasks t join public.web_collection_runs c on c.id=t.run_id
 where t.kind='feed'and t.status='feed-completed'and c.run_date>=(now()at time zone'utc')::date-7 loop
  perform public.publish_market_source_report_items(r.items);
 end loop;
 if to_regclass('public.web_recovery_tasks')is not null then
  for r in execute $replay$select t.result->'items'as items from public.web_recovery_tasks t join public.web_recovery_runs c on c.id=t.run_id where t.kind='feed'and t.status='feed-completed'and c.run_date>=(now()at time zone'utc')::date-7$replay$loop
   perform public.publish_market_source_report_items(r.items);
  end loop;
 end if;
end$$;
commit;
