-- Additive repair for an already-installed collector reliability schema.
-- It preserves frozen tasks, counters, scheduler jobs, review state and audit rows.
begin;
create or replace function public.web_collection_rate_limit_guard()returns trigger language plpgsql security invoker set search_path=''as $$
begin
 if new.result->>'disposition'='error'and new.result->>'reason'='provider-rate-limit'then
  new.available_at:=greatest(new.available_at,now()+interval'30 minutes');
  update public.web_collection_tasks set available_at=greatest(available_at,now()+interval'30 minutes'),updated_at=now()
   where run_id=new.run_id and id<>new.id and kind='item'and status='pending';
 elsif new.result->>'disposition'is distinct from'error'and new.result is distinct from old.result then
  update public.web_collection_runs set stop_reason=null where id=new.run_id and stop_reason='provider-rate-limit';
 end if;
 return new;
end$$;
revoke all on function public.web_collection_rate_limit_guard()from public,anon,authenticated,service_role;
drop trigger if exists web_collection_rate_limit_guard on public.web_collection_tasks;
create trigger web_collection_rate_limit_guard before update of result on public.web_collection_tasks for each row execute function public.web_collection_rate_limit_guard();
commit;
