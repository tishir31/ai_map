-- Match the public collector's maximum batch, retaining two attempts per lead.
-- This changes future capacity; no existing run, task or budget is reset.
alter table public.market_review_runs drop constraint market_review_runs_selected_check;
alter table public.market_review_runs add constraint market_review_runs_selected_check check(selected between 0 and 32);
alter table public.market_review_daily_budget drop constraint market_review_daily_budget_attempts_check;
alter table public.market_review_daily_budget add constraint market_review_daily_budget_attempts_check check(attempts between 0 and 64);
alter table public.market_review_daily_budget drop constraint market_review_daily_budget_task_ids_check;
alter table public.market_review_daily_budget add constraint market_review_daily_budget_task_ids_check check(cardinality(task_ids)<=32);
do $$
declare f text;definition text;
begin
 foreach f in array array['public.acquire_market_review_run(date)','public.claim_market_review_task(text)'] loop
  select pg_get_functiondef(f::regprocedure) into definition;
  definition:=replace(replace(replace(replace(replace(definition,'v.selected>=10','v.selected>=32'),'10-v.selected','32-v.selected'),'limit 10','limit 32'),'b.attempts>=20','b.attempts>=64'),'cardinality(b.task_ids)<10','cardinality(b.task_ids)<32');
  execute definition;
 end loop;
end $$;
