"""Current equity/acquisition acceptance checks; Python standard library only.

These checks establish internal consistency. Reference capture and unresolved
verification counts are reported separately and are not a market recall estimate.
"""
import collections,datetime as dt,itertools,json,math,re

PERIODS={'prior_12m':('2024-10-01','2025-09-30'),'recent_12m':('2025-10-01','2026-09-30'),'october_update':('2026-10-01','2026-10-11')}
PRIVATE=('theinformation.com','axios.com/pro/','axios.com/newsletters/','dealroom.news','dealroom.co/news','mail.google.com','gmail.com')
BAD=('lapaas','lanka','briefglance','letsdatascience','arr.club','mezha.net','polaris7','fundbat','vcbacked','privatecomps','multiples.vc','privatemarketview','startupfundraising','recodex','eightbox','thecompanywire')
ALLOWED_TYPES={'equity_funding','equity_extension','convertible_financing','strategic_investment','combined_round_disclosure','mixed_financing'}
ALLOWED_COMPOSITION={'equity_only','convertible_equity','convertible','mixed_equity_debt','mixed_primary_secondary','equity_initial_close_total_anticipated'}
UNALLOCATED={'mixed_primary_secondary_unallocated','combined_primary_secondary_package','combined_equity_rounds_unallocated','combined_rounds','combined_round_total','combined_rounds_unallocated','combined_seed_and_series_a','multi_round_total_unallocated','multi_tranche_total_unallocated','committed_capital'}
EXCLUDED_BASIS={'target','proposed_financing_commitment','committed_capital','cumulative','cumulative_context','cumulative_funding','cumulative_total_funding','investor_participation_unallocated'}

def decode(value):
 if isinstance(value,str):
  try:return json.loads(value)
  except (ValueError,TypeError):return value
 return value
def sequence(value):
 value=decode(value)
 return value if isinstance(value,list) else []
def admissible(url):return isinstance(url,str) and url.startswith(('https://','http://')) and not any(x in url.lower() for x in PRIVATE+BAD)
def normal_name(name):
 name=re.sub(r'\([^)]*\)','',name or '').lower()
 name=re.sub(r'\.ai\b','',name);name=re.sub(r'\b(?:ai|labs?|inc(?:orporated)?|ltd|limited|llc|corp(?:oration)?)\b','',name)
 return re.sub(r'[^a-z0-9]','',name)
def period(day):return next((p for p,(a,b) in PERIODS.items() if day and a<=day<=b),None)
def span(e):
 day=e.get('announcement_date');precision=e.get('date_precision')
 if e.get('announcement_date_lower') and e.get('announcement_date_upper'):return e['announcement_date_lower'],e['announcement_date_upper']
 if not day:return None
 if precision=='day':return day,day
 if precision=='month':
  start=dt.date.fromisoformat(day[:7]+'-01');end=(start.replace(year=start.year+1,month=1) if start.month==12 else start.replace(month=start.month+1))-dt.timedelta(days=1)
  return start.isoformat(),end.isoformat()
 return None

