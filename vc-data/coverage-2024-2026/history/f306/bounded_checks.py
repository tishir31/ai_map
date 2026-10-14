"""Public-only checks for the completed bounded coverage assessment."""
import collections,csv,hashlib,json
def check_bounded_assessment(root,manifest,datasets,check):
 def rows(t):return datasets[t]['rows']
 path=root/'BOUNDED_COVERAGE_ASSESSMENT_2026_10_13.json'
 if not path.exists():path=root/'assessment_receipt.json'
 receipt=json.loads(path.read_text());sid=manifest['snapshot_id'];bench=rows('bounded_reference_reconciliation');quality=rows('bounded_accuracy_sample');cells=rows('heatmap_readiness_cells');events={r['event_id']:r for r in rows('events_all')};fin={r['event_id']:r for r in rows('framework_financing_disclosures')};ar=rows('assessment_financing_reviews');changes=rows('assessment_event_changes');classifications=rows('classification_assessment_decisions');ids={r['event_id'] for r in ar}
 check('bounded_assessment_identifies_current_and_frozen_predecessor',receipt['snapshot_id']==sid and receipt['predecessor_snapshot_id']=='ai-deals-coverage-a101d6ec0385b334e0f9' and receipt['predecessor_master_sha256']=='d99b2acb89877da7a51ba87d345e25cb460d5d74b3e853b55c1df3fd6e07cd6e')
 check('bounded_assessment_complete_with_finite_standard',receipt['assessment_status']=='COMPLETE' and receipt['references_unadjudicated']==0 and receipt['verified_material_findings_unfixed']==0 and receipt['standard']['minimum_total_references']==200 and receipt['standard']['minimum_episode_references_per_comparison_cell']==3 and receipt['standard']['minimum_independent_reference_families_per_subsector']==2)
 standard=root/'BOUNDED_COMPLETION_STANDARD.md'
 if not standard.exists():standard=root/'COMPLETION_STANDARD.md'
 check('completion_standard_matches_frozen_digest',hashlib.sha256(standard.read_bytes()).hexdigest()==receipt['completion_standard_sha256'])
 check('bounded_selection_has_623_final_dispositions',len(bench)==len({r['reference_id'] for r in bench})==623 and all(r['note'] and r['source_urls'] and r['disposition'] not in ('pending','unverified_fixed_framework_scope') for r in bench))
 check('benchmark_has_minimum_period_and_update_size',all(sum(r['eligible'] and r['period_id']==p for r in bench)>=n for p,n in [('prior_12m',60),('recent_12m',60),('october_update',8)]))
 check('eligible_references_resolve_to_current_framework_and_episode',all(r['canonical_event_id'] in fin and fin[r['canonical_event_id']]['financing_episode_id']==r['financing_episode_id'] and fin[r['canonical_event_id']]['finer_subsector']==r['finer_subsector'] for r in bench if r['eligible']))
 for p in ['overall','prior_12m','recent_12m','october_update']:
  selected=[r for r in bench if r['eligible'] and (p=='overall' or r['period_id']==p)];c=receipt['reference_capture'][p]
  check('reference_capture_recomputed:'+p,len(selected)==c['eligible_reference_mentions'] and sum(r['initially_captured'] for r in selected)==c['initially_captured'] and sum(r['finally_captured'] for r in selected)==c['finally_captured'] and c['final_capture_fraction']==c['finally_captured']/len(selected) and c['final_capture_fraction']>=.95)
  check('all_material_reference_deals_captured:'+p,sum(r['material_cutoff_reference'] for r in selected)==c['material_references']==c['material_references_captured'] and all(r['finally_captured'] for r in selected if r['material_cutoff_reference']))
 check('benchmark_is_not_worldwide_recall_or_trend_analysis',receipt['market_recall_measured'] is False and receipt['market_completeness_certified'] is False and receipt['trends_calculated'] is False and all(r['market_recall_measured']==0 for r in cells))
 check('all_5809_predecessor_event_ids_retained',set(range(1,5810))<=set(events))
 check('all_7068_predecessor_observation_ids_retained',set(range(1,7069))<={r['observation_id'] for r in rows('observations_all')})
 check('all_bounded_additions_have_public_field_and_source_provenance',ids==set(events)-set(range(1,5810))==set(range(5810,6036)) and len(ids)==receipt['added_retained_records'] and all(json.loads(r['field_provenance']) and json.loads(r['source_urls']) and any(json.loads(r['source_content_sha256']).values()) for r in ar))
 check('all_bounded_corrections_and_classifications_have_sources',len(classifications)==receipt['existing_issuer_classification_decisions']==28 and all(json.loads(r['source_urls']) and r['note'] for r in classifications) and all(r['event_id']<=5809 and r['predecessor_snapshot_id']==receipt['predecessor_snapshot_id'] and json.loads(r['source_urls']) and json.loads(r['before_fields']) and json.loads(r['after_fields']) for r in changes))
 check('accuracy_sample_has_60_source_decisions',len(quality)==len({r['event_id'] for r in quality})==60 and all(r['event_id'] in events and json.loads(r['source_urls']) and r['status'] in ('verified_corrected','verified_no_material_change') for r in quality) and dict(collections.Counter(r['status'] for r in quality))==receipt['sample_statuses'])
 fine={r['finer_subsector_id'] for r in rows('finer_taxonomy')};periods={r['period_id'] for r in rows('completion_periods')}
 check('all_183_cells_have_readiness_status',len(cells)==183 and {(r['finer_subsector'],r['period_id']) for r in cells}=={(f,p) for f in fine for p in periods})
 for cell in cells:
  f,p=cell['finer_subsector'],cell['period_id'];selected=[r for r in bench if r['eligible'] and r['finer_subsector']==f and r['period_id']==p];families={r['source_family'] for r in bench if r['eligible'] and r['finer_subsector']==f and r['period_id'] in ('prior_12m','recent_12m')};qualifies=len({r['financing_episode_id'] for r in selected})>=3 and len(families)>=2
  check('readiness_cell_coverage_evidence:'+f+':'+p,cell['independent_reference_mentions']==len(selected) and cell['independent_reference_episodes']==len({r['financing_episode_id'] for r in selected}) and cell['comparison_window_reference_family_count']==len(families) and (cell['coverage_status']=='update_display_only' if p=='october_update' else (cell['coverage_status']=='qualified_bounded_comparison')==qualifies) and (cell['exclusion_reason'] is not None if not qualifies or p=='october_update' else True))
 qualified={f for f in fine if all(next(c for c in cells if c['finer_subsector']==f and c['period_id']==p)['coverage_status']=='qualified_bounded_comparison' for p in ('prior_12m','recent_12m'))}
 check('exact_subsector_exclusions_and_verdict_recomputed',qualified==set(receipt['qualified_comparison_subsectors']) and fine-qualified==set(receipt['excluded_comparison_subsectors']) and receipt['full_61_subsector_heatmap_ready']==(len(qualified)==61) and receipt['verdict']==('READY' if len(qualified)==61 else 'READY_WITH_SPECIFIC_EXCLUSIONS' if qualified else 'NOT_READY'))
 check('added_recovered_removed_framework_counts_match',len(ids&set(fin))==receipt['added_framework_financing_disclosures'] and set(receipt['new_framework_event_ids'])==ids&set(fin) and set(receipt['recovered_framework_event_ids'])<=set(fin) and not set(receipt['removed_framework_event_ids'])&set(fin))
 bykey={r['decision_key'].removeprefix('assessment-extra:'):events[r['event_id']] for r in ar};disclosed={r['event_id']:r for r in rows('credible_financing_disclosures')}
 ce=bykey['FP-2026-01-bf73d662ee'];cx=bykey['FP-2026-06-bf73d662ee'];cids={ce['event_id'],cx['event_id'],4933}
 check('Cellares_three_disclosures_one_327m_episode',cids<=set(disclosed) and len({disclosed[i]['financing_episode_id'] for i in cids})==1 and sum(events[i]['raised_amount'] for i in cids)==327000000)
 check('Sigma_alias_and_duplicate_recovered_once',1015 in fin and 1750 not in fin and events[1015]['company_id']==events[1750]['company_id']==1587 and events[1015]['finer_subsector']=='workflow')
 check('Dexory_mixed_package_not_165m_pure_equity',events[3132]['announcement_date']=='2025-10-14' and events[3132]['event_type']=='mixed_financing' and events[3132]['funding_composition']=='mixed_equity_debt' and events[3132]['analytical_eligible']==0 and events[5123]['company_id']==events[3132]['company_id'])
 check('Turing_111m_Series_E_recovered',2959 in fin and events[2959]['raised_amount']==111000000 and events[2959]['raised_amount_basis']=='current_round' and events[2959]['event_type']=='equity_funding')
 check('Phyraxis_original_September_CNY_without_fake_cash',5780 in fin and events[5780]['announcement_date']=='2026-09-18' and events[5780]['raised_currency']=='CNY' and events[5780]['raised_amount'] is None)
 check('Q5D_Series_A_not_misclassified_grant',bykey['FP-2025-06-8186b2d088']['event_type']=='equity_funding' and bykey['FP-2025-06-8186b2d088']['raised_amount']==10900000)
 check('Medra_combined_seed_total_excluded',bykey['FP-2025-09-5d288d15c1']['event_id'] not in fin and bykey['FP-2025-09-5d288d15c1']['raised_amount_basis']=='combined_rounds_unallocated')
 check('Askari_repeated_reference_is_one_seed',sum(e['company']==bykey['FP-2026-06-8639b86abd']['company'] and e['raised_amount']==9000000 and e['event_id'] in fin for e in events.values())==1)
 check('no_low_quality_tracker_is_new_financing_evidence',all(not any(bad in u.lower() for bad in ['lapaas','lanka','industrialbriefs','astroai.blog','datapile']) for r in ar for u in json.loads(r['source_urls'])))
 if (root/'manifest.json').exists():
  files=receipt['bounded_inspection_files'];check('bounded_inspection_has_three_receipts',len(files)==3 and len({f['path'] for f in files})==3)
  for f in files:
   p=root/f['path'];raw=p.read_bytes()
   with p.open(encoding='utf-8-sig',newline='') as stream:reader=csv.DictReader(stream);records=list(reader);fields=reader.fieldnames
   data=rows(f['source_dataset'])
   check('bounded_inspection_csv_hash_and_values:'+f['source_dataset'],hashlib.sha256(raw).hexdigest()==f['sha256'] and len(raw)==f['bytes'] and fields==f['fields'] and len(records)==f['rows']==len(data) and all(all(row[k]==('' if canonical[k] is None else str(canonical[k])) for k in fields) for row,canonical in zip(records,data)))
