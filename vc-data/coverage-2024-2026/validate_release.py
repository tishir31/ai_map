#!/usr/bin/env python3
"""Verify the current public release using only Python's standard library.

Checks cover hashes, exact row/null/type parity, current counting rules, receipts
and human CSV exports. Source quotation text is checked against archived public
captures in canonical validation before publication. No world-recall guarantee.
"""
import argparse,csv,hashlib,io,json,pathlib,re,sqlite3,tempfile
from load_snapshot import verify_snapshot,load_snapshot,sql_identifier,sqlite_value
from independent_checks import run_checks

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--receipt');args=parser.parse_args()
 root=pathlib.Path(__file__).resolve().parent;manifest,mhash,datasets=verify_snapshot(root);sid=manifest['snapshot_id'];checks=[]
 def check(name,ok,detail=None):checks.append({'check':name,'passed':bool(ok),'detail':detail})
 check('manifest_hashes_sizes_counts_and_ids',True)
 check('all_chunks_within_byte_limit',all(f['bytes']<=manifest['chunk_byte_limit'] for f in manifest['files']))
 scope=manifest['completion_scope'];check('new_bounded_audit_common_policy',scope['research_status']=='COMPLETE_BOUNDED_INDEPENDENT_AUDIT' and scope['start']=='2024-10-01' and scope['end_inclusive']=='2026-10-11' and scope['comparison_cell_minimum']==10 and scope['october_display_only'] and scope['no_trends_calculated'] and not scope['market_completeness_certified'])
 forbidden={'assertion_json','review_json','message_id','thread_id','gmail_id','email_subject','email_body','message_body','raw_source_payload','passage','review_passage','private_sources'}
 check('private_payload_fields_excluded',all(not forbidden.intersection(d['fields']) for d in datasets.values()))
 check('private_candidate_payload_table_excluded','completion_candidates' not in datasets)
 strings=[v for d in datasets.values() for r in d['rows'] for v in r.values() if isinstance(v,str)]
 check('no_private_mail_identifiers_or_links',not any(re.search(r'https?://(?:mail\.google\.com|gmail\.com)|gmail://|(?:gmail|email)_(?:message|thread)_id',v,re.I) for v in strings))
 check('no_local_workspace_paths',not any(re.search(r'/Users/[^/]+/|/workspace/ai-vc-db/',v) for v in strings))
 with tempfile.TemporaryDirectory(prefix='ai-deals-public-check-') as td:
  path=pathlib.Path(td)/'public.sqlite';load_snapshot(root,path);db=sqlite3.connect(path);db.row_factory=sqlite3.Row
  check('public_sqlite_integrity',db.execute('PRAGMA integrity_check').fetchone()[0]=='ok')
  check('public_sqlite_manifest_digest',dict(db.execute('SELECT * FROM _snapshot_metadata'))['manifest_sha256']==mhash)
  for name,d in datasets.items():
   fields=d['fields'];rows=d['rows'];csvrows=[]
   for f in sorted((f for f in manifest['files'] if f['dataset']==name and f['format']=='csv'),key=lambda f:f['path']):csvrows.extend(csv.DictReader(io.StringIO((root/f['path']).read_text())))
   check('json_csv_value_and_null_parity:'+name,len(rows)==len(csvrows) and all(all(cr.get(k)==('\\N' if r.get(k) is None else str(r[k])) for k in fields) for r,cr in zip(rows,csvrows)))
   actual=[dict(r) for r in db.execute('SELECT * FROM '+sql_identifier(name))];types={r[1]:r[2] for r in db.execute('PRAGMA table_info('+sql_identifier(name)+')')}
   check('json_sqlite_value_type_and_null_parity:'+name,len(actual)==len(rows) and all(all(a[k]==sqlite_value(r.get(k),types[k]) for k in fields) for r,a in zip(rows,actual)))
  data={n:d['rows'] for n,d in datasets.items()};numeric=run_checks(data,check,sid)
  check('numeric_receipt_recomputes_exactly',numeric==json.loads((root/'NUMERIC_CHECKS.json').read_text()))
  db.close()
 for name in ('validation_receipt.json','build_receipt.json','audit_release_receipt.json','INDEPENDENT_AUDIT_2026_10_14.json','inspection/inspection_receipt.json'):
  r=json.loads((root/name).read_text());check('current_receipt_snapshot:'+name,r['snapshot_id']==sid)
 canonical=json.loads((root/'validation_receipt.json').read_text());check('canonical_receipt_passed_exact_master',canonical['failed']==0 and canonical['database_sha256']==manifest['database_sha256'] and canonical['exact_quote_failures']==0)
 inspection=json.loads((root/'inspection/inspection_receipt.json').read_text())
 for spec in inspection['files']:
  p=root/spec['path'];raw=p.read_bytes();rows=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))));check('inspection_hash_rows_and_headers:'+spec['path'],hashlib.sha256(raw).hexdigest()==spec['sha256'] and len(rows)==spec['rows']+1 and rows[0]==spec['fields'])
  if spec.get('source_dataset'):
   source=datasets[spec['source_dataset']]['rows']
   if spec.get('review_file'):source=[r for r in source if r['review_file']==spec['review_file']]
   if spec.get('only_counted'):source=[r for r in source if r['counted']]
   if spec.get('original_groups_only'):source=[r for r in source if r['proposed_deal_id']]
   def equal_cell(cell,value):
    if value is None:return cell==''
    if isinstance(value,(float,int)) and not isinstance(value,bool):
     try:return float(cell)==value
     except ValueError:return False
    return cell==str(value)
   check('inspection_exact_public_dataset_parity:'+spec['path'],len(rows)==len(source)+1 and all(len(cr)==len(spec['fields']) and all(equal_cell(cr[i],r.get(k)) for i,k in enumerate(spec['fields'])) for cr,r in zip(rows[1:],source)))
 check('loader_rejects_tampered_file_hash',_reject_tamper(root,manifest))
 result={'snapshot_id':sid,'manifest_sha256':mhash,'datasets':len(datasets),'dataset_rows':sum(len(d['rows']) for d in datasets.values()),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'no_trends_calculated':True,'market_completeness_certified':False,'checks':checks}
 if args.receipt:pathlib.Path(args.receipt).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2))
 if result['failed']:print(json.dumps([c for c in checks if not c['passed']],indent=2))
 return bool(result['failed'])

def _reject_tamper(root,manifest):
 with tempfile.TemporaryDirectory(prefix='ai-deals-tamper-test-') as td:
  p=pathlib.Path(td);m=json.loads(json.dumps(manifest));m['files'][0]['sha256']='0'*64;(p/'manifest.json').write_text(json.dumps(m))
  first=m['files'][0]['path'];target=p/first;target.parent.mkdir(parents=True);target.write_bytes((root/first).read_bytes())
  try:verify_snapshot(p)
  except ValueError as e:return 'Hash/size mismatch' in str(e)
  return False
if __name__=='__main__':raise SystemExit(main())
