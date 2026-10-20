-- The recovery finisher was cloned before the daily formatter changed.
-- Keep its source-derived facility wording aligned without changing gates.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.finish_market_recovery_task(text,uuid,jsonb)'::regprocedure) into definition;
 execute replace(definition,''' closed ''',''' announced ''');
end $$;
