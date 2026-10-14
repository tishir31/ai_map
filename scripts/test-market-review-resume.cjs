'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.ECOSYSTEM_PGLITE_PATH || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema extensions; create schema private; create schema vault; create schema net;
    create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
    create function extensions.hmac(text,text,text) returns bytea language sql immutable as $$select decode(repeat('a',64),'hex')$$;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values('physical_ai_scheduler_v1',repeat('b',64));
    create sequence net.fixture_requests;
    create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$select nextval('net.fixture_requests')$$;`);
  for (const p of ['docs/daily-market-review/test-base-schema.sql', 'docs/daily-market-review/review-schema.sql', 'docs/live-updates/market-refresh.sql', 'docs/live-updates/market-transaction-review.sql', 'docs/live-updates/transaction-resume.sql']) {
    if (p.includes('review-schema')) await db.exec('create table ingestion_runs(id text,status text)');
    await db.exec(fs.readFileSync(p, 'utf8'));
  }
  const query = async (sql) => (await db.query(sql)).rows;
  const resume = async () => (await query('select private.resume_physical_ai_market_review() as id'))[0].id;
  await db.exec(`insert into review_queue_items(id,candidate_company,candidate_counterparty,candidate_date,activity_type,subsector,geography,description,source_type,source_url,snippet,extracted_text,confidence)
    values('rq-new','Unfamiliar Robotics','Buyer Corp',current_date,'m&a','robotics','N/A','Public acquisition','press release','https://www.prnewswire.com/news/new','Public','Public','reported')`);
  assert.equal(await resume(), 1, 'new public acquisition with an unfamiliar issuer must continue');
  await db.exec(`insert into market_review_runs(id,run_date,status,collector_window_status)values('prior',current_date-1,'completed','unknown');
    insert into market_review_tasks(id,run_id,candidate_id,input,status,updated_at)
      select 'held','prior',q.id,market_review_input(q)||jsonb_build_object('selectionOrder',1),'held',now() from review_queue_items q;`);
  assert.equal(await resume(), null, 'unchanged held input must not keep dispatching');
  await db.exec("update review_queue_items set deal_value_usd=10000000 where id='rq-new'");
  assert.equal(await resume(), 2, 'changed input must be reconsidered');
  await db.exec("insert into market_review_runs(id,run_date,status,selected,collector_window_status)values('today',current_date,'completed',10,'unknown')");
  assert.equal(await resume(), null, 'completed daily cap must stop new work');
  await db.exec("update market_review_runs set status='running' where id='today'");
  assert.equal(await resume(), 3, 'already selected unfinished work must continue');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("select has_function_privilege($1,'private.resume_physical_ai_market_review()','execute') as ok", [role])).rows[0].ok, false);
  }
  await db.close();
  console.log('Review continuation passed: unfamiliar M&A issuer, unchanged holds, changed inputs, daily cap, unfinished work and private execution');
})().catch(error => { console.error(error); process.exitCode = 1; });
