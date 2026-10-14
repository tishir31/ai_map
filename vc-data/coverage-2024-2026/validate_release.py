#!/usr/bin/env python3
"""Validate the public factual snapshot and unfiltered CSV, offline."""
import csv,hashlib,json,math,pathlib,sqlite3,tempfile
from load_snapshot import verify_snapshot,load_snapshot
ROOT=pathlib.Path(__file__).resolve().parent
def main():
 manifest,manifest_hash,data=verify_snapshot(ROOT);checks=[]
 def check(name,ok,detail=None):checks.append(dict(check=name,passed=bool(ok),detail=detail))
 sid=manifest['snapshot_id'];E={r['event_id']:r for r in data['events_all']['rows']}
 check('all_file_hashes_and_json_csv_parity',True)
 for name,d in data.items():check('dataset_snapshot:'+name,all(r['snapshot_id']==sid for r in d['rows']))
 C={r['company_id'] for r in data['companies']['rows']};S={r['source_id'] for r in data['sources']['rows']}
 check('issuer_foreign_keys',all(e['company_id'] in C for e in E.values()))
 check('event_source_foreign_keys',all(r['event_id'] in E and r['source_id'] in S for r in data['event_sources']['rows']))
 for r in data['coverage_fact_changes']['rows']:
  check('changed_fact_evidence:'+r['fix_id']+':'+r['event_ids'],bool(r['source_url']) and r['source_url'].startswith(('https://','http://')) and bool(json.loads(r['source_quote'])))
 for r in data['financing_source_reports']['rows']:
  check('source_report_link:'+r['report_id'],r['event_id'] in E)
  check('source_report_bounds:'+r['report_id'],r['reported_amount_qualifier'] not in ['lower_bound','upper_bound'] or r['reported_amount_native'] is None)
 for r in data['coverage_duplicate_fixes']['rows']:check('duplicate_link:'+str(r['event_id']),r['event_id'] in E and r['duplicate_of_event_id'] in E and r['event_id']!=r['duplicate_of_event_id'] and E[r['event_id']]['lifecycle_rank']!=1)
 check('Hammerspace_present_once',len([e for e in E.values() if e['company']=='Hammerspace' and e['lifecycle_rank']==1])==1)
 check('AppZen_series_D_corrected',E[4007]['round_label']=='Series D' and E[4007]['funding_composition']=='equity_only')
 receipt=json.loads((ROOT/'inspection/inspection_receipt.json').read_text())
 for info in receipt['files']:
  raw=(ROOT/info['path']).read_bytes();check('inspection_sha256:'+info['path'],hashlib.sha256(raw).hexdigest()==info['sha256'])
  rows=list(csv.DictReader(raw.decode('utf-8-sig').splitlines()));check('inspection_headers:'+info['path'],list(rows[0])==info['fields']);check('inspection_storage_rows:'+info['path'],len(rows)==info['rows'])
  if info['path']=='inspection/all_deal_records.csv':
   check('unfiltered_csv_preserves_all_events',len(rows)==len(E) and {int(r['event_id']) for r in rows}==set(E))
   for row in rows:
    e=E[int(row['event_id'])];ok=all(row[k]==('' if e[k] is None else str(e[k])) for k in ['company','company_id','event_type','event_status','announcement_date','finer_subsector'])
    for out,key in [('recorded_raised_amount','raised_amount'),('consideration_amount','consideration_amount'),('valuation_amount','valuation_amount')]:
     ok=ok and ((row[out]=='' and e[key] is None) or (row[out]!='' and e[key] is not None and math.isclose(float(row[out]),float(e[key]),rel_tol=1e-12,abs_tol=1e-7)))
    check('unfiltered_csv_record:'+row['event_id'],ok)
 with tempfile.TemporaryDirectory() as directory:
  out=pathlib.Path(directory)/'public.sqlite';load_snapshot(ROOT,out);db=sqlite3.connect(out)
  check('public_reconstruction_integrity',db.execute('pragma integrity_check').fetchone()[0]=='ok')
  for name,d in data.items():check('reconstructed_dataset_parity:'+name,db.execute('select count(*) from "'+name+'"').fetchone()[0]==len(d['rows']))
  db.close()
 check('selection_remains_user_controlled',manifest['completion_scope']['user_controls_exclusions'] is True)
 check('no_trends_or_deal_count_calculations',manifest['completion_scope']['no_trends_calculated'] and manifest['completion_scope']['no_deal_count_calculations'])
 result=dict(snapshot_id=sid,validation_status='PASSED' if all(c['passed'] for c in checks) else 'FAILED',passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks),all_public_hashes_verified=True,unfiltered_csv_verified=True,public_only_sqlite_reconstruction_verified=True,user_controls_exclusions=True,no_trends_calculated=True,no_deal_count_calculations=True,checks=checks)
 (ROOT/'public_validation_receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='checks'}))
 if result['failed']:print(json.dumps([c for c in checks if not c['passed']],indent=2))
 return bool(result['failed'])
if __name__=='__main__':raise SystemExit(main())
