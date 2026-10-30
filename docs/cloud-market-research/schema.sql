begin;
create table public.cloud_market_runs(
 id text primary key, slot timestamptz not null unique, window_start date not null, window_end date not null,
 status text not null default 'running' check(status in('running','completed','partial')),
 started_at timestamptz not null default now(),completed_at timestamptz,last_progress_at timestamptz not null default now()
);
create table public.cloud_market_tasks(
 id text primary key,run_id text not null references public.cloud_market_runs(id),candidate_id text references public.review_queue_items(id),
 kind text not null check(kind in('discover','review','source_search')),input jsonb not null,
 status text not null default 'pending' check(status in('pending','running','completed','published','merged','held','rejected','failed')),
 attempts int not null default 0,source_attempts int not null default 0,available_at timestamptz not null default now(),
 lease_until timestamptz,locked_by uuid,result jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(run_id,candidate_id)
);
create index cloud_market_due on public.cloud_market_tasks(status,available_at,created_at);
create index cloud_market_candidate on public.cloud_market_tasks(candidate_id,updated_at desc);
create table public.cloud_market_audit(id bigint generated always as identity primary key,task_id text not null references public.cloud_market_tasks(id),attempt int not null,result jsonb not null,created_at timestamptz not null default now(),unique(task_id,attempt));
create table public.cloud_market_dispatch(id bigint primary key,dispatched_at timestamptz not null default now());
alter table public.cloud_market_runs enable row level security;
alter table public.cloud_market_tasks enable row level security;
alter table public.cloud_market_audit enable row level security;
alter table public.cloud_market_dispatch enable row level security;
revoke all on public.cloud_market_runs,public.cloud_market_tasks,public.cloud_market_audit,public.cloud_market_dispatch from public,anon,authenticated;
grant select,insert,update on public.cloud_market_runs,public.cloud_market_tasks,public.cloud_market_audit to service_role;
grant select on public.cloud_market_dispatch to service_role;
grant usage,select on sequence public.cloud_market_audit_id_seq to service_role;

create function public.cloud_market_date(s text) returns date language plpgsql immutable security invoker set search_path='' as $$
declare a text[];begin
 if s~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'then return s::date;end if;
 a:=regexp_match(s,'^(20[0-9]{2})年([0-9]{1,2})月([0-9]{1,2})日$');if a is not null then return make_date(a[1]::int,a[2]::int,a[3]::int);end if;
 a:=regexp_match(s,'^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-9]{1,2})(?:st|nd|rd|th)?[,]?\s+(20[0-9]{2})$','i');
 if a is not null then return make_date(a[3]::int,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(left(a[1],3))),a[2]::int);end if;
 a:=regexp_match(s,'^([0-9]{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,]?\s+(20[0-9]{2})$','i');
 if a is not null then return make_date(a[3]::int,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(left(a[2],3))),a[1]::int);end if;
 return null;exception when others then return null;end $$;

create function public.cloud_market_status() returns jsonb language sql stable security invoker set search_path='' as $$
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

create function public.claim_cloud_market_task() returns jsonb language plpgsql security invoker set search_path='' as $$
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

