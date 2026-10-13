#!/usr/bin/env python3
"""Independently verify a cloned public release; Python standard library only."""
import csv,io,json,pathlib,sqlite3,tempfile
from load_snapshot import verify_snapshot,load_snapshot,sql_identifier,sqlite_value

def main():
 root=pathlib.Path(__file__).resolve().parent
 manifest,mhash,datasets=verify_snapshot(root);checks=[]
 def check(name,ok):checks.append({'check':name,'passed':bool(ok)})
 check('manifest_hashes_sizes_counts_and_snapshot_ids',True)
 check('chunk_size_limit',all(f['bytes']<=manifest['chunk_byte_limit'] for f in manifest['files']))
 check('research_status_open',manifest['completion_scope']['research_status']=='OPEN')
 forbidden={'assertion_json','review_json','message_id','thread_id','gmail_id','email_subject','email_body','message_body','raw_source_payload'}
 check('private_payload_columns_excluded',all(not forbidden.intersection(d['fields']) for d in datasets.values()))
 with tempfile.TemporaryDirectory(prefix='ai-deals-public-check-') as td:
  path=pathlib.Path(td)/'public.sqlite';load_snapshot(root,path)
  db=sqlite3.connect(path);db.row_factory=sqlite3.Row
  check('sqlite_integrity',db.execute('PRAGMA integrity_check').fetchone()[0]=='ok')
  check('manifest_metadata_matches',dict(db.execute('SELECT * FROM _snapshot_metadata'))['manifest_sha256']==mhash)
  for name,data in datasets.items():
   fields=data['fields'];rows=data['rows'];csvrows=[]
   for f in sorted((f for f in manifest['files'] if f['dataset']==name and f['format']=='csv'),key=lambda f:f['path']):
    csvrows.extend(csv.DictReader(io.StringIO((root/f['path']).read_text())))
   check('csv_values_and_nulls:'+name,len(rows)==len(csvrows) and all(all(cr.get(k)==('\\N' if r.get(k) is None else str(r[k])) for k in fields) for r,cr in zip(rows,csvrows)))
   actual=[dict(r) for r in db.execute('SELECT * FROM '+sql_identifier(name))]
   types={r[1]:r[2] for r in db.execute('PRAGMA table_info('+sql_identifier(name)+')')}
   check('sqlite_values_types_and_nulls:'+name,len(rows)==len(actual) and all(all(ar[k]==sqlite_value(r.get(k),types[k]) for k in fields) for r,ar in zip(rows,actual)))
  disclosed={r['event_id'] for r in datasets['credible_financing_disclosures']['rows']}
  members=[eid for r in datasets['financing_episodes']['rows'] for eid in json.loads(r['member_event_ids'])]
  check('episodes_partition_supported_financing',set(members)==disclosed and len(members)==len(set(members)))
  check('explicit_duplicates_excluded',all(r['retained_event_id'] not in disclosed for r in datasets['completion_duplicate_decisions']['rows']))
  sources={r['source_id']:r for r in datasets['sources']['rows']}
  public_events={r['event_id'] for r in datasets['event_sources']['rows'] if isinstance(sources[r['source_id']]['source_url'],str) and sources[r['source_id']]['source_url'].startswith(('https://','http://'))}
  check('supported_financing_has_public_urls',disclosed<=public_events)
  events={r['event_id']:r for r in datasets['events_all']['rows']}
  check('all_5059_audited_event_ids_retained',set(range(1,5060))<=set(events))
  check('finer_framework_has_61_categories',len(datasets['finer_taxonomy']['rows'])==61)
  check('event_classification_links_cover_all_records',{r['event_id'] for r in datasets['event_entity_classifications']['rows']}==set(events))
  company_ids={r['company_id'] for r in datasets['companies']['rows']}
  check('event_company_links_resolve',all(e['company_id'] is None or e['company_id'] in company_ids for e in events.values()))
  check('Omni_primary_funding_and_valuation_distinct',events[4330]['raised_amount']==90000000 and events[4330]['valuation_amount']==1500000000)
  check('Emergent_and_Partly_valuation_as_funding_errors_fixed',events[2315]['raised_amount']==130000000 and events[4943]['raised_amount']==50000000)
  check('Delos_issuers_distinct',events[650]['company_id']!=events[3282]['company_id'])
  check('broker_claim_not_in_verified_financing',3055 not in disclosed)
  schema=json.loads((root/'auditor_findings.schema.json').read_text())
  import re
  check('auditor_schema_accepts_current_snapshot',bool(re.fullmatch(schema['properties']['snapshot_id']['pattern'],manifest['snapshot_id'])) and 'const' not in schema['properties']['snapshot_id'])
  response=json.loads((root/'AUDIT_RESPONSE_2026_10_12.json').read_text())
  check('audit_response_covers_all_findings_and_current_release',len(response['findings'])==67 and response['snapshot_id']==manifest['snapshot_id'] and response['trends_calculated'] is False)
  check('audit_response_event_ids_resolve',all(eid in events for f in response['findings'] for eid in f['result_event_ids']))
  completion=json.loads((root/'COVERAGE_COMPLETION_2026_10_12.json').read_text())
  check('coverage_completion_matches_current_release',completion['snapshot_id']==manifest['snapshot_id'] and completion['trends_calculated'] is False)
  check('all_5117_predecessor_event_ids_retained',set(range(1,5118))<=set(events))
  check('all_183_category_period_coverage_cells',len(datasets['framework_coverage_cells']['rows'])==183)
  check('framework_financing_excludes_scope_holds',all(r['business_scope']=='in_framework' and r['finer_subsector'] and r['financing_scope']=='startup_or_operating_company_financing' for r in datasets['framework_financing_disclosures']['rows']))
  check('reviewed_framework_excludes_source_rules',all(r['classification_method']!='unambiguous_source_text_rule' for r in datasets['reviewed_framework_financing_disclosures']['rows']))
  check('46_financing_backfills_have_public_source_receipts',len(datasets['coverage_pass_financing_reviews']['rows'])==46 and all(json.loads(r['source_urls']) for r in datasets['coverage_pass_financing_reviews']['rows']))
  check('classification_hold_register_matches_receipt',len(datasets['classification_hold_register']['rows'])==completion['held_financing_classification_records'])
  check('every_issuer_has_business_scope_decision',{r['company_id'] for r in datasets['business_classification_reviews']['rows']}==company_ids)
  check('native_currency_corrections_retained',events[5122]['raised_currency']=='EUR' and events[5143]['raised_currency']=='PLN')
  check('scope_joke_and_unoriginal_claims_held',events[4918]['business_scope']=='held_ai_scope_not_established' and 2598 not in disclosed)
  actual_names={p.name for p in root.iterdir()}
  check('auditor_document_links_match_actual_filename_case','methodology.md' in actual_names and 'methodology.md' in (root/'AUDITOR_PROMPT.txt').read_text() and '(methodology.md)' in (root/'README.md').read_text())
  db.close()
 result={'snapshot_id':manifest['snapshot_id'],'datasets':len(datasets),'dataset_rows':sum(len(d['rows']) for d in datasets.values()),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'market_completeness_certified':False,'checks':checks}
 print(json.dumps(result,indent=2))
 return 1 if result['failed'] else 0

if __name__=='__main__':raise SystemExit(main())
