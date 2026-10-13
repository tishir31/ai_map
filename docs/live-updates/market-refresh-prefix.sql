create table if not exists public.market_company_aliases(alias_key text primary key, company_id text not null references public.companies(id), verified_at timestamptz not null default now());
create table if not exists public.market_official_sources(url text primary key, company_id text not null references public.companies(id), verified_at timestamptz not null default now());
alter table public.market_company_aliases enable row level security;
alter table public.market_official_sources enable row level security;
revoke all on public.market_company_aliases,public.market_official_sources from public,anon,authenticated;
grant select,insert,update,delete on public.market_company_aliases,public.market_official_sources to service_role;
create or replace function public.market_resolve_company(p_name text) returns jsonb language sql stable security invoker set search_path='' as $$
 with matches as (
 select c.* from public.companies c where not c.is_sample and c.website is not null and
 (regexp_replace(lower(c.name),'[^a-z0-9]','','g')=regexp_replace(lower(p_name),'[^a-z0-9]','','g') or exists(select 1 from public.market_company_aliases a where a.company_id=c.id and a.alias_key=regexp_replace(lower(p_name),'[^a-z0-9]','','g')))
 ) select case when count(*)=1 then jsonb_agg(to_jsonb(matches))->0 else null end from matches;
$$;
create or replace function public.assert_market_financing_v2(q public.review_queue_items,c public.companies,ev jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare quote text;h text;root text;parts text[];amount numeric;names text[];name text;bound boolean:=false;d date;stmt text;
begin
 if jsonb_typeof(ev)is distinct from 'object' then raise exception 'Evidence required';end if;
 foreach quote in array array['canonicalUrl','companyId','companyWebsite','eventDate','amountUsd','moneyToken','issuerQuote','dateQuote','amountQuote','eventQuote','physicalQuote','captureText','captureHash']loop
  if coalesce(ev->>quote,'')=''then raise exception 'Required evidence missing';end if;
 end loop;
 if length(ev->>'captureText')not between 80 and 100000 or ev->>'captureHash' is distinct from encode(extensions.digest(ev->>'captureText','sha256'),'hex')then raise exception 'Capture hash/size gate';end if;
 h:=regexp_replace(lower(substring(ev->>'canonicalUrl'from'^https://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 root:=regexp_replace(lower(substring(c.website from'^https?://([a-zA-Z0-9.-]+)(?:/|$)')),'^www\.','');
 if h is null or root is null or not(h=root or right(h,length(root)+1)='.'||root or exists(select 1 from public.market_official_sources s where s.company_id=c.id and s.url=ev->>'canonicalUrl'))then raise exception 'Official source required';end if;
 if ev->>'companyId' is distinct from c.id or ev->>'companyWebsite' is distinct from c.website then raise exception 'Issuer identity conflict';end if;
 foreach quote in array array['issuerQuote','dateQuote','amountQuote','eventQuote','physicalQuote']loop
  if length(ev->>quote)not between 3 and 1500 or position(ev->>quote in ev->>'captureText')=0 then raise exception 'Exact quote missing';end if;
 end loop;
 if ev->>'eventQuote'~*'\m(not|never|denied|denies|rumou?r|fictional|hypothetical|illustrative|fabricated|template|canceled|cancelled|withdrawn|unclosed|pending|subject to|has yet to|will close|expected to close|plans?|aims?|expects?|seeking|may|might)\M' or ev->>'eventQuote'!~*'\m(funding|financing|series|round)\M'
 or ev->>'captureText'~*'\m(false reports?|fabricated|hypothetical|correction|retracted|retraction|financing was canceled|financing was cancelled|round never closed|round was withdrawn)\M'then raise exception 'Financing status conflict';end if;
 parts:=regexp_match(ev->>'moneyToken','^(?:US\$|USD\s*|\$)\s*([0-9,]+(?:\.[0-9]+)?)\s*(billion|million|bn|b|m)$','i');
 if parts is null then raise exception 'Dollar token required';end if;
 if ev->>'moneyToken'!~*'^(US\$|USD)' and c.geography not in('US','USA','United States')then raise exception 'Currency requires review';end if;
 amount:=replace(parts[1],',','')::numeric*case when lower(parts[2])in('billion','bn','b')then 1000000000 else 1000000 end;
 if amount<=0 or amount is distinct from q.deal_value_usd or amount is distinct from (ev->>'amountUsd')::numeric or position(ev->>'moneyToken'in ev->>'amountQuote')=0 or position(ev->>'amountQuote'in ev->>'eventQuote')=0 then raise exception 'Amount binding conflict';end if;
 names:=array[c.name];
 select names||coalesce(array_agg(alias_key),'{}'::text[])into names from public.market_company_aliases where company_id=c.id;
 -- The exact source issuer may use a verified alias; the full clause is still independently bound to the amount.
 if public.market_resolve_company(ev->>'issuerQuote')->>'id' is distinct from c.id then raise exception 'Quoted issuer conflict';end if;
 name:=ev->>'issuerQuote';
 stmt:=replace(replace(replace(replace(name,'\','\\'),'.','\.'),'(','\('),')','\)');
 if ev->>'amountQuote' !~* ('^'||stmt||'(,\s+[^,]{1,220},)?\s+((today|has|have|now|successfully)\s+){0,3}(raised|raises|secured|closed|closes|announced|announces)\s+((a|an|its)\s+)?(US\$|USD\s*|\$)')then raise exception 'Issuer funding clause required';end if;
 d:=(ev->>'eventDate')::date;
 if d>(now()at time zone'utc')::date or d<(now()at time zone'utc')::date-30 or abs(d-q.candidate_date)>7 then raise exception 'Event date conflict';end if;
 if position(d::text in ev->>'dateQuote')=0 and position(lower(to_char(d,'FMMonth FMDD YYYY'))in regexp_replace(lower(ev->>'dateQuote'),'[.,]','','g'))=0 and position(lower(to_char(d,'FMMon FMDD YYYY'))in regexp_replace(lower(ev->>'dateQuote'),'[.,]','','g'))=0 then raise exception 'Quoted announcement date conflict';end if;
 if ev->>'physicalQuote'!~*'\m(robots?|robotics|autonomous|simulation|physics|physical AI|hardware engineering|sensors?|drones?|manufacturing)\M' or ev->>'physicalQuote'!~*'\m(builds?|building|develops?|automates?|automating|platform|manufactures?|manufacturing|robotics integrator|supply|deployments?|simulation|reasoning|physical AI company)\M' or ev->>'physicalQuote'~*'\m(not|never|denied|rumou?r|fictional|hypothetical|plans?|seeking|may|might)\M'then raise exception 'Physical application required';end if;
 if ev->>'round' is not null and(ev->>'round'!~*'^(Series [A-Z][0-9]?|pre-seed|seed)$'or position(lower(ev->>'round')in lower(ev->>'eventQuote'))=0)or ev->>'lead'is not null then raise exception 'Optional financing fields unsupported';end if;
end $$;
