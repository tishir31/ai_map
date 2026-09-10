-- Private, bounded transport for a previously validated bootstrap envelope.
-- A complete byte-identical payload is required before any public data changes.
begin;
create table public.ecosystem_bootstrap_uploads (
 id uuid primary key, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_count integer not null check(byte_count between 1 and 10000000),
 chunk_count integer not null check(chunk_count between 1 and 220), expected_version text,
 created_at timestamptz not null default now(), result jsonb
);
create table public.ecosystem_bootstrap_chunks (
 upload_id uuid references public.ecosystem_bootstrap_uploads(id) on delete cascade,
 chunk_index integer not null check(chunk_index between 0 and 219),
 payload bytea not null check(octet_length(payload) between 1 and 48000),
 primary key(upload_id,chunk_index)
);
alter table public.ecosystem_bootstrap_uploads enable row level security;
alter table public.ecosystem_bootstrap_chunks enable row level security;
revoke all on public.ecosystem_bootstrap_uploads,public.ecosystem_bootstrap_chunks from public,anon,authenticated;
grant all on public.ecosystem_bootstrap_uploads,public.ecosystem_bootstrap_chunks to service_role;

create function public.begin_ecosystem_bootstrap(p_id uuid,p_sha256 text,p_byte_count integer,p_chunk_count integer,p_expected_version text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_bootstrap_uploads; begin
 delete from public.ecosystem_bootstrap_uploads where result is null and created_at<now()-interval '1 day';
 insert into public.ecosystem_bootstrap_uploads(id,sha256,byte_count,chunk_count,expected_version)
 values(p_id,p_sha256,p_byte_count,p_chunk_count,p_expected_version) on conflict(id) do nothing;
 select * into strict r from public.ecosystem_bootstrap_uploads where id=p_id for update;
 if r.sha256 is distinct from p_sha256 or r.byte_count is distinct from p_byte_count or r.chunk_count is distinct from p_chunk_count or r.expected_version is distinct from p_expected_version then raise exception 'Bootstrap upload identity conflict'; end if;
 return true;
end $$;

create function public.put_ecosystem_bootstrap_chunk(p_id uuid,p_index integer,p_base64 text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_bootstrap_uploads; b bytea; old_b bytea; begin
 select * into strict r from public.ecosystem_bootstrap_uploads where id=p_id for update;
 if r.result is not null then return true; end if;
 if r.created_at<now()-interval '1 day' then raise exception 'Bootstrap upload expired'; end if;
 if p_index is null or p_index<0 or p_index>=r.chunk_count or p_base64 is null or octet_length(p_base64)>64000 then raise exception 'Invalid bootstrap chunk'; end if;
 b:=decode(p_base64,'base64');
 insert into public.ecosystem_bootstrap_chunks(upload_id,chunk_index,payload) values(p_id,p_index,b) on conflict(upload_id,chunk_index) do nothing;
 select payload into strict old_b from public.ecosystem_bootstrap_chunks where upload_id=p_id and chunk_index=p_index;
 if old_b<>b then raise exception 'Bootstrap chunk conflict'; end if;
 return true;
end $$;

create function public.finish_ecosystem_bootstrap(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.ecosystem_bootstrap_uploads; body bytea; envelope jsonb; manifest jsonb; answer jsonb; n integer; begin
 select * into strict r from public.ecosystem_bootstrap_uploads where id=p_id for update;
 if r.result is not null then return r.result; end if;
 if r.created_at<now()-interval '1 day' then raise exception 'Bootstrap upload expired'; end if;
 select count(*),string_agg(payload,''::bytea order by chunk_index) into n,body from public.ecosystem_bootstrap_chunks where upload_id=p_id;
 if n<>r.chunk_count then raise exception 'Bootstrap chunks incomplete'; end if;
 if octet_length(body)<>r.byte_count or encode(extensions.digest(body,'sha256'),'hex')<>r.sha256 then raise exception 'Bootstrap payload hash mismatch'; end if;
 envelope:=convert_from(body,'UTF8')::jsonb;
 if jsonb_typeof(envelope) is distinct from 'object' or (select count(*) from jsonb_object_keys(envelope))<>4 or not(envelope ?& array['manifest','shards','sources','identifiers']) or jsonb_typeof(envelope->'sources') is distinct from 'array' or jsonb_typeof(envelope->'identifiers') is distinct from 'array' then raise exception 'Invalid bootstrap envelope'; end if;
 -- Freeze the publication head and identity registry through the final transaction.
 perform pg_advisory_xact_lock(hashtext('ecosystem_snapshot_publish'));
 perform pg_advisory_xact_lock(hashtext('ecosystem_identity'));
 if exists(select 1 from jsonb_array_elements(envelope->'identifiers') x join public.ecosystem_entity_identifiers e on e.identifier=x->>'identifier' where e.entity_id is distinct from x->>'entity_id' or e.kind is distinct from x->>'kind' or lower(e.canonical_name) is distinct from lower(x->>'canonical_name')) then raise exception 'Bootstrap identifier conflict'; end if;
 if exists(select 1 from jsonb_array_elements(envelope->'sources') x join public.ecosystem_sources s on s.id=x->>'id' where s.url is distinct from x->>'url') then raise exception 'Bootstrap source identity conflict'; end if;
 insert into public.ecosystem_sources(id,url,descriptor,active,last_checked_at,content_hash,last_outcome)
 select x->>'id',x->>'url',x->'descriptor',true,(x->>'last_checked_at')::timestamptz,x->>'content_hash',x->>'last_outcome' from jsonb_array_elements(envelope->'sources') x on conflict(url) do nothing;
 insert into public.ecosystem_entity_identifiers(identifier,entity_id,kind,canonical_name)
 select x->>'identifier',x->>'entity_id',x->>'kind',x->>'canonical_name' from jsonb_array_elements(envelope->'identifiers') x on conflict(identifier) do nothing;
 manifest:=public.publish_ecosystem_snapshot(envelope->'manifest',envelope->'shards',null,r.expected_version,true,null);
 answer:=jsonb_build_object('version',manifest->>'version','sha256',r.sha256,'bytes',r.byte_count,'sources',jsonb_array_length(envelope->'sources'),'identifiers',jsonb_array_length(envelope->'identifiers'),'published',true);
 update public.ecosystem_bootstrap_uploads set result=answer where id=p_id;
 delete from public.ecosystem_bootstrap_chunks where upload_id=p_id;
 return answer;
end $$;
revoke all on function public.begin_ecosystem_bootstrap(uuid,text,integer,integer,text),public.put_ecosystem_bootstrap_chunk(uuid,integer,text),public.finish_ecosystem_bootstrap(uuid) from public,anon,authenticated;
grant execute on function public.begin_ecosystem_bootstrap(uuid,text,integer,integer,text),public.put_ecosystem_bootstrap_chunk(uuid,integer,text),public.finish_ecosystem_bootstrap(uuid) to service_role;
commit;
