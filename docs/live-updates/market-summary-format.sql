begin;
do $format$
declare
  definition text;
  original text := '(q.deal_value_usd/1000000)::text';
  replacement text := 'trim_scale(q.deal_value_usd/1000000)::text';
begin
  select pg_get_functiondef('public.finish_market_review_task(text,uuid,jsonb)'::regprocedure) into definition;
  if strpos(definition, replacement) > 0 then return; end if;
  if md5(definition) <> 'dfd1017da81faed10bc3e33b7306ed10'
     or (length(definition) - length(replace(definition, original, ''))) / length(original) <> 1 then
    raise exception 'Reviewed publication function changed; stop formatting patch';
  end if;
  execute replace(definition, original, replacement);
end $format$;

update public.activities
set description = replace(description, '$250.0000000000000000 million', '$250 million')
where id = 'a-daily-review-rq-live-recovery-vinci-2026-10-06'
  and company_id = 'c-vinci-physics' and deal_value_usd = 250000000
  and review_status = 'approved'
  and description like '%$250.0000000000000000 million%';

update public.activities
set description = replace(description, '$75.0000000000000000 million', '$75 million')
where id = 'a-daily-review-rq-live-recovery-multiply-2026-10-06'
  and company_id = 'c-multiply-labs' and deal_value_usd = 75000000
  and review_status = 'approved'
  and description like '%$75.0000000000000000 million%';
commit;
