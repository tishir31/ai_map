-- Prepared only. Activate after the actual Tyrant producer capability is verified.
-- The producer sends only a public URL, never chat text. The URL is its retry key.
begin;
create table public.tyrant_news_links(
 id uuid primary key default gen_random_uuid(),
 source_url text not null unique,
 shared_at timestamptz not null default now(),
 source_title text check(length(source_title) between 8 and 200),
 headline_status text not null default 'link_only' check(headline_status in('link_only','source_headline')),
 attempts integer not null default 0 check(attempts between 0 and 2),
 dispatches integer not null default 0 check(dispatches between 0 and 2),
 last_dispatch_at timestamptz,
 lease_id uuid,
 lease_until timestamptz,
 last_result text check(last_result in('source_unavailable','headline_unavailable','source_headline')),
 withdrawn_at timestamptz,
 check((headline_status='source_headline')=(source_title is not null))
);
alter table public.tyrant_news_links enable row level security;
revoke all on public.tyrant_news_links from public,anon,authenticated;
grant select,update on public.tyrant_news_links to service_role;

create function public.is_tyrant_public_news_url(p_url text)returns boolean
language sql immutable security invoker set search_path=''as $$
 select length(p_url)<=1500 and p_url!~'[[:space:]?#@]'and p_url ~ '^https://(prtimes\.jp/main/html/rd/p/[A-Za-z0-9._-]+\.html|www\.tesollo\.com/news/press/[a-z0-9-]+|www\.semafor\.com/article/[0-9]{2}/[0-9]{2}/[0-9]{4}/[a-z0-9-]+|www\.tectonicdefense\.com/[a-z0-9-]+/?|www\.globenewswire\.com/news-release/[0-9/]+[A-Za-z0-9/_-]+\.html|origin\.tech/blog/[a-z0-9-]+|www\.fugro\.com/news/press-releases/[0-9]{4}/[a-z0-9-]+)$';
$$;
revoke all on function public.is_tyrant_public_news_url(text)from public,anon,authenticated;
grant execute on function public.is_tyrant_public_news_url(text)to service_role;
alter table public.tyrant_news_links add constraint tyrant_news_public_url check(public.is_tyrant_public_news_url(source_url));

-- Owner-only connector entry point. No new producer API key or browser grant.
create function private.submit_tyrant_public_news(p_source_url text)returns jsonb
language plpgsql security invoker set search_path=''as $$
declare item public.tyrant_news_links;secret text;token text;today text;request_id bigint;
begin
 if p_source_url is null or not public.is_tyrant_public_news_url(p_source_url)then raise exception 'A supported public news URL is required';end if;
 perform pg_advisory_xact_lock(hashtext('tyrant_news_receive'));
 select *into item from public.tyrant_news_links where source_url=p_source_url;
 if not found then
   if(select count(*)from public.tyrant_news_links where shared_at>now()-interval '24 hours')>=50 then raise exception 'News link daily budget reached';end if;
   insert into public.tyrant_news_links(source_url)values(p_source_url)returning *into item;
 end if;
 if item.withdrawn_at is not null then return jsonb_build_object('id',item.id,'status','withdrawn');end if;
 -- Publication of the URL is independent of optional headline retrieval.
 -- Dispatch failures retain the link and never expose Vault contents.
 if item.headline_status='link_only'and item.attempts<2 and item.dispatches<2 and(item.lease_until is null or item.lease_until<now())and(item.last_dispatch_at is null or item.last_dispatch_at<now()-interval '2 minutes')then
  begin
   select decrypted_secret into strict secret from vault.decrypted_secrets where name='physical_ai_scheduler_v1';
   if secret!~'^[a-f0-9]{64}$'then raise exception 'Scheduler unavailable';end if;
   today:=(now()at time zone'utc')::date::text;
   token:=encode(extensions.hmac('physical-ai-scheduler|v1|tyrant-news-enrich|'||today,secret,'sha256'),'hex');
   request_id:=net.http_get(url:='https://ai-map-cyan.vercel.app/api/tyrant-news-enrich?id='||item.id,
    headers:=jsonb_build_object('Authorization','Bearer '||token,'x-physical-ai-scheduler','v1','x-physical-ai-job','tyrant-news-enrich','x-physical-ai-run-key','tyrant-news-enrich:'||today),timeout_milliseconds:=20000);
   update public.tyrant_news_links set dispatches=dispatches+1,last_dispatch_at=now()where id=item.id;
  exception when others then request_id:=null;end;
 end if;
 return jsonb_build_object('id',item.id,'status',item.headline_status,'headlineRequestQueued',request_id is not null,'financialTotalsEligible',false);
end$$;
revoke all on function private.submit_tyrant_public_news(text)from public,anon,authenticated,service_role;

create function public.claim_tyrant_news_headline(p_id uuid)returns jsonb
language plpgsql security invoker set search_path=''as $$
declare item public.tyrant_news_links;begin
 select *into item from public.tyrant_news_links where id=p_id for update;
 if not found or item.withdrawn_at is not null or item.headline_status<>'link_only'or item.attempts>=2 or(item.lease_until is not null and item.lease_until>now())then return null;end if;
 update public.tyrant_news_links set attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '90 seconds'where id=p_id returning *into item;
 return jsonb_build_object('id',item.id,'sourceUrl',item.source_url,'leaseId',item.lease_id);
end$$;
create function public.finish_tyrant_news_headline(p_id uuid,p_lease uuid,p_title text,p_result text)returns boolean
language plpgsql security invoker set search_path=''as $$
begin
 if p_result not in('source_headline','source_unavailable','headline_unavailable')or p_result is null then raise exception 'Invalid headline outcome';end if;
 if p_title is not null and(length(p_title)not between 8 and 200 or p_title~'[<>[:cntrl:]]'or p_title~*'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'or p_result<>'source_headline')then raise exception 'Only a public source headline is accepted';end if;
 if(p_title is not null)<>(p_result='source_headline')then raise exception 'Headline outcome conflicts';end if;
 update public.tyrant_news_links set source_title=p_title,headline_status=case when p_title is null then'link_only'else'source_headline'end,
  lease_id=null,lease_until=null,last_result=p_result
 where id=p_id and lease_id=p_lease and lease_until>now()and withdrawn_at is null;
 return found;
end$$;
revoke all on function public.claim_tyrant_news_headline(uuid),public.finish_tyrant_news_headline(uuid,uuid,text,text)from public,anon,authenticated;
grant execute on function public.claim_tyrant_news_headline(uuid),public.finish_tyrant_news_headline(uuid,uuid,text,text)to service_role;
commit;