create function public.finish_cloud_market_task(p_id text,p_lock uuid,p_result jsonb)returns jsonb language plpgsql security invoker set search_path=''set lock_timeout='5s' as $$
declare t public.cloud_market_tasks;q public.review_queue_items;original public.review_queue_items;c public.companies;a public.activities;ev jsonb;it jsonb;co jsonb;existing text;cid text;aid text;sid text;k text;h text;root text;new_id text;amount_label text;disposition text;reason text;actor constant text:='PhysicalAI cloud research and independent public-source review';
begin
 select * into t from public.cloud_market_tasks where id=p_id for update;
 if found and t.status not in('running','pending')and t.result=p_result then return public.cloud_market_status();end if;
 if not found or t.status<>'running'or t.locked_by is distinct from p_lock or p_lock is null or t.lease_until<=now()then raise exception 'Invalid cloud research lease';end if;
 if jsonb_typeof(p_result)<>'object'or octet_length(p_result::text)>250000 then raise exception 'Invalid cloud research result';end if;
 disposition:=p_result->>'disposition';reason:=coalesce(p_result->>'reason',disposition);
 if disposition='error'then
  update public.cloud_market_tasks set status=case when attempts>=8 then'failed'else'pending'end,available_at=now()+least(attempts,6)*interval'2 minutes',result=p_result,locked_by=null,lease_until=null,updated_at=now()where id=t.id;
 elsif t.kind='discover'and disposition='discovered'then
  if jsonb_array_length(p_result->'items')>8 then raise exception 'Discovery limit exceeded';end if;
  for it in select value from jsonb_array_elements(p_result->'items')loop
   if it->>'url'!~'^https://[A-Za-z0-9.-]+/'or it->>'url'~*'extendrobotics\.com|news\.google\.com|@'or length(it->>'company')not between 2 and 120 or it->>'type'not in('financing','m&a','partnership','customer contract','product launch','infrastructure','other')or (it->>'date')::date not between (t.input->'window'->>'start')::date and(t.input->'window'->>'end')::date then raise exception 'Discovery input invalid';end if;
   new_id:='rq-cloud-'||left(encode(extensions.digest((it->>'url')||'|'||lower(it->>'company')||'|'||(it->>'date')||'|'||(it->>'type'),'sha256'),'hex'),24);
   insert into public.review_queue_items(id,candidate_company,candidate_counterparty,candidate_date,activity_type,subsector,geography,description,source_type,source_url,snippet,extracted_text,confidence,status,subject)
    values(new_id,it->>'company','N/A',(it->>'date')::date,it->>'type','other','N/A',coalesce(it->>'summary',''),'article',it->>'url','Cloud search discovery; unverified',coalesce(it->>'summary',''),'reported','pending',it->>'title')on conflict(id)do nothing;
   if exists(select 1 from public.review_queue_items where id=new_id and status in('pending','held')and gmail_message_id is null)and not exists(select 1 from public.cloud_market_tasks where candidate_id=new_id and(status in('pending','running')or updated_at>now()-interval'20 hours'))then
    insert into public.cloud_market_tasks(id,run_id,candidate_id,kind,input)values(t.run_id||'-q-'||new_id,t.run_id,new_id,'review','{}')on conflict do nothing;
   end if;
  end loop;
  update public.cloud_market_tasks set status='completed',result=p_result,lease_until=null,locked_by=null,updated_at=now()where id=t.id;
 elsif t.kind='source_search'and disposition='source_found'then
  update public.cloud_market_tasks set kind='review',status=case when jsonb_array_length(p_result->'urls')=0 then'held'else'pending'end,input=input||jsonb_build_object('urls',p_result->'urls'),source_attempts=source_attempts+1,result=p_result,lease_until=null,locked_by=null,updated_at=now()where id=t.id;
 elsif disposition='needs_source'and t.source_attempts<2 and t.attempts<7 then
  update public.cloud_market_tasks set kind='source_search',status='pending',result=p_result,lease_until=null,locked_by=null,updated_at=now()where id=t.id;
 elsif disposition in('held','needs_source')then
  update public.cloud_market_tasks set status='held',result=p_result,lease_until=null,locked_by=null,updated_at=now()where id=t.id;
  update public.review_queue_items set status='held',intelligence_evidence=coalesce(intelligence_evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('cloudTaskId',t.id,'reason',reason,'reviewedAt',now()))where id=t.candidate_id and status in('pending','held')and gmail_message_id is null;
 elsif disposition='published'and t.kind='review'then
  lock table public.activities,public.sources,public.companies,public.data_exclusions in share row exclusive mode;
  select * into q from public.review_queue_items where id=t.candidate_id for update;original:=q;
  if q.gmail_message_id is not null or lower(q.source_type)='gmail' or q.status not in('pending','held')or to_jsonb(q)->>'source_url'is distinct from t.input->'candidate'->>'source_url' then raise exception 'Candidate changed or private';end if;
  ev:=p_result->'evidence';aid:=p_result->'activity'->>'id';sid:=p_result->'activity'->>'source_id';cid:=p_result->'activity'->>'company_id';
  if aid!~'^a-cloud-[a-f0-9]{24}$'or sid is distinct from replace(aid,'a-cloud-','s-cloud-')then raise exception 'Invalid public identity';end if;
  select * into c from public.companies where id=cid;
  if not found then
   co:=p_result->'proposedCompany';c:=jsonb_populate_record(null::public.companies,co);
   if c.id is distinct from cid or c.is_sample is distinct from false or exists(select 1 from public.companies where lower(name)=lower(c.name))then raise exception 'Proposed issuer conflict';end if;
   perform public.assert_market_issuer(q,c,ev,p_result->'issuerProof');
   insert into public.companies(id,name,website,geography,subsector,overview,is_sample)values(c.id,c.name,c.website,c.geography,c.subsector,c.overview,false);
  end if;
  if c.is_sample or exists(select 1 from public.data_exclusions where restored_at is null and(target_id in(aid,cid)or company_id=cid))or c.name~*'extend robotics'then raise exception 'Excluded issuer';end if;
  if p_result->'issuerProof' is not null and p_result->'issuerProof'<>'null'::jsonb then
   perform public.assert_market_issuer(q,c,ev,p_result->'issuerProof');
   if exists(select 1 from public.market_official_sources where url=ev->>'canonicalUrl'and company_id<>cid)then raise exception 'Source identity conflict';end if;
   insert into public.market_official_sources(url,company_id)values(ev->>'canonicalUrl',cid)on conflict do nothing;
  end if;
  a:=jsonb_populate_record(null::public.activities,p_result->'activity');
  if a.source_url is distinct from ev->>'canonicalUrl'or a.company_id is distinct from ev->>'companyId'or a.review_status<>'approved'or a.confidence<>'reported'or a.is_sample is distinct from false or a.source_type<>'press release'or a.source_url!~'^https://[A-Za-z0-9.-]+/'then raise exception 'Public projection mismatch';end if;
  if a.description~*'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'or a.source_url~*'extendrobotics\.com|news\.google\.com|@'then raise exception 'Public source excluded';end if;
  q.activity_type:=a.activity_type;q.candidate_date:=a.date_announced;q.candidate_counterparty:=a.counterparty;q.deal_value_usd:=a.deal_value_usd;q.description:=a.description;
  if a.activity_type in('financing','m&a')then
   perform public.assert_market_transaction(q,c,ev);
   amount_label:=(ev->>'currency')||' '||(ev->>'amountNative');
   if a.activity_type='financing'then
    a.counterparty:='N/A';a.description:=c.name||' announced '||amount_label||' in '||case when ev->>'category'='debt'then'debt 'else coalesce((ev->>'round')||' ','')end||'financing. This is a company-reported transaction announcement.';
   else
    a.counterparty:=ev->>'counterpartyQuote';a.description:=a.counterparty||case when ev->>'category'='acquisition-closed'then' completed its acquisition of 'else' announced an agreement to acquire 'end||c.name||' for '||amount_label||'. '||case when ev->>'category'='acquisition-announced'then'Closing remains subject to conditions. 'else''end||'This is a company-reported transaction announcement.';
   end if;
  else
   if ev->>'policyVersion'is distinct from'market-editorial-v1'or a.activity_type not in('partnership','customer contract','product launch','infrastructure','other')or a.deal_value_usd is not null or a.activity_type is distinct from ev->>'type'or a.description is distinct from ev->>'summary' then raise exception 'Editorial type/amount gate';end if;
   h:=regexp_replace(lower(substring(a.source_url from'^https://([A-Za-z0-9.-]+)(?:/|$)')),'^www\.','');root:=regexp_replace(lower(substring(c.website from'^https://([A-Za-z0-9.-]+)(?:/|$)')),'^www\.','');
   if h is null or root is null or not(h=root or right(h,length(root)+1)='.'||root or exists(select 1 from public.market_official_sources where url=a.source_url and company_id=cid))then raise exception 'Verified editorial authority required';end if;
   if length(ev->>'captureText')not between 80 and 100000 or ev->>'captureHash'is distinct from encode(extensions.digest(ev->>'captureText','sha256'),'hex')then raise exception 'Capture integrity gate';end if;
   foreach k in array array['dateQuote','issuerQuote','eventQuote','physicalQuote']loop if length(ev->>k)not between 2 and 1500 or position(ev->>k in ev->>'captureText')=0 then raise exception 'Exact editorial quote missing';end if;end loop;
   if public.market_resolve_company(ev->>'issuerQuote')->>'id'is distinct from cid or position(lower(ev->>'issuerQuote')in lower(ev->>'eventQuote'))=0 or ev->>'physicalQuote'!~*'robot|autonom|physical ai|embodied|drone|sensor|simulation|engineering|机器|机器人|自动|具身|ロボット|로봇'then raise exception 'Editorial identity/relevance gate';end if;
   if public.cloud_market_date(ev->>'dateQuote')is distinct from a.date_announced or a.date_announced is distinct from(ev->>'eventDate')::date or a.date_announced not between (now()at time zone'utc')::date-90 and(now()at time zone'utc')::date then raise exception 'Editorial date gate';end if;
   foreach k in array array['supported','identityCorrect','dateCorrect','typeCorrect','statusCorrect','physicalRelevance','noUnsupportedClaims','noConflict']loop if ev->'verification'->k is distinct from'true'::jsonb then raise exception 'Independent review required';end if;end loop;
   if a.activity_type='other'and ev->>'eventQuote'~*'\m(raised|closed|secured)\M.*\m(funding|financing|series|round)\M'and ev->>'eventQuote'!~*'\m(pending|expected|proposed|seeking|reportedly|subject to|not closed)\M'then raise exception 'Transaction type bypass denied';end if;
   if ev->'verification'->'issues' is distinct from'[]'::jsonb or ev->>'status'not in('announced','completed','planned','reported')or length(a.description)not between 30 and 900 then raise exception 'Editorial review conflict';end if;
  end if;
  select id into existing from public.activities where company_id=cid and activity_type=a.activity_type and review_status='approved'and not is_sample and(source_url=a.source_url or id=aid or(date_announced=a.date_announced and(a.activity_type='financing'or description=a.description)))order by entered_at nulls last limit 1;
  if existing is not null then
   update public.review_queue_items set status='merged',duplicate_of_activity_id=existing where id=q.id;
   update public.activities set merged_from_candidate_ids=array(select distinct v from unnest(coalesce(merged_from_candidate_ids,array[]::text[])||array[q.id])v)where id=existing;
   p_result:=p_result||jsonb_build_object('disposition','merged','activityId',existing);disposition:='merged';
  else
   insert into public.sources(id,activity_id,type,url,title)values(sid,aid,'press release',a.source_url,c.name||' public announcement');
   insert into public.activities(id,company_id,date_announced,activity_type,deal_value_usd,counterparty,subsector,geography,description,source_id,source_url,source_reference,source_type,confidence,review_status,is_sample,last_updated,entered_by,entered_at,approved_by,approved_at,merged_from_candidate_ids,additional_sources)
   values(aid,cid,a.date_announced,a.activity_type,a.deal_value_usd,a.counterparty,c.subsector,c.geography,a.description,sid,a.source_url,a.source_reference,'press release','reported','approved',false,(now()at time zone'utc')::date,actor,now(),actor,now(),array[q.id],'[]');
   update public.review_queue_items set status='approved'where id=q.id;
  end if;
  insert into public.audit_log(table_name,row_id,action,"before","after")values('review_queue_items',q.id,'update',to_jsonb(original),(select to_jsonb(x)from public.review_queue_items x where x.id=q.id)||jsonb_build_object('_cloudMarketReview',jsonb_build_object('taskId',t.id,'reason',reason,'activityId',coalesce(existing,aid),'actor',actor)));
  update public.cloud_market_tasks set status=case when disposition='merged'then'merged'else'published'end,result=p_result,lease_until=null,locked_by=null,updated_at=now()where id=t.id;
 else raise exception 'Invalid cloud task transition';end if;
 insert into public.cloud_market_audit(task_id,attempt,result)values(t.id,t.attempts,p_result);
 update public.cloud_market_runs r set last_progress_at=now(),status=case when exists(select 1 from public.cloud_market_tasks where run_id=r.id and status in('pending','running'))then'running'when exists(select 1 from public.cloud_market_tasks where run_id=r.id and status='failed')then'partial'else'completed'end,completed_at=case when not exists(select 1 from public.cloud_market_tasks where run_id=r.id and status in('pending','running'))then now()else null end where id=t.run_id;
 return public.cloud_market_status();
