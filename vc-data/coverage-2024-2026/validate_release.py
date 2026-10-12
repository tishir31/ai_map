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
  db.close()
 result={'snapshot_id':manifest['snapshot_id'],'datasets':len(datasets),'dataset_rows':sum(len(d['rows']) for d in datasets.values()),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'market_completeness_certified':False,'checks':checks}
 print(json.dumps(result,indent=2))
 return 1 if result['failed'] else 0

if __name__=='__main__':raise SystemExit(main())
