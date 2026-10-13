"""Checks for the current coverage sweep and human-readable inspection CSV.

Only public release files and Python's standard library are required.
"""
import csv,hashlib,json,math

def check_sweep_release(root,manifest,datasets,check):
 def rows(t):return datasets[t]['rows']
 events={r['event_id']:r for r in rows('events_all')};fin={r['event_id']:r for r in rows('credible_financing_disclosures')};scope={r['event_id'] for r in rows('framework_financing_disclosures')};reviews={r['candidate_id']:r for r in rows('completion_reviews')}
 receipt=json.loads((root/'COVERAGE_SWEEP_2026_10_13.json').read_text());sd=rows('claims_sweep_decisions');sr=rows('sweep_financing_reviews');sc=rows('classification_sweep_decisions');sx=rows('sweep_event_changes');ids={r['event_id'] for r in sr};unverified=rows('queue_unverified_claims');checks=rows('subsector_period_source_checks')
 check('sweep_receipt_identifies_current_and_frozen_predecessor',receipt['snapshot_id']==manifest['snapshot_id'] and receipt['predecessor_snapshot_id']=='ai-deals-coverage-8ec6fb9ff49089dc3bf3' and receipt['predecessor_master_sha256']=='6342ada732a7438e576aa1e9ceb5f8427ccfbbe93c301dc9a9df8c6a304c7665' and receipt['review_status']=='COMPLETE')
 check('all_21_sweep_claims_have_source_decisions',len(sd)==len({r['candidate_id'] for r in sd})==receipt['claims_reviewed']==21 and receipt['claims_unreviewed']==0 and all(r['note'] and json.loads(r['source_urls']) for r in sd))
 check('sweep_claim_decisions_match_current_reviews',all(reviews[r['candidate_id']]['status']==r['status'] and reviews[r['candidate_id']]['event_id']==r['event_id'] for r in sd))
 check('20_unverified_sweep_claims_explicitly_quarantined',len(unverified)==receipt['claims_still_unverified']==20 and {r['candidate_id'] for r in unverified}=={r['candidate_id'] for r in sd if r['status'].startswith('quarantined')} and receipt['claims_resolved_or_corroborated']==1)
 check('sweep_review_is_not_completeness_or_missing_deal_certificate',receipt['unverified_claims_are_proven_missing_deals'] is False and receipt['retained_event_records_are_unique_deal_count'] is False and receipt['market_completeness_certified'] is False and receipt['market_recall_measured'] is False and receipt['trends_calculated'] is False and receipt['market_coverage_research_status']=='OPEN')
 check('all_5732_sweep_predecessor_event_ids_exported',set(range(1,5733))<=set(events))
 check('all_6965_sweep_predecessor_observation_ids_exported',set(range(1,6966))<={r['observation_id'] for r in rows('observations_all')})
 check('all_4963_sweep_predecessor_company_ids_exported',set(range(1,4964))<={r['company_id'] for r in rows('companies')})
 check('all_sweep_additions_have_field_and_source_receipts',ids=={i for i in events if 5733<=i<=5809}==set(receipt['new_event_ids']) and len(ids)==receipt['added_retained_event_records'] and all(json.loads(r['field_provenance']) and json.loads(r['source_urls']) for r in sr))
 check('sweep_new_financing_counts_match_actual_views',len(ids&set(fin))==receipt['added_source_supported_period_financing_disclosures'] and len(ids&scope)==receipt['added_in_framework_financing_disclosures'] and len(ids-set(fin))==receipt['added_period_unallocated_or_year_only_records'])
 check('all_sweep_classifications_and_corrections_have_evidence',len(sc)==receipt['existing_company_classification_repairs']==7 and {r['company_id'] for r in sc}=={754,1193,2821,1772,1789,1835,1821} and all(json.loads(r['source_urls']) and r['finer_subsector'] and r['business_scope']=='in_framework' for r in sc) and all(r['event_id'] in events and r['predecessor_snapshot_id']==receipt['predecessor_snapshot_id'] and json.loads(r['source_urls']) for r in sx))
 fine={r['finer_subsector_id'] for r in rows('finer_taxonomy')};periods={r['period_id']:(r['start_inclusive'],r['end_exclusive']) for r in rows('completion_periods')};cells={(r['finer_subsector'],r['period_id']):r for r in rows('framework_coverage_cells')}
 check('61_categories_times_3_periods_have_actual_search_receipts',len(checks)==receipt['category_period_searches_completed']==183 and {(r['finer_subsector'],r['period_id']) for r in checks}=={(f,p) for f in fine for p in periods} and all(r['search_query'] and r['search_status']=='public_search_completed' and len(r['source_receipt_sha256'])==64 for r in checks))
 check('source_search_receipt_windows_and_counts_match_coverage',all((r['start_inclusive'],r['end_exclusive'])==periods[r['period_id']] and r['current_disclosures']==cells[(r['finer_subsector'],r['period_id'])]['supported_financing_disclosures'] and r['verified_additions']==sum(e['event_id'] in ids and e['event_id'] in scope and e['finer_subsector']==r['finer_subsector'] and e['period_id']==r['period_id'] for e in fin.values()) for r in checks))
 check('all_source_search_receipts_preserve_unmeasured_recall',all(r['market_recall_measured']==0 and 'No independent market denominator' in r['limits'] for r in checks))
 for t,n in receipt['counts'].items():
  actual=len(rows('discovery_review_queue')) if t=='completion_candidates' else len(rows(t))
  check('sweep_current_count_matches_export:'+t,n==actual)
 bykey={r['decision_key']:events[r['event_id']] for r in sr}
 def e(k):return bykey['sweep-extra:'+k]
 lucent=next(r for r in bykey.values() if r['company']=='Lucent')
 check('Lucent_unknown_cash_and_separate_valuation_preserved',lucent['raised_amount'] is None and lucent['valuation_amount']==13000000 and lucent['announcement_date']=='2026-05-17' and lucent['company_domain']=='lucentchat.com')
 check('Zeroset_one_workflow_financing_not_world_model_duplicate',events[1157]['finer_subsector']=='workflow' and events[1157]['raised_amount']==5200000 and events[1157]['announcement_date']=='2026-10-06' and 1157 in fin and 2866 not in fin)
 check('Netsec_original_native_USD_lower_bound_preserved',events[2840]['raised_amount'] is None and events[2840]['raised_currency']=='USD' and events[2840]['raised_amount_lower']==events[2840]['raised_lower_usd']==10000000 and events[2840]['finer_subsector']=='workflow')
 check('Polaris_original_September_networking_round_preserved',events[2053]['announcement_date']=='2026-09-15' and events[2053]['raised_amount']==50000000 and events[2053]['finer_subsector']=='network')
 check('Neysa_missing_historical_financing_added',e('neysa-20241022')['raised_amount']==30000000 and e('neysa-20241022')['announcement_date']=='2024-10-22' and e('neysa-20241022')['finer_subsector']=='neocloud')
 check('Majestic_current_71m_not_100m_cumulative',e('majestic-20251110')['raised_amount']==71000000 and e('majestic-20251110')['closing_date']=='2025-09-01' and e('majestic-20251110')['closing_date_precision']=='month')
 check('Alloy_AUD_funding_and_valuation_not_mislabeled_USD',e('alloy-20250924')['raised_currency']=='AUD' and e('alloy-20260819')['raised_currency']=='AUD' and e('alloy-20260819')['valuation_amount']==115000000 and e('alloy-20260819')['valuation_currency']=='AUD')
 check('SKAI_KRW_valuation_not_funding_and_followon_not_new_priced_round',e('skai-20260713')['raised_amount'] is None and e('skai-20260713')['valuation_amount']==100000000000 and e('skai-20260713')['valuation_currency']=='KRW' and fin[e('skai-20260612')['event_id']]['financing_episode_id']==fin[e('skai-20260713')['event_id']]['financing_episode_id'])
 terra={e('terra-20260112')['event_id'],e('terra-20260216')['event_id'],2187}
 check('Terra_three_disclosures_one_episode_without_52m_double_count',terra<=set(fin) and len({fin[i]['financing_episode_id'] for i in terra})==1 and sum(events[i]['raised_amount'] for i in terra)==51750000)
 check('original_disclosure_dates_not_later_feed_or_repost_dates',e('rapidata-20260219')['announcement_date']=='2026-02-19' and e('voxshell-20260720')['announcement_date']=='2026-07-20' and e('prodoc-20260930')['announcement_date']=='2026-09-30' and e('dod-20260928')['announcement_date']=='2026-09-28' and events[2091]['announcement_date']=='2026-09-09')
 check('Newcode_6_5m_seed_and_derived_13_5m_A_separate',e('newcode-20260317')['raised_amount']==6500000 and events[2163]['raised_amount']==13500000 and events[2163]['raised_amount_basis']=='derived_current_round_from_same_year_total')
 check('RAC_offerings_preserve_unknown_stage_and_round_allocation',all(e(k)['event_id'] not in scope and e(k)['valuation_amount'] is None and e(k)['round_label']=='Regulatory offering; stage undisclosed' and e(k)['financing_scope']=='issuer_offering_round_unallocated' for k in ('rac-20250225','rac-20250414','rac-20260401')))
 check('combined_Remedy_round_context_not_period_financing',e('remedy-20251006-context')['raised_amount_basis']=='combined_rounds_unallocated' and e('remedy-20251006-context')['event_id'] not in fin)
 check('outside_fixed_taxonomy_financing_stays_explicit',all(e(k)['finer_subsector'] is None and e(k)['event_id'] not in scope for k in ('authmind-20250422','audion-20260427','samba-tv-20251208','meteomatics-20250129')))
 latest=json.loads((root.parent/'LATEST.json').read_text());sweeps=json.loads((root/'source_sweeps.json').read_text())
 check('current_sweep_pointer_and_source_summary_match',latest['snapshot_id']==manifest['snapshot_id'] and latest['coverage_sweep']=='coverage-2024-2026/COVERAGE_SWEEP_2026_10_13.json' and latest['unverified_reviewed_claims']==20 and sweeps['coverage_sweep']['public_searches_completed']==183 and sweeps['coverage_sweep']['unverified_reviewed_claims']==20)
 check('current_sweep_methodology_section_appears_once',(root/'methodology.md').read_text().count('## October 13 category and period coverage sweep')==1 and 'COVERAGE_SWEEP_2026_10_13.json' in (root/'AUDITOR_PROMPT.txt').read_text())
 ir=json.loads((root/'inspection/inspection_receipt.json').read_text());csvpath=root/'inspection/ai_financing_deals.csv';raw=csvpath.read_bytes()
 with csvpath.open(encoding='utf-8-sig',newline='') as f:reader=csv.DictReader(f);csvrows=list(reader);fields=reader.fieldnames
 check('inspection_csv_checksum_size_snapshot_and_headers',ir['snapshot_id']==manifest['snapshot_id'] and ir['sha256']==hashlib.sha256(raw).hexdigest() and ir['bytes']==len(raw) and ir['columns']==fields and ir['null_representation']=='empty field')
 check('inspection_csv_has_all_supported_disclosures_once',len(csvrows)==ir['rows']==len(fin) and len({r['event_id'] for r in csvrows})==len(fin) and {int(r['event_id']) for r in csvrows}==set(fin))
 labels={r['finer_subsector_id']:r['label'] for r in rows('finer_taxonomy')};sources={r['source_id']:r['source_url'] for r in rows('sources')};urls={};notes={r['event_id']:r['note'] for r in sr}
 for r in sx:
  if r['change_kind']=='financial_source_reconciliation':notes[r['event_id']]=r['note']
 for r in rows('assessment_financing_reviews'):notes[r['event_id']]=r['note']
 for r in rows('assessment_event_changes'):
  notes[r['event_id']]=' '.join(dict.fromkeys(x for x in (notes.get(r['event_id']),r['note']) if x))
 for r in sorted(rows('event_sources'),key=lambda r:(r['event_id'],r['source_id'])):
  u=sources[r['source_id']]
  if isinstance(u,str) and u.startswith(('https://','http://')):
   us=urls.setdefault(r['event_id'],[])
   if u not in us:us.append(u)
 def same(value,text):
  if value is None:return text==''
  if isinstance(value,(int,float)):
   try:return math.isfinite(float(text)) and float(text)==value
   except (ValueError,OverflowError):return False
  return text==str(value)
 parity=True
 for cr in csvrows:
  d=fin[int(cr['event_id'])];ev=events[d['event_id']];note=' '.join(dict.fromkeys(x for x in (d['evidence_limit'],notes.get(d['event_id'])) if x)) or None
  expected=dict(company=d['company'],subsector=labels.get(d['finer_subsector'],'Outside 61-category framework'),subsector_id=d['finer_subsector'],period=d['period_id'],announcement_date=d['announcement_date'],date_precision=d['date_precision'],announcement_date_lower=d['announcement_date_lower'],announcement_date_upper=d['announcement_date_upper'],round=d['round_label'],financing_type=d['event_type'],amount_native=d['reported_amount'],currency=d['currency'],amount_qualifier=d['amount_qualifier'],amount_basis=d['amount_basis'],amount_usd=d['reported_amount_usd'],amount_lower_native=d['reported_amount_lower'],amount_upper_native=d['reported_amount_upper'],valuation_native=ev['valuation_amount'],valuation_currency=ev['valuation_currency'],valuation_usd=ev['valuation_amount_usd'],meets_reported_cutoff='yes' if d['qualifies_reported_cutoff']==1 else 'unknown_or_not_established',in_61_category_framework='yes' if d['event_id'] in scope else 'no',business_scope=d['business_scope'],financing_scope=d['financing_scope'],evidence_notes=note,sources=' ; '.join(urls[d['event_id']]),event_id=d['event_id'],company_id=d['company_id'],financing_episode_id=d['financing_episode_id'],classification_method=d['classification_method'],snapshot_id=manifest['snapshot_id'])
  if set(fields)!=set(expected) or not all(same(expected[k],cr[k]) for k in fields):parity=False;break
 check('inspection_csv_matches_every_public_value_and_unknown',parity)
 check('inspection_csv_framework_flag_matches_scoped_view',sum(r['in_61_category_framework']=='yes' for r in csvrows)==len(scope))
 check('inspection_csv_contains_no_quarantined_claim_rows',ir['quarantined_claims_included'] is False and ir['duplicate_announcements_included'] is False and ir['trends_calculated'] is False)
