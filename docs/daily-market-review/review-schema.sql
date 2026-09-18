-- Migration template for bounded public market review. Apply once after prerequisite schema review.
begin;
create table public.market_review_runs(
 id text primary key,run_date date not null unique,status text not null default 'running' check(status in('running','completed','partial')),
 selected integer not null default 0 check(selected between 0 and 10),reviewed integer not null default 0,
 published integer not null default 0,held integer not null default 0,duplicates integer not null default 0,
 nonqualifying integer not null default 0,errors integer not null default 0,
 collector_window_status text not null check(collector_window_status in('completed','partial','unknown')),
 started_at timestamptz not null default now(),last_review_at timestamptz,completed_at timestamptz,
 check(reviewed=published+held+duplicates+nonqualifying),check(reviewed+errors<=selected)
);
create table public.market_review_tasks(
 id text primary key,run_id text not null references public.market_review_runs(id),candidate_id text not null,
 input jsonb not null,status text not null default 'pending' check(status in('pending','running','published','held','duplicate','nonqualifying','error')),
 attempts integer not null default 0 check(attempts between 0 and 2),locked_by uuid,lease_until timestamptz,
 available_at timestamptz not null default now(),result jsonb,attempt_results jsonb not null default '[]',updated_at timestamptz not null default now(),unique(run_id,candidate_id)
);
create index market_review_task_queue on public.market_review_tasks(run_id,status,available_at);
create table public.market_review_daily_budget(
 budget_date date primary key,task_ids text[]not null default '{}',attempts integer not null default 0 check(attempts between 0 and 20),check(cardinality(task_ids)<=10)
);
alter table public.market_review_runs enable row level security;
alter table public.market_review_tasks enable row level security;
alter table public.market_review_daily_budget enable row level security;
revoke all on public.market_review_runs,public.market_review_tasks,public.market_review_daily_budget from public,anon,authenticated;
grant all on public.market_review_runs,public.market_review_tasks,public.market_review_daily_budget to service_role;

create function public.market_candidate_snapshot(p public.review_queue_items) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'candidate_company',p.candidate_company,'candidate_counterparty',p.candidate_counterparty,
  'candidate_date',p.candidate_date,'activity_type',p.activity_type,'deal_value_usd',p.deal_value_usd,'description',p.description,
  'source_type',p.source_type,'source_url',p.source_url,'status',p.status,'no_gmail_id',p.gmail_message_id is null,
  'duplicate_of_activity_id',p.duplicate_of_activity_id,'confidence',p.confidence,'intelligence_cautions',p.intelligence_cautions);
