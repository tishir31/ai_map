-- Preserve public-source, exact-quote, amount, date, duplicate and private-data gates.
-- A new engine fingerprint lets unchanged earlier holds be reconsidered safely.
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
  verbs:='(?:(?:(?:today|has|have|now|successfully)\s+){0,3}(?:raised|raises|secured|closed|closes|announced|announces|announcing)\s+(?:(?:(?:that\s+)?it\s+has\s+(?:raised|secured|closed)|has\s+(?:raised|secured|closed)|the\s+(?:close|closing|completion)\s+of|its|a|an|approximately|about|nearly|over|more\s+than)\s+){0,5}|(?:(?:today|has)\s+){0,2}(?:emerged|emerges)\s+from\s+stealth\s+with\s+|(?:(?:today|has)\s+){0,2}closed\s+(?:its|the|a)\s+Series\s+[A-Z][0-9]?\s+(?:funding\s+)?round\s+with\s+)';
  binding:='^'||statement||app||verbs||'(?:US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:billion|million|bn|b|m))?$';
  if ev->>'amountQuote'!~*binding then raise exception 'Issuer-led financing amount required';end if;
  if substring(ev->>'eventQuote'from length(ev->>'amountQuote')+1)~*'^\s*(?:in\s+)?(?:total|cumulative|valuation|revenue|investment in\M|investment into\M)'then raise exception 'Current financing episode required';end if;
  if (select count(*)from regexp_matches(ev->>'amountQuote','(?:US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:billion|million|bn|b|m))?','gi'))<>1 then raise exception 'Single bound amount required';end if;
  if (ev->>'category'='debt')is distinct from (ev->>'eventQuote'~*'\m(term loan|debt financing|credit facility|loan facility)\M') then raise exception 'Debt/equity classification conflict';end if;
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

create or replace function public.market_review_input(q public.review_queue_items)returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reviewEngineVersion','atlas-source-resolution-20261019','policyVersion','transactions-v3','candidate',public.market_candidate_snapshot(q),'company',public.market_resolve_company(q.candidate_company),'aliases',jsonb_build_array(q.candidate_company,public.market_resolve_company(q.candidate_company)->>'name'),'registeredSources',coalesce((select jsonb_agg(s.url order by s.url)from public.market_official_sources s where s.company_id=public.market_resolve_company(q.candidate_company)->>'id'),'[]'::jsonb));
$$;
commit;