def run_checks(data,check,snapshot_id):
 """data maps dataset names to row lists; check(name, bool, detail) accumulates."""
 events={e['event_id']:e for e in data['events_all']};companies={c['company_id']:c for c in data['companies']}
 eps=data['heatmap_equity_episodes'];discs=data['heatmap_equity_disclosures'];ds={e['event_id']:e for e in discs};members=[eid for ep in eps for eid in sequence(ep['member_event_ids'])]
 fine={r['finer_subsector_id']:r for r in data['finer_taxonomy']};parents={r['subsector_id']:r for r in data['taxonomy']}
 sources={s['source_id']:s for s in data['sources']};public_events={r['event_id'] for r in data['event_sources'] if r['source_id'] in sources and admissible(sources[r['source_id']]['source_url'])}
 dispositions={r['event_id']:r for r in data['independent_audit_financing_dispositions']}
 check('61_fine_and_32_parent_categories',len(fine)==61 and len(parents)==32,None)
 check('event_ids_unique',len(events)==len(data['events_all']),None)
 check('company_ids_unique',len(companies)==len(data['companies']),None)
 check('all_event_company_links_resolve',all(e['company_id'] is None or e['company_id'] in companies for e in events.values()),None)
 check('all_source_links_resolve',all(r['source_id'] in sources and r['event_id'] in events for r in data['event_sources']),None)
 check('all_event_classification_links_resolve',{r['event_id'] for r in data['event_entity_classifications']}==set(events),None)
 check('all_registry_issuers_have_scope_reviews',{r['company_id'] for r in data['business_classification_reviews']}==set(companies),None)
 check('equity_episodes_partition_disclosures',set(members)==set(ds) and len(members)==len(set(members)),None)
 check('equity_episode_ids_unique',len(eps)==len({ep['financing_episode_id'] for ep in eps}),None)
 check('equity_disclosures_have_admissible_public_sources',set(ds)<=public_events,None)
 check('same_announcement_rule_for_every_period',all((s:=span(e)) and PERIODS[e['period_id']][0]<=s[0]<=s[1]<=PERIODS[e['period_id']][1] for e in discs),None)
 check('equity_only_counted_instruments',all(e['event_type'] in ALLOWED_TYPES and e['funding_composition'] in ALLOWED_COMPOSITION for e in discs),None)
 check('no_talks_rumors_commitments_or_capitalizations_counted',all(e['event_status'] not in ('in_talks','rumored') and e['raised_amount_basis'] not in EXCLUDED_BASIS and e['financing_scope']=='startup_or_operating_company_financing' for e in discs),None)
 check('equity_disclosures_are_supported_and_classified',all(e['review_status']=='source_supported' and e['has_supporting_web_source'] and not e['has_blocking_quality_flag'] and e['business_scope']=='in_framework' and e['finer_subsector'] in fine for e in discs),None)
 check('duplicates_and_components_not_counted',all(e['lifecycle_rank']==1 for e in discs),None)
 check('unverified_audit_claims_not_counted',all(eid not in ds for eid,r in dispositions.items() if r['verification']=='unverified' or r['decision'].startswith(('unverified','duplicate','component')) or r['decision'] in ('outside_framework','excluded_debt','in_talks_do_not_count')),None)
 for ep in eps:
  em=[ds[i] for i in sequence(ep['member_event_ids'])];first=min(em,key=lambda e:(e['announcement_date'],e['event_id']))
  check('single_issuer_episode:'+ep['financing_episode_id'],len({e['company_id'] for e in em})==1 and ep['company_id']==first['company_id'],None)
  check('first_disclosure_period:'+ep['financing_episode_id'],ep['period_id']==first['period_id'] and ep['first_announcement_date']==first['announcement_date'],None)
  uncertain=any(e['raised_amount_lower'] is not None or e['raised_amount_upper'] is not None or e['raised_amount_basis'] in UNALLOCATED or (e['funding_composition'] in ('mixed_equity_debt','mixed_primary_secondary') and e['raised_amount_basis'] not in ('current_round_equity_component','derived_equity_component')) for e in em) or len({e['period_id'] for e in em})>1
  expected=None if uncertain or any(e['raised_amount_usd'] is None for e in em) else sum(e['raised_amount_usd'] for e in em)
  check('reported_equity_amount_not_package_or_cross_period_total:'+ep['financing_episode_id'],ep['reported_amount_usd']==expected,None)
 check('unknown_equity_amounts_are_null_not_zero',all(ep['reported_amount_usd'] is None or ep['reported_amount_usd']>0 for ep in eps),None)
 # Explicit relationships, plus independent arithmetic on same-issuer/day
 # episode point amounts. A coincidental sum is exposed for review as well.
 components=[r for r in data['completion_round_components'] if r.get('parent_event_id')]
 linked_disclosures=[r for r in components if r['event_id'] in ds and r['parent_event_id'] in ds]
 own_components=[r for r in linked_disclosures if ds[r['event_id']]['financing_episode_id']!=ds[r['parent_event_id']]['financing_episode_id']]
 by_date=collections.defaultdict(list)
 for ep in eps:
  if ep['reported_amount_usd'] is not None:by_date[(ep['company_id'],ep['first_announcement_date'])].append(ep)
 sum_pairs=[]
 for key,group in by_date.items():
  for total in group:
   rest=[x for x in group if x is not total]
   for n in range(2,len(rest)+1):
    for subset in itertools.combinations(rest,n):
     v=sum(x['reported_amount_usd'] for x in subset)
     if abs(total['reported_amount_usd']-v)<=max(1,abs(v)*1e-8):sum_pairs.append({'company_id':key[0],'date':key[1],'total':total['financing_episode_id'],'components':[x['financing_episode_id'] for x in subset]})
 check('numeric_1_no_counted_total_and_own_components',not own_components and not sum_pairs,{'explicit':len(own_components),'arithmetic':len(sum_pairs)})
 pairs=[];by_co=collections.defaultdict(list)
 for ep in eps:by_co[ep['company_id']].append(ep)
 for cid,group in by_co.items():
  group.sort(key=lambda ep:ep['first_announcement_date'])
  for i,a in enumerate(group):
   for b in group[i+1:]:
    delta=(dt.date.fromisoformat(b['first_announcement_date'])-dt.date.fromisoformat(a['first_announcement_date'])).days
    if delta>14:break
    x,y=a['reported_amount_usd'],b['reported_amount_usd']
    if x and y and abs(x-y)/max(x,y)<=.05:pairs.append({'company_id':cid,'episodes':[a['financing_episode_id'],b['financing_episode_id']],'days':delta})
 check('numeric_2_no_unexplained_14day_5percent_pairs',not pairs,len(pairs))
 redirects={r['retained_company_id']:r['preferred_company_id'] for r in data['company_identity_redirects']};variants=collections.defaultdict(list)
 for c in companies.values():
  key=normal_name(c['canonical_name'])
  if key:variants[key].append(c)
 collisions=[{'normalized_name':name,'company_ids':[c['company_id'] for c in group],'names':[c['canonical_name'] for c in group],'domains':[c['company_domain'] for c in group],'active_company_ids':[c['company_id'] for c in group if c['company_id'] not in redirects],'counted_episode_ids':[ep['financing_episode_id'] for ep in eps if ep['company_id'] in {c['company_id'] for c in group}],'interpretation':'Possible issuer aliases or genuine homonyms; no unsupported identity merge.'} for name,group in sorted(variants.items()) if len({c['company_id'] for c in group if c['company_id'] not in redirects})>1]
 reviews=data['audit_financing_review_decisions'];review_counts=collections.Counter(r['review_file'] for r in reviews)
 check('both_financing_review_inputs_all_retained',review_counts=={'held_financing_review.csv':682,'uncounted_in_framework_review.csv':270},dict(review_counts))
 undecided=[];unresolved_sources=[];verification_remaining=[]
 for filename in ('held_financing_review.csv','uncounted_in_framework_review.csv'):
  for pid in PERIODS:
   for priority in ('P1','P2','P3'):
    group=[r for r in reviews if r['review_file']==filename and r['period_id']==pid and r['priority']==priority]
    n=sum(not r.get('decision') or not r.get('resolved_disposition') for r in group)
    if filename.startswith('held'):undecided.append({'period_id':pid,'priority':priority,'rows':len(group),'undecided':n})
    needs=[r for r in group if r.get('suggested_handling')=='needs_public_source']
    if filename.startswith('uncounted'):unresolved_sources.append({'period_id':pid,'priority':priority,'rows':len(needs),'undecided':sum(not r.get('decision') or not r.get('resolved_disposition') for r in needs),'unverified_excluded':sum(r['verification']=='unverified' for r in needs)})
    verification_remaining.append({'review_file':filename,'period_id':pid,'priority':priority,'rows':len(group),'unverified_excluded':sum(r['verification']=='unverified' for r in group),'counted_records':sum(r['heatmap_counted'] for r in group)})
 check('numeric_4_no_undecided_held_rows',sum(r['undecided'] for r in undecided)==0,undecided)
 check('numeric_5_no_needs_public_source_without_final_disposition',sum(r['undecided'] for r in unresolved_sources)==0,unresolved_sources)
 check('verified_review_decisions_have_public_url_and_quote',all(admissible(r['decision_source_url']) and sequence(r['source_quote']) for r in reviews if r['verification']=='verified'),None)
 acqs=data['acquisition_deals'];counted=[r for r in acqs if r['counted']];priced=[]
 check('numeric_6_one_counted_record_per_acquisition',len(counted)==len({r['deal_id'] for r in counted})==len({r['event_id'] for r in counted}) and all(r['counted_record_count']==1 for r in counted),None)
 check('acquisitions_use_actual_announcement_period',all(period(r['announcement_date'])==r['period_id'] for r in counted),None)
 check('acquisition_types_separate_main_and_context',all(r['bucket']==('license_and_hire' if r['target_type']=='license_and_hire' else 'context' if r['target_type'] in ('public_company','carve_out') else 'private_startup') for r in counted),None)
 check('all_acquisition_prices_have_status_basis_currency',all((r['price'] is None and r['price_status']=='undisclosed') or (r['price']>0 and r['price_status'] in ('disclosed','reported') and r['price_basis'] in ('enterprise_value','equity_value','equity_value_net_existing_stake','up_to_including_earnouts','stake_value','unknown','license_and_hire_package','license_fee') and r['price_currency']) for r in acqs),None)
 check('all_acquisitions_have_public_evidence',all(admissible(r['source_url']) and sequence(r['source_quote']) for r in acqs),None)
 check('closing_dates_have_separate_evidence',all(r['closing_date'] is None or (admissible(r.get('closing_source_url')) and sequence(r.get('closing_source_quote'))) for r in acqs),None)
 for pid in PERIODS:
  group=[r for r in counted if r['period_id']==pid];n=len(group);status={s:sum(r['price_status']==s and r['price'] is not None for r in group) for s in ('disclosed','reported')}
  priced.append({'period_id':pid,'deals':n,'bucket_counts':dict(collections.Counter(r['bucket'] for r in group)),'priced':sum(status.values()),'price_status_counts':dict(collections.Counter(r['price_status'] for r in group)),'priced_share':sum(status.values())/n if n else None,'disclosed_priced_share':status['disclosed']/n if n else None,'reported_priced_share':status['reported']/n if n else None,'priced_basis_unknown':sum(r['price'] is not None and r['price_basis']=='unknown' for r in group),'counted_record_count_max':max((r['counted_record_count'] for r in group),default=0)})
 fc=data['heatmap_readiness_cells'];pc=data['heatmap_parent_coverage_cells'];display=data['heatmap_display_groups']
 check('numeric_7_all_183_fine_and_96_parent_period_cells',len(fc)==183 and len(pc)==96 and len({(r['finer_subsector'],r['period_id']) for r in fc})==183 and len({(r['primary_subsector'],r['period_id']) for r in pc})==96,None)
 for level,cells,key in [('fine',fc,'finer_subsector'),('parent',pc,'primary_subsector')]:
  for cell in cells:
   n=sum(ep[key]==cell[key] and ep['period_id']==cell['period_id'] for ep in eps)
   counts=[sum(ep[key]==cell[key] and ep['period_id']==p for ep in eps) for p in ('prior_12m','recent_12m')]
   check('cell_count_and_common_ten_minimum:'+level+':'+cell[key]+':'+cell['period_id'],cell['counted_equity_episodes']==n and cell['comparison_ready']==int(min(counts)>=10) and cell['cell_under_10']==int(n<10) and cell['display_only']==int(cell['period_id']=='october_update'),None)
 for pid in PERIODS:
  cells=[r for r in display if r['period_id']==pid];children=[x for r in cells for x in sequence(r['member_finer_subsectors'])]
  check('display_groups_partition_fine_categories:'+pid,set(children)==set(fine) and len(children)==len(set(children)),None)
  check('display_groups_sum_to_equity_episodes:'+pid,sum(r['counted_equity_episodes'] for r in cells)==sum(ep['period_id']==pid for ep in eps),None)
  for r in cells:
   children=sequence(r['member_finer_subsectors']);n=sum(ep['finer_subsector'] in children and ep['period_id']==pid for ep in eps)
   eligible=min(sum(ep['finer_subsector'] in children and ep['period_id']==p for ep in eps) for p in ('prior_12m','recent_12m'))>=10
   check('display_count_and_threshold:'+r['display_group_id']+':'+pid,r['counted_equity_episodes']==n and r['comparison_ready']==int(eligible),None)
 changes=data['independent_audit_changes'];missing=[r['change_id'] for r in changes if not admissible(r['source_url']) or not sequence(r['source_quote']) or r['verification']!='verified']
 check('numeric_8_every_verified_change_has_public_url_and_quote',not missing,len(missing))
 check('changed_event_ids_resolve',all(i in events for r in changes for i in sequence(r['event_ids'])),None)
 check('all_275_original_acquisition_group_decisions_retained',len({r['proposed_deal_id'] for r in data['acquisition_review_decisions'] if r['proposed_deal_id']})==275,None)
 check('all_46_acquisition_candidates_have_dispositions',len(data['acquisition_missing_candidate_decisions'])==46 and all(r['decision'] for r in data['acquisition_missing_candidate_decisions']),None)
 sweep=data['independent_acquirer_source_sweeps'];buyers=collections.Counter(r['buyer'] for r in sweep)
 check('equal_55_buyer_two_period_search_depth',len(sweep)==110 and len(buyers)==55 and all(n==2 for n in buyers.values()) and all(r['search_status']=='completed' for r in sweep),None)
 fixed=data['out_of_sample_reconciliation']
 check('fixed_145_out_of_sample_rows_not_rule_tuned',len(fixed)==145 and all(not r['rule_tuned_to_test'] for r in fixed),None)
 check('out_of_sample_capture_never_crosses_comparison_boundary',all(not r['captured'] or r['period_id']==r['current_episode_period'] for r in fixed),None)
 check('insample_test_overlap_excluded',all(not r['in_sample'] or not r['fixed_test_overlap'] for r in data['digital_reference_reconciliation']),None)
 # Selected fixed regressions cover material tranche, cumulative, issuer and
 # classification corrections without asserting obsolete historical counts.
 for name,ok in [
  ('Positron_components_not_extra_rounds',2783 not in ds and 2799 not in ds and events[4450]['raised_amount'] is None),
  ('Positron_February_duplicate_not_counted',4248 not in ds),
  ('Censys_debt_and_total_not_equity_cash',4899 not in ds and 655 not in ds and events[654]['raised_amount']==40000000),
  ('Cline_cumulative_total_not_current_cash',events[3311]['raised_amount'] is None and 3885 not in ds),
  ('Arena_verified_issuer_and_evaluation_subsector',events[2527]['company_id']==1304 and events[2527]['finer_subsector']=='eval'),
  ('OpenAI_subsidiary_capitalization_not_VC',715 not in ds and events[715]['event_type']=='subsidiary_capitalization'),
  ('Runway_actual_308m_preserved',events[2967]['raised_amount']==308000000),
  ('DYNA_robot_model_classification',all(events[i]['finer_subsector']=='robot-model' for i in (3618,3125))),
  ('Delos_and_Motive_unknown_instruments_excluded',650 not in ds and 2765 not in ds),
  ('Crusoe_initial_close_counted_without_anticipated_total',3031 in ds and events[3031]['raised_amount'] is None),
  ('all_6035_predecessor_event_ids_retained',set(range(1,6036))<=set(events)),
  ('all_7426_predecessor_observation_ids_retained',set(range(1,7427))<={r['observation_id'] for r in data['observations_all']})]:check('regression:'+name,ok,None)
 return {'snapshot_id':snapshot_id,'no_trends_calculated':True,'market_completeness_certified':False,
 'check_1':{'counted_total_component_conflicts':len(own_components)+len(sum_pairs),'component_or_increment_disclosures_linked_within_one_episode':len(linked_disclosures),'details':sum_pairs},
 'check_2':{'unexplained_14day_5percent_pairs':len(pairs),'details':pairs,'held_near_duplicate_pairs':len(data['heatmap_near_duplicate_holds'])},
 'check_3':{'remaining_name_variant_groups':len(collisions),'possible_aliases_and_homonyms':collisions},
 'check_4':{'undecided_held_rows':sum(r['undecided'] for r in undecided),'by_period_priority':undecided},
 'check_5':{'needs_public_source_without_final_disposition':sum(r['undecided'] for r in unresolved_sources),'unverified_needs_source_excluded':sum(r['unverified_excluded'] for r in unresolved_sources),'by_period_priority':unresolved_sources},
 'check_6':{'counted_deals':len(counted),'records_per_counted_deal_max':max((r['counted_record_count'] for r in counted),default=0),'by_period':priced},
 'check_7':{'fine_cells':len(fc),'parent_cells':len(pc),'fine_subsectors_meeting_ten_in_both_periods':sum(r['comparison_ready'] for r in fc if r['period_id']=='prior_12m'),'parent_categories_meeting_ten_in_both_periods':sum(r['comparison_ready'] for r in pc if r['period_id']=='prior_12m'),'nonoverlapping_display_groups_meeting_ten_in_both_periods':sum(r['comparison_ready'] for r in display if r['period_id']=='prior_12m'),'fine_cells_under_ten':[r for r in fc if r['cell_under_10']],'parent_cells_under_ten':[r for r in pc if r['cell_under_10']]},
 'check_8':{'verified_changes':len(changes),'changed_fact_rows_missing_public_url_or_quote':len(missing)},
 'financing_review_verification_remaining':verification_remaining,
 'equity_episodes_by_period':dict(collections.Counter(ep['period_id'] for ep in eps))}