$$;
create function public.summarize_market_review_run(p_run_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.market_review_runs; n integer; begin
 select * into v from public.market_review_runs where id=p_run_id for update;
 if not found then raise exception 'Review run missing';end if;
 select count(*)filter(where status in('pending','running')) into n from public.market_review_tasks where run_id=p_run_id;
 update public.market_review_runs r set
  reviewed=(select count(*) from public.market_review_tasks where run_id=p_run_id and status in('published','held','duplicate','nonqualifying')),
  published=(select count(*) from public.market_review_tasks where run_id=p_run_id and status='published'),
  held=(select count(*) from public.market_review_tasks where run_id=p_run_id and status='held'),
  duplicates=(select count(*) from public.market_review_tasks where run_id=p_run_id and status='duplicate'),
  nonqualifying=(select count(*) from public.market_review_tasks where run_id=p_run_id and status='nonqualifying'),
  errors=(select count(*) from public.market_review_tasks where run_id=p_run_id and status='error'),
  status=case when n>0 then 'running' when exists(select 1 from public.market_review_tasks where run_id=p_run_id and status='error') then 'partial' else 'completed' end,
  last_review_at=(select max(updated_at) from public.market_review_tasks where run_id=p_run_id and status in('published','held','duplicate','nonqualifying')),
  completed_at=case when n=0 then coalesce(r.completed_at,now()) else null end
 where id=p_run_id returning * into v;return to_jsonb(v);
end $$;
create function public.acquire_market_review_run(p_run_date date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.market_review_runs;window_status text;begin
 if p_run_date is null or p_run_date<>(now()at time zone'utc')::date then raise exception 'Current UTC day required';end if;
 perform pg_advisory_xact_lock(hashtext('market_review_run'));
 -- Resume one outstanding run, including across UTC rollover. Never reselect its IDs.
 select * into v from public.market_review_runs where status='running' order by run_date limit 1;
 if found then return to_jsonb(v);end if;
 select * into v from public.market_review_runs where run_date=p_run_date;
 if found then return to_jsonb(v);end if;
 select case when count(*)>0 and bool_and(status='completed') then 'completed' when count(*)>0 then 'partial' else 'unknown' end into window_status
 from public.ingestion_runs where id='run-web-scheduled-'||p_run_date::text;
 insert into public.market_review_runs(id,run_date,collector_window_status)values('market-review-'||p_run_date,p_run_date,window_status)returning * into v;
 insert into public.market_review_tasks(id,run_id,candidate_id,input)
 select v.id||'-'||q.id,v.id,q.id,jsonb_build_object('selectionOrder',row_number()over(order by q.candidate_date desc,q.created_at desc,q.id),'candidate',public.market_candidate_snapshot(q),'company',
  (select to_jsonb(c) from public.companies c where lower(c.name)=lower(q.candidate_company) and not c.is_sample
   and (select count(*)from public.companies identity_match where lower(identity_match.name)=lower(q.candidate_company)and not identity_match.is_sample)=1))
 from public.review_queue_items q where q.status='pending' and lower(q.source_type)in('article','press release','company blog')
  and q.gmail_message_id is null and q.source_url ~ '^https?://' and q.duplicate_of_activity_id is null
  and q.candidate_date between p_run_date-6 and p_run_date
 order by q.candidate_date desc,q.created_at desc,q.id limit 10;
 update public.market_review_runs set selected=(select count(*)from public.market_review_tasks where run_id=v.id)where id=v.id;
 return public.summarize_market_review_run(v.id);
end $$;
create function public.claim_market_review_task(p_run_id text)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.market_review_tasks;b public.market_review_daily_budget;day date:=(now()at time zone'utc')::date;begin
 -- Serialize claims within this tiny run; never exceed two provider attempts per selected candidate.
 perform pg_advisory_xact_lock(hashtext('market_review_claim:'||p_run_id));
 update public.market_review_tasks set status='error',locked_by=null,lease_until=null,result=jsonb_build_object('disposition','error','reason','lease_attempts_exhausted'),
  attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('attempt',attempts,'at',now(),'disposition','error','reason','lease_attempts_exhausted')),updated_at=now()
 where run_id=p_run_id and status='running' and lease_until<now() and attempts>=2;
 if exists(select 1 from public.market_review_tasks where run_id=p_run_id and status='running'and lease_until>=now())then return null;end if;
 insert into public.market_review_daily_budget(budget_date)values(day)on conflict do nothing;
 select * into b from public.market_review_daily_budget where budget_date=day for update;
 if b.attempts>=20 then return null;end if;
 select * into t from public.market_review_tasks where run_id=p_run_id and attempts<2 and available_at<=now()
 and(id=any(b.task_ids)or cardinality(b.task_ids)<10)
 and (status='pending' or status='running' and lease_until<now())order by (input->>'selectionOrder')::integer,id for update skip locked limit 1;
 if not found then perform public.summarize_market_review_run(p_run_id);return null;end if;
 update public.market_review_daily_budget set attempts=attempts+1,task_ids=case when t.id=any(b.task_ids)then b.task_ids else array_append(b.task_ids,t.id)end where budget_date=day;
 update public.market_review_tasks set status='running',attempts=attempts+1,locked_by=gen_random_uuid(),lease_until=now()+interval'90 seconds',updated_at=now()
 where id=t.id returning * into t;return to_jsonb(t);
end $$;

create function public.finish_market_review_task(p_task_id text,p_lock uuid,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare t public.market_review_tasks;q public.review_queue_items;c public.companies;a public.activities;
 d text;ev jsonb;payload jsonb;quote text;host text;trusted_host text;aid text;sid text;duplicate_id text;stamp timestamptz:=now();
 money_parts text[];verified_amount numeric;
 actor constant text:='PhysicalAI daily review agent: official-source financing evidence; user-authorized publication';
 begin
 select * into t from public.market_review_tasks where id=p_task_id for update;
 if not found then raise exception 'Review task missing';end if;
 -- A retry after committed publication/telemetry is a no-op, never re-audit a row.
 if t.status in('published','held','duplicate','nonqualifying','error')then return public.summarize_market_review_run(t.run_id);end if;
 if t.status is distinct from 'running' or t.locked_by is distinct from p_lock or p_lock is null or t.lease_until is null or t.lease_until<=now() then raise exception 'Review lease invalid';end if;
 if p_result is null or jsonb_typeof(p_result)is distinct from 'object' or octet_length(p_result::text)>150000
  or coalesce(p_result->>'disposition','')not in('published','held','nonqualifying','error')or coalesce(p_result->>'reason','')!~'^[a-z_]{1,80}$' then raise exception 'Invalid review result';end if;
 d:=p_result->>'disposition';ev:=p_result->'evidence';payload:=p_result->'activity';
 -- Serialize publication/dedupe against every existing writer/exclusion, not only this worker.
 if d='published' then lock table public.activities,public.sources,public.companies,public.data_exclusions in share row exclusive mode;end if;
 select * into q from public.review_queue_items where id=t.candidate_id for update;
 if not found or public.market_candidate_snapshot(q)<>t.input->'candidate' then d:='held';p_result:=jsonb_build_object('disposition','held','reason','candidate_changed');end if;
 if d='published' then
  select * into c from public.companies where id=t.input->'company'->>'id';
  if not found or to_jsonb(c)is distinct from t.input->'company' or c.is_sample
    or (select count(*)from public.companies identity_match where lower(identity_match.name)=lower(q.candidate_company)and not identity_match.is_sample)<>1
    then d:='held';p_result:=jsonb_build_object('disposition','held','reason','company_changed_or_ambiguous');end if;
 end if;
 if d='published' then
  if q.status is distinct from 'pending' or q.gmail_message_id is not null or coalesce(lower(q.source_type),'')not in('article','press release','company blog') or q.activity_type is distinct from 'financing'
   or q.intelligence_cautions is not null and q.intelligence_cautions not in('[]'::jsonb,'""'::jsonb)
   or q.candidate_date not between (stamp at time zone'utc')::date-6 and (stamp at time zone'utc')::date
   or exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(c.id,t.candidate_id,'a-daily-review-'||t.candidate_id,'s-daily-review-'||t.candidate_id)or e.company_id=c.id)) then
   d:='held';p_result:=jsonb_build_object('disposition','held','reason','candidate_or_exclusion_gate');
  end if;
 end if;
 if d='published' then
  if jsonb_typeof(ev)is distinct from 'object' or jsonb_typeof(payload)is distinct from 'object' then raise exception 'Evidence/payload missing';end if;
  foreach quote in array array['canonicalUrl','companyId','companyWebsite','eventDate','amountUsd','moneyToken','issuerQuote','dateQuote','amountQuote','eventQuote','physicalQuote','captureText','captureHash']loop
   if ev->>quote is null or length(ev->>quote)=0 then raise exception 'Required evidence missing';end if;
  end loop;
  if ev->>'captureText'~*'\m(denied|denies|retracted|retraction|correction|false reports?|rumou?r|archive|historical|previously raised|debt|credit facility|valuation|fictional|hypothetical|illustrative|fabricated|template|cancel(?:ed|led|lation|s)?|withdraw(?:n|al|s)?|terminated|termination|unclosed|pending|subject to|has yet to|not closed|will close|expected to close)\M'then raise exception 'Source context requires review';end if;
  host:=lower(substring(ev->>'canonicalUrl'from'^https://([a-zA-Z0-9.-]+)/'));
  trusted_host:=regexp_replace(lower(substring(c.website from'^https?://([a-zA-Z0-9.-]+)')),'^www\.','');
  host:=regexp_replace(host,'^www\.','');
  if host is null or trusted_host is null or not(host=trusted_host or right(host,length(trusted_host)+1)='.'||trusted_host)
    or ev->>'companyId' is distinct from c.id or ev->>'companyWebsite' is distinct from c.website
    or ev->>'eventDate' is distinct from q.candidate_date::text
    or (ev->>'amountUsd')::numeric is distinct from q.deal_value_usd or q.deal_value_usd<=0
    or ev->>'captureHash' is distinct from encode(extensions.digest(ev->>'captureText','sha256'),'hex') then raise exception 'Publication evidence identity/date/amount/hash gate';end if;
  money_parts:=regexp_match(ev->>'moneyToken','^(?:US\$|USD\s*)\s*([0-9,]+(?:\.[0-9]+)?)\s*(billion|million|bn|b|m)$','i');
  if money_parts is null then raise exception 'US dollar token required';end if;
  verified_amount:=replace(money_parts[1],',','')::numeric*case when lower(money_parts[2])in('billion','bn','b')then 1000000000 else 1000000 end;
  if verified_amount is distinct from q.deal_value_usd then raise exception 'Quoted amount conflict';end if;
  if position(q.candidate_date::text in ev->>'dateQuote')=0
    and position(lower(to_char(q.candidate_date,'FMMonth FMDD YYYY'))in regexp_replace(lower(ev->>'dateQuote'),'[.,]','','g'))=0
    and position(lower(to_char(q.candidate_date,'FMMon FMDD YYYY'))in regexp_replace(lower(ev->>'dateQuote'),'[.,]','','g'))=0 then raise exception 'Quoted announcement date conflict';end if;
  foreach quote in array array['issuerQuote','dateQuote','amountQuote','eventQuote','physicalQuote']loop
   if length(ev->>quote)not between 8 and 600 or position(ev->>quote in ev->>'captureText')=0 then raise exception 'Exact quote missing';end if;
  end loop;
  if lower(ev->>'eventQuote')not like lower(c.name)||' %'
    or right(ev->>'eventQuote',1)is distinct from '.'
    or substring(ev->>'eventQuote'from length(c.name)+2)!~*'^(raised|raises|secured|closed|closes|announced|announces)\s+(US\$|USD\s*[0-9])'
    or ev->>'eventQuote'~*'\m(not|never|no|without|denied|denies|historical|history|archive|previously|valuation|credit|debt|revenue|facility)\M'
    or position(ev->>'issuerQuote'in ev->>'eventQuote')=0 or position(ev->>'amountQuote'in ev->>'eventQuote')=0
    or regexp_replace(lower(left(ev->>'dateQuote',length(ev->>'dateQuote')-length(ev->>'eventQuote'))),'[.,:—–\s-]','','g')not in
       (regexp_replace(q.candidate_date::text,'-','','g'),regexp_replace(lower(to_char(q.candidate_date,'FMMonth FMDD YYYY')),'\s','','g'),regexp_replace(lower(to_char(q.candidate_date,'FMMon FMDD YYYY')),'\s','','g'))
    or right(ev->>'dateQuote',length(ev->>'eventQuote'))is distinct from ev->>'eventQuote' then raise exception 'Coherent issuer-led event passage required';end if;
  if position(ev->>'dateQuote'in ev->>'captureText')>1 and right(rtrim(left(ev->>'captureText',position(ev->>'dateQuote'in ev->>'captureText')-1)),1)not in('.','!','?')
    or ltrim(substring(ev->>'captureText'from position(ev->>'dateQuote'in ev->>'captureText')+length(ev->>'dateQuote')))!~'^(?:[A-Z]|$)'then raise exception 'Event source boundary requires review';end if;
  if position(lower(c.name)in lower(ev->>'issuerQuote'))=0 or position(lower(c.name)in lower(ev->>'eventQuote'))=0
     or ev->>'eventQuote' !~* '\m(raised|raises|secured|closes|closed|announces|announced)\M'
     or ev->>'eventQuote' !~* '\m(funding|financing|series|investment)\M'
     or ev->>'eventQuote' ~* '\m(plans?|will|aims?|expects?|rumou?r|may|might|seeking)\M'
     or ev->>'physicalQuote' !~* '\m(robot|robotics|physical|autonomous|sensor|sensing|simulation|manufacturing|industrial|vehicle|drone)\M'
     or position(ev->>'moneyToken' in ev->>'amountQuote')=0 or position(ev->>'moneyToken' in ev->>'eventQuote')=0 or position(ev->>'eventQuote' in ev->>'dateQuote')=0
     or ev->>'amountQuote' ~* '\m(valuation|credit|debt|revenue|facility)\M' then raise exception 'Publication event/relevance gate';end if;
  if lower(ev->>'physicalQuote')not like lower(c.name)||' %'
    or substring(ev->>'physicalQuote'from length(c.name)+2)!~*'^(builds|develops|manufactures|operates|provides)\s+'
    or ev->>'physicalQuote'!~*'\m(robots?|robotics|autonomous vehicles?|sensors?|simulation|drones?)\M'
    or ev->>'physicalQuote'~*'\m(not|never|no|without|plans?|will|rumou?r|may|might)\M'then raise exception 'Issuer physical application required';end if;
  if ev->>'round' is not null and(ev->>'round'!~*'^(Series [A-Z][0-9]?|pre-seed|seed)$'or ev->>'roundQuote' is null or length(ev->>'roundQuote')not between 8 and 600 or position(ev->>'roundQuote'in ev->>'eventQuote')=0 or position(ev->>'round'in ev->>'roundQuote')=0)
     or ev->>'lead' is not null and(ev->>'leadQuote' is null or length(ev->>'leadQuote')not between 8 and 600 or length(ev->>'lead')not between 1 and 120 or position(ev->>'leadQuote'in ev->>'eventQuote')=0 or ev->>'leadQuote'~*'\m(not|never|without|no)\M' or position(ev->>'lead'in ev->>'leadQuote')=0 or ev->>'leadQuote' !~* '(led by|lead investor)') then raise exception 'Optional round/lead unsupported';end if;
  if substring(q.description from '(?i)\m(series\s+[A-Z][0-9]?|pre-seed|seed)\M')is not null
     and lower(substring(q.description from '(?i)\m(series\s+[A-Z][0-9]?|pre-seed|seed)\M'))is distinct from lower(ev->>'round')then raise exception 'Asserted round conflict';end if;
  if lower(regexp_replace(regexp_replace(substring(ev->>'eventQuote'from length(c.name)+2),'^(raised|raises|secured|closed|closes|announced|announces)\s+','','i'),'\.$',''))not in
    (lower((ev->>'moneyToken')||' in '||coalesce((ev->>'round')||' ','')||'financing'||case when ev->>'lead'is null then''else' led by '||(ev->>'lead')end),
     lower((ev->>'moneyToken')||' in '||coalesce((ev->>'round')||' ','')||'funding'||case when ev->>'lead'is null then''else' led by '||(ev->>'lead')end))
    then raise exception 'Single issuer financing clause required';end if;
  aid:='a-daily-review-'||t.candidate_id;sid:='s-daily-review-'||t.candidate_id;
  if payload->>'id' is distinct from aid or payload->>'company_id' is distinct from c.id or payload->>'source_id' is distinct from sid
    or payload->>'source_url' is distinct from ev->>'canonicalUrl' or payload->>'date_announced' is distinct from ev->>'eventDate'
    or (payload->>'deal_value_usd')::numeric is distinct from (ev->>'amountUsd')::numeric
    or payload->>'confidence' is distinct from 'reported' or payload->>'review_status' is distinct from 'approved' or payload->>'activity_type' is distinct from 'financing'
    or payload->>'source_type' is distinct from 'press release' or (payload->>'is_sample')::boolean is distinct from false then raise exception 'Activity payload gate';end if;
  if exists(select 1 from public.activities where id=aid)or exists(select 1 from public.sources where id=sid)then raise exception 'Unexpected deterministic existing row';end if;
  select id into duplicate_id from public.activities x where x.company_id=c.id and x.activity_type='financing' and(x.date_announced=q.candidate_date or x.source_url=ev->>'canonicalUrl' or t.candidate_id=any(x.merged_from_candidate_ids))limit 1;
  if found and exists(select 1 from public.activities x where x.company_id=c.id and x.activity_type='financing'and(x.date_announced=q.candidate_date or x.source_url=ev->>'canonicalUrl' or t.candidate_id=any(x.merged_from_candidate_ids))
    and(date_announced is distinct from q.candidate_date or deal_value_usd is distinct from q.deal_value_usd or review_status is distinct from 'approved' or is_sample or lower(btrim(source_type))='gmail' or lower(confidence)='estimated'
     or coalesce(source_url,'') !~ '^https://[a-zA-Z0-9.-]+(/|$)' or lower(coalesce(source_url,''))~'(news\.google\.com|example\.com|tbd|todo|placeholder|@)'
     or coalesce(source_reference,'')||coalesce(description,'')||coalesce(counterparty,'') ~* '(gmail:|@|forwarded message|\m(tbd|todo|placeholder|example\.com)\M)'
     or exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(x.id,x.source_id,x.company_id)or e.company_id=x.company_id)))) then d:='held';p_result:=jsonb_build_object('disposition','held','reason','existing_event_requires_review');
  elsif found then d:='duplicate';p_result:=jsonb_build_object('disposition','duplicate','reason','canonical_event_exists','activityId',duplicate_id,'evidence',ev);
  else
   -- Only deterministic attributed prose may be published, never the untrusted model description/operations.
   a:=jsonb_populate_record(null::public.activities,payload||jsonb_build_object('entered_by',actor,'approved_by',actor,'entered_at',stamp,'approved_at',stamp,'last_updated',(stamp at time zone'utc')::date,'merged_from_candidate_ids',jsonb_build_array(t.candidate_id)));
   a.description:=c.name||' announced $'||(q.deal_value_usd/1000000)::text||' million in '||coalesce(ev->>'round'||' ','')||'financing'||case when ev->>'lead'is null then''else' led by '||(ev->>'lead')end||'. This is a company-reported financing announcement.';
   a.counterparty:=coalesce(ev->>'lead','Not disclosed in reviewed source');a.subsector:=c.subsector;a.geography:=c.geography;
   a.source_reference:=c.name||' financing announcement';a.additional_sources:='[]'::jsonb;
   if a.description~*'(gmail:|@|forwarded message|begin forwarded)'or a.counterparty~*'(gmail:|@)'then raise exception 'Public text privacy gate';end if;
   insert into public.sources(id,activity_id,type,url,title)values(sid,aid,'press release',ev->>'canonicalUrl',c.name||' financing announcement');
   insert into public.activities select a.*;
   update public.review_queue_items set status='approved',source_type='press release',source_url=ev->>'canonicalUrl',confidence='reported',intelligence_evidence=coalesce(intelligence_evidence,'[]'::jsonb)||jsonb_build_array(actor||'; canonical evidence '||(ev->>'canonicalUrl'))where id=q.id;
  end if;
 end if;
 -- Keep held/nonqualifying/duplicate/error candidates unchanged; private task audit explains disposition.
 update public.market_review_tasks set status=case when d='error'and attempts<2 then'pending'else d end,
   available_at=case when d='error'then now()+interval'5 minutes'else now()end,result=p_result,
   attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('attempt',t.attempts,'at',stamp,'result',p_result)),locked_by=null,lease_until=null,updated_at=now()where id=t.id;
 return public.summarize_market_review_run(t.run_id);
end $$;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('market_candidate_snapshot','summarize_market_review_run','acquire_market_review_run','claim_market_review_task','finish_market_review_task')loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;
end $$;
commit;