end $$;

create function private.dispatch_cloud_market_research() returns bigint language plpgsql security invoker set search_path='' as $$
declare secret text;token text;today text;request_id bigint;slot_at timestamptz;
begin
 perform pg_advisory_xact_lock(hashtext('physical-ai-cloud-market-dispatch'));
 slot_at:=(date_trunc('day',now()at time zone'utc')at time zone'utc')+floor(extract(hour from now()at time zone'utc')/4)*interval'4 hours';
 if exists(select 1 from public.cloud_market_tasks where status='running'and lease_until>now())or exists(select 1 from public.cloud_market_dispatch where dispatched_at>now()-interval'55 seconds')then return null;end if;
 if exists(select 1 from public.cloud_market_runs where slot=slot_at)and not exists(select 1 from public.cloud_market_tasks where(status='pending'and available_at<=now())or(status='running'and lease_until<now()))then return null;end if;
 select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
 if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler credential unavailable';end if;
 today:=(now()at time zone'utc')::date::text;token:=encode(extensions.hmac('physical-ai-scheduler|v1|market-research|'||today,secret,'sha256'),'hex');
 request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/cloud-market-research',headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','market-research','x-physical-ai-run-key','market-research:'||today),timeout_milliseconds:=85000);
 insert into public.cloud_market_dispatch(id)values(request_id);return request_id;
end $$;
revoke all on function private.dispatch_cloud_market_research()from public,anon,authenticated,service_role;
revoke all on function public.cloud_market_date(text),public.cloud_market_status(),public.claim_cloud_market_task(),public.finish_cloud_market_task(text,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.cloud_market_date(text),public.cloud_market_status(),public.claim_cloud_market_task(),public.finish_cloud_market_task(text,uuid,jsonb)to service_role;
grant usage on schema cron to service_role;
grant select(jobname,active)on cron.job to service_role;
-- Scheduled only after deployment and a successful signed cloud invocation.
commit;
