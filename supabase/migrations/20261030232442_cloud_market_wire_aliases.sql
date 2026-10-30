begin;
create or replace function public.assert_market_issuer(q public.review_queue_items,c public.companies,ev jsonb,proof jsonb)returns void
language plpgsql security invoker set search_path='' as $$
declare h text;root text;home text;about_pos integer;link_pos integer;about_name text;binding text;parts text[];k text;
begin
 if proof is null or jsonb_typeof(proof)is distinct from'object' or ev is null then raise exception 'Issuer proof required';end if;
 foreach k in array array['wireUrl','website','websiteQuote','sourceText','sourceHash','homepageUrl','homepageText','homepageHash']loop if coalesce(proof->>k,'')=''then raise exception 'Issuer proof field required';end if;end loop;
 h:=lower(substring(proof->>'wireUrl'from'^https://([a-zA-Z0-9.-]+)/'));
 if h is null or h not in('prnewswire.com','www.prnewswire.com','businesswire.com','www.businesswire.com','globenewswire.com','www.globenewswire.com','rss.globenewswire.com')or proof->>'wireUrl'is distinct from ev->>'canonicalUrl'or proof->>'website'is distinct from c.website then raise exception 'Issuer wire authority required';end if;
 if proof->>'sourceText'is distinct from ev->>'captureText'or proof->>'sourceHash'is distinct from ev->>'captureHash'or length(proof->>'homepageText')not between 10 and 100000 or proof->>'homepageHash'is distinct from encode(extensions.digest(proof->>'homepageText','sha256'),'hex')then raise exception 'Issuer capture integrity required';end if;
 root:=regexp_replace(lower(substring(c.website from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 home:=regexp_replace(lower(substring(proof->>'homepageUrl'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 if root is null or home is null or not(home=root or right(home,length(root)+1)='.'||root)or position(lower(c.name)in lower(proof->>'homepageText'))=0 then raise exception 'Issuer homepage brand required';end if;
 home:=regexp_replace(lower(substring(proof->>'websiteQuote'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 about_name:=coalesce(proof->>'aboutName',c.name);
 if about_name is distinct from c.name then
  binding:=proof->>'nameBindingQuote';
  if length(about_name)not between 3 and 80 or length(binding)not between 3 and 1500 or position(binding in proof->>'sourceText')=0
   or left(lower(c.name),length(about_name)+1)is distinct from lower(about_name)||' '
   or substring(c.name from length(about_name)+2)!~*'^(?:(?:Industries|Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|Technologies|Technology|Robotics|Group|Holdings|LLC|PLC)\s*)+$'
   or left(lower(binding),length(c.name))is distinct from lower(c.name) then raise exception 'Explicit issuer alias binding required';end if;
  parts:=regexp_match(substring(binding from length(c.name)+1),'^(?:\s+https://\S+)?\s*\(\s*[“"]([^”"]{3,80})[”"](?:\s+or\s+(?:the\s+)?[“"](?:the\s+)?Company[”"])?\s*\)$','i');
  if parts[1]is distinct from about_name then raise exception 'Explicit issuer alias binding required';end if;
 end if;
 about_pos:=position('about '||lower(about_name)in lower(proof->>'sourceText'));link_pos:=position(proof->>'websiteQuote'in proof->>'sourceText');
 if home is null or about_pos=0 or link_pos=0 or link_pos<greatest(1,about_pos-300) or link_pos>about_pos+4000 or not(home=root or right(home,length(root)+1)='.'||root)then raise exception 'Issuer supplied website binding required';end if;
 if regexp_replace(lower(q.candidate_company),'[^a-z0-9]','','g')is distinct from regexp_replace(lower(c.name),'[^a-z0-9]','','g')and public.market_resolve_company(q.candidate_company)->>'id'is distinct from c.id then raise exception 'Issuer name conflict';end if;
end $$;

create or replace function public.finish_cloud_market_task(p_id text,p_lock uuid,p_result jsonb)returns jsonb language plpgsql security invoker set search_path=''set lock_timeout='5s' as $$
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
   if p_result->'issuerProof'->>'aboutName' is not null then
    k:=regexp_replace(lower(p_result->'issuerProof'->>'aboutName'),'[^a-z0-9]','','g');
    if k=''or exists(select 1 from public.market_company_aliases where alias_key=k and company_id<>cid)or exists(select 1 from public.companies where id<>cid and regexp_replace(lower(name),'[^a-z0-9]','','g')=k)then raise exception 'Issuer alias identity conflict';end if;
    insert into public.market_company_aliases(alias_key,company_id)values(k,cid)on conflict do nothing;
   end if;
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


commit;
