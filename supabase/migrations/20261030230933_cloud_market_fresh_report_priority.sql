create or replace function public.claim_cloud_market_task() returns jsonb language plpgsql security invoker set search_path='' as $$
declare slot_at timestamptz;rid text;t public.cloud_market_tasks;q public.review_queue_items;c jsonb;w_start date;w_end date;i int;
begin
 perform pg_advisory_xact_lock(hashtext('physical-ai-cloud-market'));
 slot_at:=(date_trunc('day',now()at time zone'utc')at time zone'utc')+floor(extract(hour from now()at time zone'utc')/4)*interval'4 hours';
 rid:='cloud-market-'||to_char(slot_at at time zone'utc','YYYYMMDD-HH24');
 if not exists(select 1 from public.cloud_market_runs where id=rid)then
  w_start:=coalesce((select max(window_end)-2 from public.cloud_market_runs where status='completed'),(now()at time zone'utc')::date-2);
  w_end:=least((now()at time zone'utc')::date,w_start+30);
  insert into public.cloud_market_runs(id,slot,window_start,window_end)values(rid,slot_at,w_start,w_end);
  for i in 0..5 loop insert into public.cloud_market_tasks(id,run_id,kind,input)values(rid||'-discover-'||i,rid,'discover',jsonb_build_object('topic',i,'window',jsonb_build_object('start',w_start,'end',w_end)));end loop;
  -- Oldest public exceptions are revisited once per day; private mail never enters this lane.
  for q in select x.* from public.review_queue_items x where x.status in('pending','held')and x.gmail_message_id is null and lower(x.source_type)<>'gmail'and x.source_url~'^https://'and x.candidate_date between (now()at time zone'utc')::date-case when x.activity_type in('financing','m&a')then 30 else 90 end and (now()at time zone'utc')::date and x.duplicate_of_activity_id is null
   and x.candidate_company!~*'extend robotics' and x.source_url!~*'(^https://)(www\.)?extendrobotics\.com'
   and not exists(select 1 from public.cloud_market_tasks p where p.candidate_id=x.id and(p.status in('pending','running')or p.updated_at>now()-interval'20 hours'))
   order by x.created_at limit 20 loop
   insert into public.cloud_market_tasks(id,run_id,candidate_id,kind,input)values(rid||'-q-'||q.id,rid,q.id,'review','{}');
  end loop;
 end if;
 update public.cloud_market_tasks set status=case when attempts>=8 then'failed'else'pending'end,available_at=now(),locked_by=null,lease_until=null,result=jsonb_build_object('disposition','error','reason','worker_lease_expired'),updated_at=now() where status='running'and lease_until<now();
 update public.cloud_market_runs r set status=case when exists(select 1 from public.cloud_market_tasks where run_id=r.id and status='failed')then'partial'else'completed'end,completed_at=now()where r.status='running'and not exists(select 1 from public.cloud_market_tasks where run_id=r.id and status in('pending','running'));
 if exists(select 1 from public.cloud_market_tasks where status='running'and lease_until>=now())then return null;end if;
 select * into t from public.cloud_market_tasks where status='pending'and available_at<=now()and attempts<8 order by run_id,case when kind='discover'then 0 when candidate_id like 'rq-cloud-%'then 1 else 2 end,created_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 if t.candidate_id is not null then
  select * into q from public.review_queue_items where id=t.candidate_id;
  if q.gmail_message_id is not null or q.status not in('pending','held') then update public.cloud_market_tasks set status='merged',updated_at=now(),result=jsonb_build_object('reason','candidate_already_resolved') where id=t.id;
 update public.cloud_market_runs r set status=case when exists(select 1 from public.cloud_market_tasks where run_id=r.id and status='failed')then'partial'else'completed'end,completed_at=now()where r.status='running'and not exists(select 1 from public.cloud_market_tasks where run_id=r.id and status in('pending','running'));
return null;end if;
  c:=public.market_resolve_company(q.candidate_company);
  t.input:=t.input||jsonb_build_object('candidate',to_jsonb(q),'company',c,'aliases',coalesce((select jsonb_agg(alias_key)from public.market_company_aliases where company_id=c->>'id'),'[]'::jsonb),'registeredSources',coalesce((select jsonb_agg(url)from public.market_official_sources where company_id=c->>'id'),'[]'::jsonb));
 end if;
 update public.cloud_market_tasks set status='running',input=t.input,attempts=attempts+1,locked_by=extensions.gen_random_uuid(),lease_until=now()+interval'85 seconds',updated_at=now()where id=t.id returning * into t;
 update public.cloud_market_runs set last_progress_at=now()where id=t.run_id;
 return to_jsonb(t)||jsonb_build_object('asOf',(now()at time zone'utc')::date);
end $$;
