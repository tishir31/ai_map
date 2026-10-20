begin;

create or replace function public.assert_market_transaction(q public.review_queue_items,c public.companies,ev jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare k text;h text;root text;parts text[];date_parts text[];amount numeric;currency text;d date;quoted_date date;issuer text;statement text;app text;verbs text;binding text;pos integer;
begin
 if ev->>'policyVersion' is distinct from 'transactions-v3' then raise exception 'Transaction policy required';end if;
 foreach k in array array['canonicalUrl','companyId','companyWebsite','eventDate','category','currency','amountNative','moneyToken','issuerQuote','dateQuote','amountQuote','eventQuote','physicalQuote','captureText','captureHash']loop
  if coalesce(ev->>k,'')=''then raise exception 'Required transaction evidence missing';end if;
 end loop;
 if length(ev->>'captureText')not between 80 and 100000 or ev->>'captureHash'is distinct from encode(extensions.digest(ev->>'captureText','sha256'),'hex')then raise exception 'Capture integrity gate';end if;
 h:=regexp_replace(lower(substring(ev->>'canonicalUrl'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 root:=regexp_replace(lower(substring(c.website from'^https?://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 if h is null or root is null or not(h=root or right(h,length(root)+1)='.'||root or exists(select 1 from public.market_official_sources s where s.company_id=c.id and s.url=ev->>'canonicalUrl'))then raise exception 'Verified source required';end if;
 if ev->>'companyId'is distinct from c.id or ev->>'companyWebsite'is distinct from c.website or public.market_resolve_company(ev->>'issuerQuote')->>'id'is distinct from c.id then raise exception 'Transaction issuer identity conflict';end if;
 foreach k in array array['issuerQuote','dateQuote','amountQuote','eventQuote','moneyToken','physicalQuote']loop
  if length(ev->>k)not between 3 and 1500 or position(ev->>k in ev->>'captureText')=0 then raise exception 'Exact transaction quote missing';end if;
 end loop;
 if ev->>'eventQuote'~*'\m(denied|denies|rumou?r|fabricated|hypothetical|illustrative|retracted|canceled|cancelled|withdrawn|not raised|never raised|seeking|plans to raise|may raise|might raise)\M'
  or ev->>'captureText'~*'\m(false reports?|fabricated|hypothetical|financing was canceled|financing was cancelled|round never closed|round was withdrawn)\M'then raise exception 'Transaction status conflict';end if;
 parts:=regexp_match(ev->>'moneyToken','^(US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*([0-9,]+(?:\.[0-9]+)?)(?:\s*(billion|million|bn|b|m))?$','i');
 if parts is null then raise exception 'Quoted currency amount required';end if;
 currency:=case when upper(btrim(parts[1]))in('US$','USD')then'USD'when parts[1]='$'and c.geography in('US','USA','United States')then'USD'when upper(btrim(parts[1]))='GBP'or parts[1]='£'and c.geography in('UK','United Kingdom','Great Britain')then'GBP'when upper(btrim(parts[1]))='JPY'or parts[1]='¥'and c.geography='Japan'then'JPY'when upper(btrim(parts[1]))in('EUR','€')then'EUR'else null end;
 amount:=replace(parts[2],',','')::numeric*case when lower(parts[3])in('billion','bn','b')then 1000000000 when parts[3]is not null then 1000000 else 1 end;
 if currency is distinct from ev->>'currency' or amount<=0 or amount>9007199254740991 or amount is distinct from (ev->>'amountNative')::numeric or position(ev->>'moneyToken'in ev->>'amountQuote')=0
  or (case when currency='USD'then amount else null end)is distinct from (ev->>'amountUsd')::numeric or (ev->>'amountUsd')::numeric is distinct from q.deal_value_usd then raise exception 'Quoted amount/currency binding conflict';end if;
 d:=(ev->>'eventDate')::date;
 if d>(now()at time zone'utc')::date or d<(now()at time zone'utc')::date-30 or abs(d-q.candidate_date)>7 then raise exception 'Transaction date conflict';end if;
 if ev->>'dateQuote'~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'then quoted_date:=(ev->>'dateQuote')::date;
 else
  date_parts:=regexp_match(ev->>'dateQuote','^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+([0-9]{1,2})(?:st|nd|rd|th)?[,]?\s+(20[0-9]{2})$','i');
  if date_parts is not null then quoted_date:=make_date(date_parts[3]::int,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(left(date_parts[1],3))),date_parts[2]::int);end if;
  if date_parts is null then
   date_parts:=regexp_match(ev->>'dateQuote','^([0-9]{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,]?\s+(20[0-9]{2})$','i');
   if date_parts is not null then quoted_date:=make_date(date_parts[3]::int,array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(left(date_parts[2],3))),date_parts[1]::int);end if;
  end if;
 end if;
 if quoted_date is distinct from d then raise exception 'Quoted transaction date conflict';end if;
 pos:=position(ev->>'eventQuote'in ev->>'captureText');
 if position(ev->>'dateQuote'in ev->>'captureText')>pos or pos-position(ev->>'dateQuote'in ev->>'captureText')>5000 then raise exception 'Date must precede transaction passage';end if;
 if ev->>'physicalQuote'!~*'\m(robots?|robotic|robotics|humanoids?|autonomous|autonomy|simulation|physics|physical AI|hardware engineering|sensors?|sensing|drones?|manufacturing|tactile)\M' then raise exception 'Physical application evidence required';end if;
 if position(lower(c.name)in lower(ev->>'physicalQuote'))=0 and position(lower(ev->>'issuerQuote')in lower(ev->>'physicalQuote'))=0
  and not(position(ev->>'physicalQuote'in ev->>'captureText')between pos and pos+2500 and ev->>'physicalQuote'~*'\m(our|we|the company|this capital)\M')then raise exception 'Issuer physical application binding required';end if;
 issuer:=ev->>'issuerQuote';
 statement:=regexp_replace(issuer,'([\.\[\]\(\)\{\}\*\+\?\^\$\|\\])','\\\1','g');
 if q.activity_type='financing'then
  if ev->>'category'not in('equity','debt') or position(ev->>'amountQuote'in ev->>'eventQuote')=0 or ev->>'eventQuote'!~*'\m(funding|financing|series|round|term loan)\M'then raise exception 'Financing category/passage conflict';end if;
  app:='(?:\s*\([^)]{1,100}\))?(?:\s*,\s*[^;:]{1,240}?,)?\s+';
  verbs:='(?:(?:(?:today|has|have|now|successfully)\s+){0,3}(?:raised|raises|secured|closed|closes|announced|announces|announcing)\s+(?:(?:(?:that\s+)?it\s+has\s+(?:raised|secured|closed)|has\s+(?:raised|secured|closed)|the\s+(?:close|closing|completion)\s+of|its|a|an|approximately|about|nearly|over|more\s+than)\s+){0,5}|(?:(?:today|has)\s+){0,2}(?:emerged|emerges)\s+from\s+stealth\s+with\s+|(?:(?:today|has)\s+){0,2}closed\s+(?:its|the|a)\s+Series\s+[A-Z][0-9]?\s+(?:funding\s+)?round\s+with\s+|(?:(?:today|has)\s+){0,2}entered\s+into\s+(?:a|an)\s+)';
  binding:='^'||statement||app||verbs||'(?:US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:billion|million|bn|b|m))?$';
  if ev->>'amountQuote'!~*binding then raise exception 'Issuer-led financing amount required';end if;
  if ev->>'amountQuote'~*'\mentered\s+into\M' and substring(ev->>'eventQuote'from length(ev->>'amountQuote')+1)!~*'^\s*(?:(?:unsecured|secured)\s+)?financing\s+facility\M'then raise exception 'Financing facility binding required';end if;
  if substring(ev->>'eventQuote'from length(ev->>'amountQuote')+1)~*'^\s*(?:in\s+)?(?:total|cumulative|valuation|revenue|investment in\M|investment into\M)'then raise exception 'Current financing episode required';end if;
  if (select count(*)from regexp_matches(ev->>'amountQuote','(?:US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:billion|million|bn|b|m))?','gi'))<>1 then raise exception 'Single bound amount required';end if;
  if (ev->>'category'='debt')is distinct from (ev->>'eventQuote'~*'\m(term loan|debt financing|credit facility|loan facility|financing facility)\M') then raise exception 'Debt/equity classification conflict';end if;
  if ev->>'round'is not null and(ev->>'category'<>'equity' or ev->>'round'!~*'^(Series [A-Z][0-9]?|Pre-A|pre-seed|seed)$'or position(lower(ev->>'round')in lower(ev->>'eventQuote'))=0)then raise exception 'Unsupported financing round';end if;
  if substring(q.description from '(?i)\m(Series [A-Z][0-9]?|Pre-A|pre-seed|seed)\M')is not null and lower(substring(q.description from '(?i)\m(Series [A-Z][0-9]?|Pre-A|pre-seed|seed)\M'))is distinct from lower(ev->>'round')then raise exception 'Candidate financing round conflict';end if;
 elsif q.activity_type='m&a'then
  if ev->>'category'not in('acquisition-announced','acquisition-closed')or ev->>'counterpartyQuote'is distinct from q.candidate_counterparty or coalesce(ev->>'counterpartyQuote','')=''or position(ev->>'counterpartyQuote'in ev->>'eventQuote')=0 or position(ev->>'issuerQuote'in ev->>'eventQuote')=0
   or ev->>'eventQuote'!~*'\m(acquire|acquired)\M' or ev->>'eventQuote'!~*'\m(announced|entered into|signed|completed)\M'
   or ev->>'amountQuote'!~*'\m(transaction|purchase price|acquisition)\M' or ev->>'amountQuote'!~*'\m(valued at|of|for)\M'
   or position(ev->>'amountQuote'in ev->>'captureText')<pos or position(ev->>'amountQuote'in ev->>'captureText')>pos+length(ev->>'eventQuote')+2000 then raise exception 'Acquisition party/price binding conflict';end if;
  if ev->>'category'='acquisition-announced'and ev->>'eventQuote'!~*'\m(definitive agreement|entered into|signed)\M'
   or ev->>'category'='acquisition-closed'and(ev->>'eventQuote'!~*'\m(completed)\M'or ev->>'eventQuote'~*'\m(expected|subject to)\M')then raise exception 'Acquisition completion conflict';end if;
 else raise exception 'Unsupported transaction type';end if;
end $$;

create or replace function public.assert_market_issuer(q public.review_queue_items,c public.companies,ev jsonb,proof jsonb)returns void
language plpgsql security invoker set search_path='' as $$
declare h text;root text;home text;about_pos integer;link_pos integer;
begin
 h:=lower(substring(proof->>'wireUrl'from'^https://([a-zA-Z0-9.-]+)/'));
 if h not in('prnewswire.com','www.prnewswire.com','businesswire.com','www.businesswire.com','globenewswire.com','www.globenewswire.com','rss.globenewswire.com')or proof->>'wireUrl'is distinct from ev->>'canonicalUrl'or proof->>'website'is distinct from c.website then raise exception 'Issuer wire authority required';end if;
 if proof->>'sourceText'is distinct from ev->>'captureText'or proof->>'sourceHash'is distinct from ev->>'captureHash'or length(proof->>'homepageText')not between 10 and 100000 or proof->>'homepageHash'is distinct from encode(extensions.digest(proof->>'homepageText','sha256'),'hex')then raise exception 'Issuer capture integrity required';end if;
 root:=regexp_replace(lower(substring(c.website from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 home:=regexp_replace(lower(substring(proof->>'homepageUrl'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 if root is null or home is null or not(home=root or right(home,length(root)+1)='.'||root)or position(lower(c.name)in lower(proof->>'homepageText'))=0 then raise exception 'Issuer homepage brand required';end if;
 home:=regexp_replace(lower(substring(proof->>'websiteQuote'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 about_pos:=position('about '||lower(c.name)in lower(proof->>'sourceText'));link_pos:=position(proof->>'websiteQuote'in proof->>'sourceText');
 if about_pos=0 or link_pos<about_pos or link_pos>about_pos+4000 or not(home=root or right(home,length(root)+1)='.'||root)then raise exception 'Issuer supplied website binding required';end if;
 if regexp_replace(lower(q.candidate_company),'[^a-z0-9]','','g')is distinct from regexp_replace(lower(c.name),'[^a-z0-9]','','g')and public.market_resolve_company(q.candidate_company)->>'id'is distinct from c.id then raise exception 'Issuer name conflict';end if;
end $$;

do $$begin
 if to_regprocedure('public.finish_market_review_task_v2(text,uuid,jsonb)')is null then
  alter function public.finish_market_review_task(text,uuid,jsonb)rename to finish_market_review_task_v2;
 end if;
end $$;

create or replace function public.finish_market_review_task(p_task_id text,p_lock uuid,p_result jsonb)returns jsonb
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare t public.market_review_tasks;q public.review_queue_items;c public.companies;a public.activities;ev jsonb;payload jsonb;proposal jsonb;duplicate_id text;amount_label text;actor text:='PhysicalAI evidence review: public transaction announcement; user-authorized publication';stamp timestamptz:=now();
begin
 if coalesce(p_result->'evidence'->>'policyVersion','')<>'transactions-v3'or p_result->>'disposition'<>'published'then return public.finish_market_review_task_v2(p_task_id,p_lock,p_result);end if;
 select * into t from public.market_review_tasks where id=p_task_id for update;
 if not found then raise exception 'Review task missing';end if;
 if t.status in('published','held','duplicate','nonqualifying','error')then return public.summarize_market_review_run(t.run_id);end if;
 if t.status<>'running'or t.locked_by is distinct from p_lock or p_lock is null or t.lease_until is null or t.lease_until<=now()then raise exception 'Review lease invalid';end if;
 if jsonb_typeof(p_result)is distinct from'object'or octet_length(p_result::text)>150000 or p_result->>'reason'!~'^[a-z_]{1,80}$'then raise exception 'Invalid transaction result';end if;
 lock table public.activities,public.sources,public.companies,public.data_exclusions in share row exclusive mode;
 select * into q from public.review_queue_items where id=t.candidate_id for update;
 if not found or public.market_candidate_snapshot(q)is distinct from t.input->'candidate'then return public.finish_market_review_task_v2(p_task_id,p_lock,jsonb_build_object('disposition','held','reason','candidate_changed'));end if;
 ev:=p_result->'evidence';payload:=p_result->'activity';
 if t.input->'company'='null'::jsonb then
  if public.market_resolve_company(q.candidate_company)is not null then return public.finish_market_review_task_v2(p_task_id,p_lock,jsonb_build_object('disposition','held','reason','company_changed_or_ambiguous'));end if;
  proposal:=p_result->'proposedCompany';c:=jsonb_populate_record(null::public.companies,proposal);
  if q.status<>'pending'or q.gmail_message_id is not null or public.market_resolve_company(q.candidate_company)is not null or c.name!~'^[^@<>]{3,100}$'or c.geography is distinct from'N/A'or c.subsector is distinct from'other'or c.is_sample is distinct from false or c.overview is distinct from c.name||' develops technology for physical-world automation. Detailed sector classification is pending.'
   or c.id is distinct from'c-verified-'||left(encode(extensions.digest(lower(substring(c.website from'^https://([a-zA-Z0-9.-]+)$')),'sha256'),'hex'),16)
   or exists(select 1 from public.companies x where x.id=c.id or regexp_replace(lower(x.name),'[^a-z0-9]','','g')=regexp_replace(lower(c.name),'[^a-z0-9]','','g')or regexp_replace(lower(x.website),'^https?://(?:www\.)?([^/]+).*$','\1')=regexp_replace(lower(c.website),'^https?://(?:www\.)?([^/]+).*$','\1'))then raise exception 'New issuer ambiguity gate';end if;
  perform public.assert_market_issuer(q,c,ev,p_result->'issuerProof');
  if exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(c.id,q.id)or e.company_id=c.id))then raise exception 'New issuer exclusion gate';end if;
  insert into public.companies(id,name,overview,subsector,geography,website,is_sample)values(c.id,c.name,c.overview,c.subsector,c.geography,c.website,false);
  insert into public.market_official_sources(url,company_id)values(ev->>'canonicalUrl',c.id)on conflict do nothing;
  select *into c from public.companies where id=c.id;
 else
 select * into c from public.companies where id=t.input->'company'->>'id';
 if not found or to_jsonb(c)is distinct from t.input->'company'or c.is_sample or public.market_resolve_company(q.candidate_company)->>'id'is distinct from c.id then return public.finish_market_review_task_v2(p_task_id,p_lock,jsonb_build_object('disposition','held','reason','company_changed_or_ambiguous'));end if;
  if p_result->'issuerProof'is not null then perform public.assert_market_issuer(q,c,ev,p_result->'issuerProof');insert into public.market_official_sources(url,company_id)values(ev->>'canonicalUrl',c.id)on conflict do nothing;end if;
 end if;
 if q.status<>'pending'or q.gmail_message_id is not null or coalesce(lower(q.source_type),'')not in('article','press release','company blog')or q.activity_type not in('financing','m&a')
  or exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(c.id,q.id,'a-daily-review-'||q.id,'s-daily-review-'||q.id)or e.company_id=c.id))then return public.finish_market_review_task_v2(p_task_id,p_lock,jsonb_build_object('disposition','held','reason','candidate_or_exclusion_gate'));end if;
 perform public.assert_market_transaction(q,c,ev);
 if jsonb_typeof(payload)is distinct from'object'or payload->>'id'is distinct from'a-daily-review-'||q.id or payload->>'source_id'is distinct from's-daily-review-'||q.id or payload->>'company_id'is distinct from c.id or payload->>'date_announced'is distinct from ev->>'eventDate'
  or payload->>'activity_type'is distinct from q.activity_type or (payload->>'deal_value_usd')::numeric is distinct from (ev->>'amountUsd')::numeric or payload->>'source_url'is distinct from ev->>'canonicalUrl'or payload->>'source_type'is distinct from'press release'or payload->>'review_status'is distinct from'approved'or payload->>'confidence'is distinct from'reported'or(payload->>'is_sample')::boolean is distinct from false then raise exception 'Transaction payload conflict';end if;
 select id into duplicate_id from public.activities where company_id=c.id and activity_type=q.activity_type and(date_announced=(ev->>'eventDate')::date or source_url=ev->>'canonicalUrl')limit 1;
 if found then
  if not exists(select 1 from public.activities x where x.id=duplicate_id and x.review_status='approved'and not x.is_sample and x.deal_value_usd is not distinct from q.deal_value_usd and x.date_announced=(ev->>'eventDate')::date and lower(coalesce(x.source_type,''))<>'gmail'and lower(coalesce(x.confidence,''))<>'estimated'
   and coalesce(x.source_url,'')~'^https://[a-zA-Z0-9.-]+(/|$)'and lower(coalesce(x.source_url,''))!~'(news\.google\.com|example\.com|tbd|todo|placeholder|@)'
   and coalesce(x.source_reference,'')||coalesce(x.description,'')||coalesce(x.counterparty,'')!~*'(gmail:|@|forwarded message|\m(tbd|todo|placeholder|example\.com)\M)'
   and not exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(x.id,x.source_id,x.company_id)or e.company_id=x.company_id)))then return public.finish_market_review_task_v2(p_task_id,p_lock,jsonb_build_object('disposition','held','reason','existing_event_requires_review'));end if;
  p_result:=jsonb_build_object('disposition','duplicate','reason','canonical_event_exists','activityId',duplicate_id,'evidence',ev);
  update public.market_review_tasks set status='duplicate',result=p_result,attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('attempt',t.attempts,'at',stamp,'result',p_result)),locked_by=null,lease_until=null,updated_at=stamp where id=t.id;
  update public.review_queue_items set status='merged',duplicate_of_activity_id=duplicate_id where id=q.id;
  return public.summarize_market_review_run(t.run_id);
 end if;
 a:=jsonb_populate_record(null::public.activities,payload);
 a.entered_by:=actor;a.approved_by:=actor;a.entered_at:=stamp;a.approved_at:=stamp;a.last_updated:=(stamp at time zone'utc')::date;a.merged_from_candidate_ids:=array[q.id];a.additional_sources:='[]'::jsonb;a.subsector:=c.subsector;a.geography:=c.geography;
 amount_label:=case when ev->>'currency'='USD'then'$'||trim_scale((ev->>'amountNative')::numeric/case when(ev->>'amountNative')::numeric>=1000000000 then 1000000000 else 1000000 end)::text||case when(ev->>'amountNative')::numeric>=1000000000 then' billion'else' million'end else(ev->>'currency')||' '||trim_scale((ev->>'amountNative')::numeric)::text end;
 amount_label:=coalesce(substring(ev->>'amountQuote'from'(?i)\m(approximately|about|nearly|over|more than)\M\s*(?:US\$|USD|\$|GBP|£|JPY|¥|EUR|€)')||' ','')||amount_label;
 if q.activity_type='m&a'then
  a.description:=(ev->>'counterpartyQuote')||case when ev->>'category'='acquisition-closed'then' completed its acquisition of 'else' announced a definitive agreement to acquire 'end||c.name||' for '||amount_label||'. '||case when ev->>'category'='acquisition-announced'then'The transaction is announced and remains subject to closing conditions. 'else''end||'This is a company-reported transaction.';
  a.counterparty:=ev->>'counterpartyQuote';
 else
  a.description:=c.name||case when ev->>'category'='debt'then' announced '||amount_label||' in debt financing'else' announced '||amount_label||' in '||coalesce(ev->>'round'||' ','')||'financing'end||'. This is a company-reported financing announcement.';
  a.counterparty:='N/A';
 end if;
 if a.description~*'(gmail:|@|forwarded message|begin forwarded)'or a.counterparty~*'(gmail:|@)'then raise exception 'Public text privacy gate';end if;
 if q.activity_type='financing'and ev->>'eventQuote'~*'\mas part of\M.*\mround\M'then a.description:=a.description||' Capital secured is part of a larger round; only the secured amount is recorded.';end if;
 if q.activity_type='financing'and ev->>'round'is not null and substring(ev->>'captureText'from position(ev->>'eventQuote'in ev->>'captureText')for 2500)~*'\minitial tranche announced earlier this year\M'then a.description:=a.description||' Total round value includes an initial tranche announced earlier this year.';end if;
 a.source_reference:=c.name||' transaction announcement';
 insert into public.sources(id,activity_id,type,url,title)values(a.source_id,a.id,'press release',a.source_url,a.source_reference);
 insert into public.activities select a.*;
 update public.review_queue_items set status='approved',source_type='press release',source_url=a.source_url,confidence='reported',intelligence_evidence=coalesce(intelligence_evidence,'[]'::jsonb)||jsonb_build_array(actor||'; verified source '||a.source_url)where id=q.id;
 update public.market_review_tasks set status='published',result=p_result,attempt_results=attempt_results||jsonb_build_array(jsonb_build_object('attempt',t.attempts,'at',stamp,'result',p_result)),locked_by=null,lease_until=null,updated_at=stamp where id=t.id;
 return public.summarize_market_review_run(t.run_id);
end $$;

-- Unchanged holds are reconsidered weekly; changed sources, profiles or candidates retry immediately.
create or replace function public.market_review_input(q public.review_queue_items)returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reviewEngineVersion','atlas-source-resolution-20261019','policyVersion','transactions-v3','candidate',public.market_candidate_snapshot(q),'company',public.market_resolve_company(q.candidate_company),'aliases',jsonb_build_array(q.candidate_company,public.market_resolve_company(q.candidate_company)->>'name'),'registeredSources',coalesce((select jsonb_agg(s.url order by s.url)from public.market_official_sources s where s.company_id=public.market_resolve_company(q.candidate_company)->>'id'),'[]'::jsonb));
$$;
create or replace function public.acquire_market_review_run(p_run_date date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.market_review_runs;window_status text;begin
 if p_run_date is null or p_run_date<>(now()at time zone'utc')::date then raise exception 'Current UTC day required';end if;
 perform pg_advisory_xact_lock(hashtext('market_review_run'));
 -- Resume one outstanding run, including across UTC rollover. Never reselect its IDs.
 select * into v from public.market_review_runs where status='running' order by run_date limit 1;
 if found then return to_jsonb(v);end if;
 select * into v from public.market_review_runs where run_date=p_run_date;
 if found and v.selected>=10 then return to_jsonb(v);end if;
 select case when count(*)>0 and bool_and(status='completed') then 'completed' when count(*)>0 then 'partial' else 'unknown' end into window_status
 from public.ingestion_runs where id='run-web-scheduled-'||p_run_date::text;
 insert into public.market_review_runs(id,run_date,collector_window_status)values('market-review-'||p_run_date,p_run_date,window_status)on conflict(run_date)do update set status='running',completed_at=null returning * into v;
 insert into public.market_review_tasks(id,run_id,candidate_id,input)
 select v.id||'-'||q.id,v.id,q.id,public.market_review_input(q)||jsonb_build_object('selectionOrder',row_number()over(order by q.candidate_date desc,q.created_at desc,q.id))
 from public.review_queue_items q where q.status='pending' and lower(q.source_type)in('article','press release','company blog')
  and q.gmail_message_id is null and q.source_url ~ '^https?://' and q.duplicate_of_activity_id is null
  and q.candidate_date between p_run_date-30 and p_run_date
  and q.activity_type in('financing','m&a')
  and not exists(select 1 from public.market_review_tasks prior where prior.candidate_id=q.id and prior.status in('held','nonqualifying')and prior.updated_at>now()-interval'7 days'and prior.input-'selectionOrder'=public.market_review_input(q))
  and not exists(select 1 from public.market_review_tasks t where t.run_id=v.id and t.candidate_id=q.id)
 order by q.candidate_date desc,q.created_at desc,q.id limit greatest(0,10-v.selected);
 update public.market_review_runs set selected=(select count(*)from public.market_review_tasks where run_id=v.id)where id=v.id;
 return public.summarize_market_review_run(v.id);
end $$;

-- A separately audited catch-up does not masquerade as, or consume, the bounded
-- daily scheduler run. It uses the same transaction evidence and exclusion gates.
create table if not exists public.market_recovery_events(batch_id text not null,candidate_id text not null references public.review_queue_items(id),activity_id text not null references public.activities(id),result jsonb not null,created_at timestamptz not null default now(),primary key(batch_id,candidate_id));
alter table public.market_recovery_events enable row level security;
revoke all on public.market_recovery_events from public,anon,authenticated;
grant select,insert on public.market_recovery_events to service_role;

create or replace function public.publish_market_recovery(p_batch text,p_candidate_id text,p_result jsonb)returns jsonb
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare q public.review_queue_items;c public.companies;a public.activities;ev jsonb;payload jsonb;existing_id text;amount_label text;actor text:='PhysicalAI evidence review: public transaction announcement; user-authorized publication';stamp timestamptz:=now();
begin
 if p_batch!~'^coverage-recovery-[0-9-]{10}$'or octet_length(p_result::text)>150000 or p_result->>'disposition'is distinct from'published'then raise exception 'Explicit recovery batch required';end if;
 lock table public.activities,public.sources,public.companies,public.data_exclusions in share row exclusive mode;
 select *into q from public.review_queue_items where id=p_candidate_id for update;
 if not found or q.status not in('pending','approved')or q.gmail_message_id is not null or q.activity_type not in('financing','m&a')or lower(q.source_type)<>'press release'then raise exception 'Public recovery candidate required';end if;
 select *into c from public.companies where id=public.market_resolve_company(q.candidate_company)->>'id';
 if not found or c.is_sample or exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(c.id,q.id,'a-daily-review-'||q.id,'s-daily-review-'||q.id)or e.company_id=c.id))then raise exception 'Recovery issuer/exclusion conflict';end if;
 ev:=p_result->'evidence';payload:=p_result->'activity';perform public.assert_market_transaction(q,c,ev);
 if payload->>'id'is distinct from'a-daily-review-'||q.id or payload->>'source_id'is distinct from's-daily-review-'||q.id or payload->>'company_id'is distinct from c.id or payload->>'date_announced'is distinct from ev->>'eventDate'or payload->>'activity_type'is distinct from q.activity_type or(payload->>'deal_value_usd')::numeric is distinct from(ev->>'amountUsd')::numeric or payload->>'source_url'is distinct from ev->>'canonicalUrl'then raise exception 'Recovery payload identity conflict';end if;
 select id into existing_id from public.activities where company_id=c.id and activity_type=q.activity_type and(date_announced=(ev->>'eventDate')::date or source_url=ev->>'canonicalUrl')limit 1;
 if found then
  if not exists(select 1 from public.activities x where x.id=existing_id and x.review_status='approved'and not x.is_sample and x.date_announced=(ev->>'eventDate')::date and x.deal_value_usd is not distinct from q.deal_value_usd and x.source_type='press release'and x.source_url=ev->>'canonicalUrl'and not exists(select 1 from public.data_exclusions e where e.restored_at is null and(e.target_id in(x.id,x.source_id,x.company_id)or e.company_id=x.company_id)))then raise exception 'Existing event requires review';end if;
 else
  a:=jsonb_populate_record(null::public.activities,payload);
  a.review_status:='approved';a.confidence:='reported';a.source_type:='press release';a.is_sample:=false;a.entered_by:=actor;a.approved_by:=actor;a.entered_at:=stamp;a.approved_at:=stamp;a.last_updated:=(stamp at time zone'utc')::date;a.merged_from_candidate_ids:=array[q.id];a.additional_sources:='[]'::jsonb;a.subsector:=c.subsector;a.geography:=c.geography;
  amount_label:=case when ev->>'currency'='USD'then'$'||trim_scale((ev->>'amountNative')::numeric/case when(ev->>'amountNative')::numeric>=1000000000 then 1000000000 else 1000000 end)::text||case when(ev->>'amountNative')::numeric>=1000000000 then' billion'else' million'end else(ev->>'currency')||' '||trim_scale((ev->>'amountNative')::numeric)::text end;
 amount_label:=coalesce(substring(ev->>'amountQuote'from'(?i)\m(approximately|about|nearly|over|more than)\M\s*(?:US\$|USD|\$|GBP|£|JPY|¥|EUR|€)')||' ','')||amount_label;
  if q.activity_type='m&a'then
   a.description:=(ev->>'counterpartyQuote')||case when ev->>'category'='acquisition-closed'then' completed its acquisition of 'else' announced a definitive agreement to acquire 'end||c.name||' for '||amount_label||'. '||case when ev->>'category'='acquisition-announced'then'The transaction is announced and remains subject to closing conditions. 'else''end||'This is a company-reported transaction.';a.counterparty:=ev->>'counterpartyQuote';
  else a.description:=c.name||case when ev->>'category'='debt'then' announced '||amount_label||' in debt financing'else' announced '||amount_label||' in '||coalesce(ev->>'round'||' ','')||'financing'end||'. This is a company-reported financing announcement.';a.counterparty:='N/A';end if;
  if q.activity_type='financing'and ev->>'eventQuote'~*'\mas part of\M.*\mround\M'then a.description:=a.description||' Capital secured is part of a larger round; only the secured amount is recorded.';end if;
 if q.activity_type='financing'and ev->>'round'is not null and substring(ev->>'captureText'from position(ev->>'eventQuote'in ev->>'captureText')for 2500)~*'\minitial tranche announced earlier this year\M'then a.description:=a.description||' Total round value includes an initial tranche announced earlier this year.';end if;
 a.source_reference:=c.name||' transaction announcement';
  if a.description~*'(gmail:|@|forwarded message|begin forwarded)'or a.counterparty~*'(gmail:|@)'then raise exception 'Recovery privacy gate';end if;
  insert into public.sources(id,activity_id,type,url,title)values(a.source_id,a.id,a.source_type,a.source_url,a.source_reference);insert into public.activities select a.*;existing_id:=a.id;
 end if;
 update public.review_queue_items set status='approved',confidence='reported',intelligence_evidence=coalesce(intelligence_evidence,'[]'::jsonb)||case when status='pending'then jsonb_build_array(p_batch||'; verified public transaction source')else'[]'::jsonb end where id=q.id;
 insert into public.market_recovery_events(batch_id,candidate_id,activity_id,result)values(p_batch,q.id,existing_id,p_result)on conflict do nothing;
 return jsonb_build_object('candidateId',q.id,'activityId',existing_id,'status','verified');
end $$;

create or replace function public.market_publication_coverage()returns jsonb
language sql stable security invoker set search_path='' as $$
 with q as(select *from public.review_queue_items where status in('pending','held')and gmail_message_id is null and source_url~'^https?://'and candidate_date between(now()at time zone'utc')::date-30 and(now()at time zone'utc')::date and activity_type in('financing','m&a')and duplicate_of_activity_id is null),
 counts as(select count(*)filter(where status='pending')as candidates,count(*)filter(where status='held')as held_candidates,count(*)filter(where public.market_resolve_company(candidate_company)is null)as unresolved_issuers,count(*)filter(where source_url~'^https?://news\.google\.com/')as aggregator_sources,min(candidate_date)as oldest_candidate from q)
 select jsonb_build_object('complete',true,'asOf',now(),'scope','public-financing-and-ma-candidates-last-30-days','pendingCandidates',candidates,'heldCandidates',held_candidates,'unresolvedIssuers',unresolved_issuers,'unresolvedSourceLinks',aggregator_sources,'oldestCandidateDate',oldest_candidate,'marketCompleteness','not-established')from counts;
$$;

revoke all on function public.market_review_input(public.review_queue_items),public.acquire_market_review_run(date),public.assert_market_issuer(public.review_queue_items,public.companies,jsonb,jsonb),public.assert_market_transaction(public.review_queue_items,public.companies,jsonb),public.finish_market_review_task(text,uuid,jsonb),public.finish_market_review_task_v2(text,uuid,jsonb),public.publish_market_recovery(text,text,jsonb),public.market_publication_coverage()from public,anon,authenticated;
grant execute on function public.market_review_input(public.review_queue_items),public.acquire_market_review_run(date),public.assert_market_issuer(public.review_queue_items,public.companies,jsonb,jsonb),public.assert_market_transaction(public.review_queue_items,public.companies,jsonb),public.finish_market_review_task(text,uuid,jsonb),public.finish_market_review_task_v2(text,uuid,jsonb),public.publish_market_recovery(text,text,jsonb),public.market_publication_coverage()to service_role;
commit;
