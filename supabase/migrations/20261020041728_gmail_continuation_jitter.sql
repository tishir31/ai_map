-- A two-minute cron can arrive a fraction of a second before the previous
-- dispatch's two-minute mark. Ninety seconds still exceeds the deployed
-- function's maximum execution duration and avoids accidentally skipping a tick.
begin;
do $$declare d text;begin
 select pg_get_functiondef('private.dispatch_physical_ai_job(text,date)'::regprocedure)into d;
 if position('p_job_name=''ingest-gmail''then interval ''2 minutes'''in d)=0 then raise exception 'Gmail continuation guard changed; review required';end if;
 d:=replace(d,'p_job_name=''ingest-gmail''then interval ''2 minutes''','p_job_name=''ingest-gmail''then interval ''90 seconds''');
 execute d;
end$$;
commit;
