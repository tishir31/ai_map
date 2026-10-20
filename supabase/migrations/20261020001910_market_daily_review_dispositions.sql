-- Retain completed research holds outside the pending inbox. A corrected
-- material source field reopens a public lead for the same evidence gates.
create or replace function public.reconcile_market_review_disposition() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('held','nonqualifying','error') and new.status is distinct from old.status then
  update public.review_queue_items q set status=case when new.status='nonqualifying' then 'rejected' else 'held' end,
   intelligence_evidence=coalesce(q.intelligence_evidence,'[]'::jsonb)||jsonb_build_array('Public daily review: '||coalesce(new.result->>'reason','source_evidence_required'))
  where q.id=new.candidate_id and q.status='pending' and q.gmail_message_id is null and lower(btrim(q.source_type)) in ('article','press release','company blog');
 end if;
 return new;
end $$;
create trigger market_review_terminal_disposition after update of status on public.market_review_tasks
for each row execute function public.reconcile_market_review_disposition();

create or replace function public.reopen_corrected_market_lead() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.status='held' and new.status='held' and old.gmail_message_id is null and new.gmail_message_id is null
  and row(new.candidate_company,new.candidate_date,new.activity_type,new.deal_value_usd,new.description,new.source_url,new.source_type)
   is distinct from row(old.candidate_company,old.candidate_date,old.activity_type,old.deal_value_usd,old.description,old.source_url,old.source_type)
 then new.status:='pending';end if;
 return new;
end $$;
create trigger market_review_corrected_lead before update on public.review_queue_items
for each row execute function public.reopen_corrected_market_lead();
revoke all on function public.reconcile_market_review_disposition(),public.reopen_corrected_market_lead() from public,anon,authenticated;
grant execute on function public.reconcile_market_review_disposition(),public.reopen_corrected_market_lead() to service_role;
