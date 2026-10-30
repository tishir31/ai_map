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
