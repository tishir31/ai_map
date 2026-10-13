#!/usr/bin/env python3
"""Independently verify a cloned public release; Python standard library only."""
import csv,io,json,pathlib,sqlite3,tempfile
from sweep_checks import check_sweep_release
from load_snapshot import verify_snapshot,load_snapshot,sql_identifier,sqlite_value

def main():
 root=pathlib.Path(__file__).resolve().parent
 manifest,mhash,datasets=verify_snapshot(root);checks=[]
 def check(name,ok):checks.append({'check':name,'passed':bool(ok)})
 check('manifest_hashes_sizes_counts_and_snapshot_ids',True)
 check('chunk_size_limit',all(f['bytes']<=manifest['chunk_byte_limit'] for f in manifest['files']))
 check('bounded_assessment_complete',manifest['completion_scope']['research_status']=='COMPLETE_BOUNDED_ASSESSMENT')
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
  check('scope_joke_and_unoriginal_claims_held',events[4918]['business_scope'] in ('held_ai_scope_not_established','outside_framework') and events[4918]['finer_subsector'] is None and 2598 not in disclosed)
  queue=json.loads((root/'QUEUE_RESOLUTION_2026_10_12.json').read_text());qr=datasets['queue_resolution_decisions']['rows']
  check('queue_receipt_matches_current_snapshot',queue['snapshot_id']==manifest['snapshot_id'] and queue['trends_calculated'] is False)
  check('all_731_claims_have_unique_decisions',len(qr)==len({r['candidate_id'] for r in qr})==731 and queue['claims_unreviewed']==0)
  check('all_discovery_claims_are_reviewed',{r['candidate_id'] for r in datasets['discovery_review_queue']['rows']}=={r['candidate_id'] for r in datasets['completion_reviews']['rows']})
  check('all_5163_queue_predecessor_events_preserved',set(range(1,5164))<=set(events))
  check('all_historical_queue_additions_have_public_provenance',{r['event_id'] for r in datasets['queue_resolution_financing_reviews']['rows']}==set(range(5164,5665)))
  check('all_320_prior_classification_holds_have_decisions',queue['original_classification_hold_issuers_reviewed']==320 and len(datasets['classification_resolution_decisions']['rows'])>=320)
  check('fund_capital_is_not_corporate_funding',events[631]['event_type']=='fund_capital_context' and 631 not in disclosed)
  check('reviewed_unverified_claims_remain_visible',len(datasets['queue_unverified_claims']['rows'])==queue['counts']['queue_unverified_claims'] and queue['unverified_claims_are_missing_deal_count'] is False)
  check('unresolved_business_holds_exclude_resolved_nonfits',not ({r['event_id'] for r in datasets['remaining_business_scope_holds']['rows']}&{r['event_id'] for r in datasets['resolved_business_scope_exclusions']['rows']}))
  followup=json.loads((root/'CLAIMS_FOLLOWUP_2026_10_12.json').read_text());fd=datasets['claims_followup_decisions']['rows'];fc=datasets['classification_followup_decisions']['rows'];ff=datasets['followup_financing_reviews']['rows']
  check('followup_receipt_matches_current_release',followup['snapshot_id']==manifest['snapshot_id'] and followup['trends_calculated'] is False and followup['market_completeness_certified'] is False)
  check('82_followup_claims_individually_reviewed',len(fd)==len({r['candidate_id'] for r in fd})==followup['claims_reviewed']==82 and followup['claims_unreviewed']==0)
  latest_reviews={r['candidate_id']:r for r in datasets['completion_reviews']['rows']}
  latest_fd={r['candidate_id']:r for r in fd};latest_fd.update({r['candidate_id']:r for r in datasets['claims_residual_decisions']['rows']});latest_fd.update({r['candidate_id']:r for r in datasets['claims_sweep_decisions']['rows']})
  check('followup_and_residual_decisions_match_latest_reviews',all(latest_reviews[r['candidate_id']]['status']==r['status'] and latest_reviews[r['candidate_id']]['event_id']==r['event_id'] for r in latest_fd.values()))
  check('followup_unverified_claims_explicit',len(datasets['queue_unverified_claims']['rows'])==followup.get('current_claims_still_unverified',followup['claims_still_unverified']) and followup['unverified_claims_are_proven_missing_deals'] is False)
  check('all_5664_followup_predecessor_events_preserved',set(range(1,5665))<=set(events))
  check('all_followup_additions_have_public_provenance',{r['event_id'] for r in ff}==set(range(5665,5712)) and all(json.loads(r['source_urls']) and json.loads(r['field_provenance']) for r in ff))
  check('all_three_original_classification_holds_resolved',len(fc)==followup['original_classification_holds_resolved']==3 and all(r['business_scope']=='in_framework' and r['finer_subsector'] for r in fc))
  check('original_holds_absent_from_current_hold_register',not {r['company_id'] for r in fc}.intersection(r['company_id'] for r in datasets['remaining_business_scope_holds']['rows']))
  check('followup_addition_counts_match_views',len(ff)==followup['added_retained_event_records'] and sum(r['event_id'] in disclosed for r in ff)==followup['added_source_supported_financing_disclosures'])
  followup_events=[events[r['event_id']] for r in ff]
  check('Monarrch_100k_source_fact_preserved',any(e['company']=='Monarrch' and e['raised_amount']==100000 for e in followup_events))
  check('X9_healthcare_scope_preserved',any(e['company']=='X9' and e['raised_amount']==8568181 and e['finer_subsector']=='health' for e in followup_events))
  check('Chai_year_only_funding_excluded_from_period_views',all(e['event_id'] not in disclosed for e in followup_events if e['company']=='Chai Research'))
  check('cumulative_aitiologic_launch_funding_excluded',all(e['event_id'] not in disclosed for e in followup_events if e['company']=='aitiologic' and e['raised_amount_basis']=='cumulative_funding'))
  check('followup_unverified_fields_remain_unknown',all(e['valuation_amount'] is None for e in followup_events if e['company'] in ('Monarrch','ListenOwl','Perfumeo')))
  release_root=root
  residual=json.loads((release_root/'RESIDUAL_CLAIMS_2026_10_12.json').read_text());rd=datasets['claims_residual_decisions']['rows'];rc=datasets['classification_residual_decisions']['rows'];rf=datasets['residual_financing_reviews']['rows'];rx=datasets['residual_event_changes']['rows'];latest_reviews={r['candidate_id']:r for r in datasets['completion_reviews']['rows']};scoped_ids={r['event_id'] for r in datasets['framework_financing_disclosures']['rows']};supported={r['event_id']:r for r in datasets['credible_financing_disclosures']['rows']};added={r['event_id'] for r in rf};unverified=datasets['queue_unverified_claims']['rows'];obs_ids={r['observation_id'] for r in datasets['observations_all']['rows']}
  check('residual_receipt_matches_snapshot_and_predecessor',residual['snapshot_id']==manifest['snapshot_id'] and residual['predecessor_snapshot_id']=='ai-deals-coverage-9ffd44b864775de2eb32' and residual['review_status']=='COMPLETE')
  check('all_30_residual_claims_have_individual_source_decisions',len(rd)==len({r['candidate_id'] for r in rd})==residual['claims_reviewed']==30 and residual['claims_unreviewed']==0 and all(r['note'] and json.loads(r['source_urls']) for r in rd))
  check('all_residual_decisions_match_latest_reviews',all(latest_reviews[r['candidate_id']]['status']==latest_fd[r['candidate_id']]['status'] and latest_reviews[r['candidate_id']]['event_id']==latest_fd[r['candidate_id']]['event_id'] for r in rd))
  check('current_claims_have_explicit_quarantine_dispositions',{r['candidate_id'] for r in unverified}=={r['candidate_id'] for r in latest_fd.values() if r['status'].startswith('quarantined')} and len(unverified)==residual.get('current_claims_still_unverified',residual['claims_still_unverified'])==20 and residual['claims_resolved_or_corroborated']==9)
  check('residual_quarantine_is_not_proven_missing_deal_count',residual['unverified_claims_are_proven_missing_deals'] is False and residual['retained_event_records_are_unique_deal_count'] is False)
  check('residual_has_no_trends_or_completeness_certificate',residual['trends_calculated'] is False and residual['market_completeness_certified'] is False and residual['market_coverage_research_status']=='OPEN')
  check('all_5711_residual_predecessor_event_ids_exported',set(range(1,5712))<=set(events))
  check('all_6938_residual_predecessor_observation_ids_exported',set(range(1,6939))<=obs_ids)
  check('all_4950_residual_predecessor_company_ids_exported',set(range(1,4951))<={r['company_id'] for r in datasets['companies']['rows']})
  check('all_21_residual_additions_have_field_and_source_provenance',added==set(range(5712,5733))==set(residual['new_event_ids']) and len(added)==residual['added_retained_event_records']==21 and all(json.loads(r['field_provenance']) and json.loads(r['source_urls']) for r in rf))
  check('residual_17_period_disclosures_and_7_framework_disclosures_match',sum(eid in supported for eid in added)==residual['added_source_supported_period_financing_disclosures']==17 and len(added&scoped_ids)==residual['added_in_framework_financing_disclosures']==7)
  check('residual_4_nonperiod_context_records_match',len(added-set(supported))==residual['added_period_unallocated_or_year_only_records']==4)
  check('both_Monarrch_and_ListenOwl_holds_have_supported_assignments',len(rc)==2 and {r['company_id'] for r in rc}=={4941,4950} and all(r['business_scope']=='in_framework' and r['finer_subsector'] and json.loads(r['source_urls']) for r in rc))
  check('both_residual_holds_absent_from_current_hold_register',not {4941,4950}.intersection(r['company_id'] for r in datasets['remaining_business_scope_holds']['rows']) and residual['original_classification_holds_resolved']==2)
  check('residual_change_receipts_link_predecessor_and_current_events',all(r['event_id'] in events and r['predecessor_snapshot_id']=='ai-deals-coverage-9ffd44b864775de2eb32' and json.loads(r['source_urls']) for r in rx))
  check('Monarrch_100k_and_AI_rights_governance_preserved',events[5700]['raised_amount']==100000 and events[5700]['finer_subsector']=='security' and events[5700]['valuation_amount'] is None)
  check('ListenOwl_audio_identity_inference_is_explicit',events[5711]['company']=='ListenOwl' and events[5711]['finer_subsector']=='creative' and events[5711]['classification_method']=='reviewed_founder_investor_product_continuity_inference' and events[5711]['raised_amount'] is None and any('inference' in r['note'].lower() for r in rc if r['company_id']==4950))
  check('ProRata_October_offering_not_assumed_an_extra_framework_round',events[5718]['raised_amount']==23449991 and events[5718]['closing_date']=='2024-09-30' and events[5718]['financing_scope']=='issuer_offering_round_unallocated' and 5718 not in scoped_ids and 'unallocated' in supported[5718]['evidence_limit'])
  check('ProRata_2026_original_offering_preserved',events[5714]['raised_amount']==13499991 and events[5714]['closing_date']=='2026-03-09' and 5714 in scoped_ids)
  check('Blink_amendment_retains_only_increment_in_same_episode',events[5719]['raised_amount']==7100000 and events[5713]['raised_amount']==1300000 and supported[5719]['financing_episode_id']==supported[5713]['financing_episode_id'])
  check('Blink_taxonomy_gap_not_forced_into_robotics',all(events[eid]['finer_subsector'] is None and events[eid]['business_scope']=='taxonomy_gap_non_robot_gaze_interaction' and eid not in scoped_ids for eid in (5712,5713,5719)))
  check('Blaise_is_insurance_AI_not_Blaize_semiconductor',events[5726]['company_domain']=='getblaise.com' and events[5726]['finer_subsector']=='finance')
  check('4AG_government_financing_native_CAD_and_type_preserved',events[5730]['raised_amount']==2500000 and events[5730]['raised_currency']=='CAD' and events[5730]['event_type']=='debt_financing')
  check('4AG_prior_company_domain_correction_preserved',events[3111]['company_domain']=='4ag.ai')
  check('GuideAI_unknown_native_currency_not_assumed_USD',events[5731]['raised_amount']==5150000 and events[5731]['raised_currency'] is None and events[5731]['raised_amount_usd'] is None and 5731 not in scoped_ids)
  check('Tessel_award_cap_preserved_as_upper_bound',events[5716]['raised_amount'] is None and events[5716]['raised_amount_upper']==4200000)
  check('Harvest_conflicting_year_and_unverified_amount_unallocated',events[5728]['announcement_date_lower']=='2024-04-30' and events[5728]['announcement_date_upper']=='2025-04-30' and events[5728]['date_precision']=='range' and events[5728]['raised_amount'] is None and 5728 not in supported)
  check('year_only_backing_excluded_from_period_counts',all(eid not in supported for eid in added if events[eid]['date_precision']=='year'))
  check('unallocated_backing_excluded_from_framework_counts',all(eid not in scoped_ids for eid in added if events[eid]['financing_scope']=='investor_participation_round_unallocated'))
  check('all_residual_undisclosed_valuations_remain_unknown',all(events[eid]['valuation_amount'] is None for eid in added))
  check('historical_receipt_counts_and_latest_counts_distinct',followup['claims_still_unverified']==30 and followup['current_claims_still_unverified']==residual['current_claims_still_unverified']==20 and followup['historical_review_decisions'] is True)
  check('current_residual_documentation_and_pointer_match',json.loads((release_root.parent/'LATEST.json').read_text())['residual_review']=='coverage-2024-2026/RESIDUAL_CLAIMS_2026_10_12.json' and 'RESIDUAL_CLAIMS_2026_10_12.json' in (release_root/'AUDITOR_PROMPT.txt').read_text())
  sweeps=json.loads((release_root/'source_sweeps.json').read_text())
  check('source_sweep_summary_matches_current_release',sweeps['snapshot_id']==manifest['snapshot_id'] and sweeps['candidate_records']==sweeps['curated_decisions']==len(datasets['completion_reviews']['rows']) and sweeps['residual_review']['unverified_reviewed_claims']==residual.get('current_claims_still_unverified',residual['claims_still_unverified']))
  check('current_methodology_has_one_residual_review_section',(release_root/'methodology.md').read_text().count('## Historical follow-up and current residual review')==1)
  for name in ('events_all','observations_all','companies','credible_financing_disclosures','financing_episodes','framework_financing_disclosures','framework_financing_episodes','reviewed_framework_financing_disclosures','framework_core_equity_cutoff','completion_reviews','queue_unverified_claims','remaining_business_scope_holds','resolved_business_scope_exclusions'):
   check('residual_current_count_matches_export:'+name,residual.get('current_counts',residual['counts'])[name]==len(datasets[name]['rows']))
  check_sweep_release(root,manifest,datasets,check)
  from bounded_checks import check_bounded_assessment
  check_bounded_assessment(root,manifest,datasets,check)
  actual_names={p.name for p in root.iterdir()}
  check('auditor_document_links_match_actual_filename_case','methodology.md' in actual_names and 'methodology.md' in (root/'AUDITOR_PROMPT.txt').read_text() and '(methodology.md)' in (root/'README.md').read_text())
  db.close()
 result={'snapshot_id':manifest['snapshot_id'],'datasets':len(datasets),'dataset_rows':sum(len(d['rows']) for d in datasets.values()),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'market_completeness_certified':False,'checks':checks}
 print(json.dumps(result,indent=2))
 return 1 if result['failed'] else 0

if __name__=='__main__':raise SystemExit(main())
