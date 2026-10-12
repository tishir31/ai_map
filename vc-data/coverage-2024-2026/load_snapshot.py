#!/usr/bin/env python3
"""Verify a cloned public snapshot and materialize its JSON datasets as SQLite.

Python standard library only. No network, credentials or private data required.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import os
import pathlib
import re
import sqlite3
import sys
import tempfile

IDENTIFIER=re.compile(r'^[A-Za-z_][A-Za-z0-9_]{0,127}$')
SHA256=re.compile(r'^[0-9a-f]{64}$')

class SnapshotError(ValueError):pass

def sql_identifier(value):
    if not isinstance(value,str) or not IDENTIFIER.fullmatch(value):raise SnapshotError('Invalid SQL identifier in manifest')
    return '"'+value+'"'

def member_path(root,relative):
    if not isinstance(relative,str) or not relative or pathlib.PurePosixPath(relative).is_absolute():raise SnapshotError('Invalid manifest file path')
    path=(root/relative).resolve()
    if not path.is_relative_to(root):raise SnapshotError('Manifest file escapes snapshot directory')
    return path

def verify_snapshot(directory):
    """Verify every listed file and both JSON/CSV row counts before creating SQLite."""
    root=pathlib.Path(directory).resolve();manifest_path=root/'manifest.json'
    try:manifest_bytes=manifest_path.read_bytes();manifest=json.loads(manifest_bytes)
    except (OSError,ValueError) as exc:raise SnapshotError('Cannot read a valid manifest.json') from exc
    if not isinstance(manifest,dict) or not isinstance(manifest.get('snapshot_id'),str):raise SnapshotError('Manifest snapshot_id missing')
    if not isinstance(manifest.get('datasets'),dict) or not isinstance(manifest.get('files'),list):raise SnapshotError('Manifest datasets/files missing')
    if any(value is not True for value in manifest.get('validation_checks',{}).values()):raise SnapshotError('Snapshot manifest reports a failed validation check')
    payloads={};listed_paths=set()
    for info in manifest['files']:
        if not isinstance(info,dict) or not isinstance(info.get('sha256'),str) or not SHA256.fullmatch(info['sha256']):raise SnapshotError('Invalid file hash in manifest')
        relative=info.get('path');path=member_path(root,relative)
        if relative in listed_paths:raise SnapshotError('Duplicate manifest file path')
        listed_paths.add(relative)
        try:raw=path.read_bytes()
        except OSError as exc:raise SnapshotError('Missing snapshot file: '+relative) from exc
        if len(raw)!=info.get('bytes') or hashlib.sha256(raw).hexdigest()!=info['sha256']:raise SnapshotError('Hash/size mismatch: '+relative)
        if info.get('format') in ('json','csv'):
            if info.get('dataset') not in manifest['datasets']:raise SnapshotError('File references an unknown dataset')
            payloads[relative]=raw
    datasets={}
    for name,spec in manifest['datasets'].items():
        sql_identifier(name)
        if name=='_snapshot_metadata':raise SnapshotError('Reserved dataset name')
        if not isinstance(spec,dict) or isinstance(spec.get('rows'),bool) or not isinstance(spec.get('rows'),int) or spec['rows']<0:raise SnapshotError('Invalid dataset row count')
        fields=spec.get('fields')
        if not isinstance(fields,list) or not fields or any(not isinstance(field,str) for field in fields) or len(fields)!=len(set(fields)):raise SnapshotError('Invalid dataset fields')
        for field in fields:sql_identifier(field)
        if 'snapshot_id' not in fields:raise SnapshotError('Dataset lacks snapshot_id field')
        json_files=sorted((f for f in manifest['files'] if f.get('dataset')==name and f.get('format')=='json'),key=lambda f:f['path'])
        csv_files=sorted((f for f in manifest['files'] if f.get('dataset')==name and f.get('format')=='csv'),key=lambda f:f['path'])
        if not json_files:raise SnapshotError('Dataset has no JSON chunks: '+name)
        rows=[]
        for info in json_files:
            try:chunk=json.loads(payloads[info['path']])
            except ValueError as exc:raise SnapshotError('Invalid JSON chunk: '+info['path']) from exc
            if not isinstance(chunk,list) or len(chunk)!=info.get('rows'):raise SnapshotError('JSON chunk row count mismatch: '+info['path'])
            for row in chunk:
                if not isinstance(row,dict) or not set(row).issubset(fields):raise SnapshotError('Invalid row fields: '+info['path'])
                if row.get('snapshot_id')!=manifest['snapshot_id']:raise SnapshotError('Row snapshot_id mismatch: '+info['path'])
                def finite_json(value):
                    if isinstance(value,float):return math.isfinite(value)
                    if isinstance(value,list):return all(finite_json(item) for item in value)
                    if isinstance(value,dict):return all(finite_json(item) for item in value.values())
                    return True
                if not all(finite_json(value) for value in row.values()):raise SnapshotError('Non-finite JSON number')
            rows.extend(chunk)
        if len(rows)!=spec['rows']:raise SnapshotError('Dataset JSON row count mismatch: '+name)
        csv_count=0
        for info in csv_files:
            try:
                reader=csv.DictReader(io.StringIO(payloads[info['path']].decode('utf-8')))
                if reader.fieldnames!=fields:raise SnapshotError('CSV column mismatch: '+info['path'])
                count=0
                for row in reader:
                    if None in row or row.get('snapshot_id')!=manifest['snapshot_id']:raise SnapshotError('Invalid CSV row: '+info['path'])
                    count+=1
            except (UnicodeDecodeError,csv.Error) as exc:raise SnapshotError('Invalid CSV chunk: '+info['path']) from exc
            if count!=info.get('rows'):raise SnapshotError('CSV chunk row count mismatch: '+info['path'])
            csv_count+=count
        if csv_files and csv_count!=spec['rows']:raise SnapshotError('Dataset CSV row count mismatch: '+name)
        datasets[name]={'fields':fields,'rows':rows}
    return manifest,hashlib.sha256(manifest_bytes).hexdigest(),datasets

def column_type(values):
    nonnull=[value for value in values if value is not None]
    if nonnull and all(isinstance(value,(bool,int)) for value in nonnull):return 'INTEGER'
    if nonnull and all(isinstance(value,(bool,int,float)) for value in nonnull):return 'REAL'
    return 'TEXT'

def sqlite_value(value,column):
    if value is None:return None
    if column in ('INTEGER','REAL'):return int(value) if isinstance(value,bool) else value
    if isinstance(value,(dict,list)):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    if isinstance(value,str):return value
    return json.dumps(value,ensure_ascii=False,allow_nan=False)

def load_snapshot(directory,output,force=False):
    manifest,manifest_hash,datasets=verify_snapshot(directory)
    destination=pathlib.Path(output).resolve()
    root=pathlib.Path(directory).resolve()
    protected={member_path(root,info['path']) for info in manifest['files']}|{root/'manifest.json'}
    if destination in protected:raise SnapshotError('Output would overwrite a snapshot source file')
    if destination.exists() and not force:raise FileExistsError('Output already exists; choose another path or pass --force')
    destination.parent.mkdir(parents=True,exist_ok=True)
    descriptor,temp_name=tempfile.mkstemp(prefix='.ai-vc-snapshot-',suffix='.sqlite.tmp',dir=destination.parent)
    os.close(descriptor);temp_path=pathlib.Path(temp_name)
    try:
        conn=sqlite3.connect(temp_path)
        try:
            conn.execute('BEGIN')
            conn.execute('CREATE TABLE _snapshot_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL)')
            metadata={'snapshot_id':manifest['snapshot_id'],'manifest_sha256':manifest_hash,'database_sha256':manifest.get('database_sha256'),
                      'scope':manifest.get('scope'),'row_counts':{name:len(data['rows']) for name,data in datasets.items()},
                      'source':'Verified public JSON chunks; no private source payloads are present.','completion_scope':manifest.get('completion_scope'),'base_snapshot_id':manifest.get('base_snapshot_id')}
            conn.executemany('INSERT INTO _snapshot_metadata VALUES (?,?)',[(key,value if isinstance(value,str) else json.dumps(value,sort_keys=True)) for key,value in metadata.items()])
            for name,data in datasets.items():
                fields=data['fields'];rows=data['rows'];types={field:column_type(row.get(field) for row in rows) for field in fields}
                conn.execute('CREATE TABLE '+sql_identifier(name)+' ('+', '.join(sql_identifier(field)+' '+types[field] for field in fields)+')')
                sql='INSERT INTO '+sql_identifier(name)+' ('+','.join(sql_identifier(field) for field in fields)+') VALUES ('+','.join('?' for _ in fields)+')'
                conn.executemany(sql,([sqlite_value(row.get(field),types[field]) for field in fields] for row in rows))
                if conn.execute('SELECT count(*) FROM '+sql_identifier(name)).fetchone()[0]!=len(rows):raise SnapshotError('SQLite row parity failure: '+name)
            conn.commit()
            if conn.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SnapshotError('SQLite integrity check failed')
        finally:conn.close()
        if force:os.replace(temp_path,destination)
        else:
            # A hard link creates the final name atomically and refuses a racing overwrite.
            os.link(temp_path,destination);temp_path.unlink()
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise
    return {'snapshot_id':manifest['snapshot_id'],'output':str(destination),'datasets':len(datasets),
            'rows':sum(len(data['rows']) for data in datasets.values()),'hashes_and_row_counts_verified':True}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory',default=str(pathlib.Path(__file__).resolve().parent),help='Folder containing manifest.json')
    parser.add_argument('--output',default='ai_vc_2026_public.sqlite',help='SQLite destination (existing files are protected)')
    parser.add_argument('--force',action='store_true',help='Explicitly allow atomic replacement of the SQLite destination')
    args=parser.parse_args()
    try:result=load_snapshot(args.directory,args.output,args.force)
    except (SnapshotError,OSError,sqlite3.Error) as exc:print('Snapshot load failed: '+str(exc),file=sys.stderr);return 1
    print(json.dumps(result,indent=2));return 0

if __name__=='__main__':raise SystemExit(main())
