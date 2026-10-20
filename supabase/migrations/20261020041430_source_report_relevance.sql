begin;
create function public.is_market_source_headline(h text)returns boolean
language sql immutable security invoker set search_path=''as $$
 select coalesce(length(h)between 8 and 500 and h!~'[<>@]'
 and h~*'\m(robots?|robotic|robotics|humanoids?|autonomous|autonomy|embodied|physical AI|lidar|drones?|uncrewed|unmanned|industrial automation)\M'
 and(h~*'\m(funding|financing|series|seed|acqui\w*|merger|launch\w*|unveil\w*|partner\w*|deploy\w*|contracts?|investments?)\M'
  or h~*'\m(raises?|raised|secures?|secured)\M\s+(?:US\$|USD|\$|€|£|¥|[0-9])')
 and h!~*'\m(market size|forecast|CAGR|class action|investor alert|shareholder investigation|Extend Robotics|investment pick|stock picks?|share price|analyst rating|prominent analyst)\M'
 and not(h~*'\m(cybersecurity|offensive.security|pentest\w*|penetration.testing|attack.surface)\M'and h!~*'\m(robots?|robotics|humanoids?|sensors?|hardware|embedded|vehicles?|drones?|industrial|manufacturing|cyber.physical)\M'),false);
$$;
revoke all on function public.is_market_source_headline(text)from public,anon,authenticated;
grant execute on function public.is_market_source_headline(text)to service_role;
do $$declare d text;a integer;b integer;begin
 select pg_get_functiondef('public.publish_market_source_report_items(jsonb)'::regprocedure)into d;
 a:=position('if length(h)'in d);b:=position('and u~'in d);
 if a=0 or b<=a then raise exception 'Source report filter changed; review required';end if;
 d:=substring(d from 1 for a-1)||'if public.is_market_source_headline(h) '||substring(d from b);
 execute d;
end$$;
-- Retain rejected feed history; withdraw only presentation rows that fail the
-- same predicate used for all future public headlines.
update public.market_source_reports set withdrawn_at=now()where withdrawn_at is null and not public.is_market_source_headline(headline);
commit;
