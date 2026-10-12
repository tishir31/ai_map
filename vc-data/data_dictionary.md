# Data dictionary

All rows include `snapshot_id`. IDs are snapshot-scoped; they may change after a rebuild. JSON preserves nulls and arrays; CSV represents arrays as JSON and nulls as blank cells. Amounts use whole currency units, not millions.

`raised_amount` is the reported financial amount in `raised_currency`; consult its basis/composition and qualifiers before calling it equity cash. `committed_amount` is a separate future/conditional/capacity quantity. `valuation_amount` is company valuation; `consideration_amount` is acquisition price, with pre/post-money or equity/enterprise/maximum-contingent basis where disclosed. Lower/upper bounds are separate from the displayed point value. Missing values stay null.

USD values are conversion outputs with explicit FX date/rate/source. Native monetary fields remain authoritative. `qualifies_threshold` can be null when disclosed values do not establish eligibility. `lifecycle_rank=1` identifies the preferred canonical record within the current lifecycle group. `analytical_eligible` and `dashboard_eligible` use different counting rules.

## companies

Canonical company registry, including companies without linked deals.

Fields: `snapshot_id`, `ai_scope`, `canonical_name`, `company_domain`, `company_id`, `country`, `country_iso2`, `metadata_validation`, `primary_subsector`.

## taxonomy

Subsector definitions used in the snapshot.

Fields: `snapshot_id`, `default_ai_scope`, `label`, `subsector_id`.

## aliases

Supported issuer naming aliases; subsidiaries and asset perimeters remain distinct.

Fields: `snapshot_id`, `alias`, `company_id`, `normalized_alias`.

## events_all

Every retained canonical event, including historical, pending, small and undisclosed observations.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## core_equity_all

Counting view for reviewed current-round pure equity with exact-day announcement and one preferred record per lifecycle.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## core_equity_display

Core equity counting view restricted to the display threshold.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## equity_round_announcements

Reviewed preferred equity financing announcements, including unknown cash, signed commitments or mixed packages. An announcement count is not a pure-equity cash-receipt total.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## display_deals

Display view using USD10m raised OR USD100m valuation/consideration. Unknown-value cases remain in events_all.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## ma_all

All acquisition observations and transaction stages.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## ma_announcements_2026

One preferred acquisition record per lifecycle announced in the 2026 scope.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## ma_closings_2026

One preferred acquisition record per lifecycle with a sourced closing date in the 2026 scope.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## reviewed_deals

Source-supported reviewed preferred announcements without blocking flags.

Fields: `snapshot_id`, `acquirer`, `ai_scope`, `analytical_eligible`, `announcement_date`, `announcement_month`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `company`, `company_domain`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_amount_usd`, `consideration_basis`, `consideration_currency`, `consideration_fx_date`, `consideration_fx_date_basis`, `consideration_fx_source_url`, `consideration_fx_usd_per_unit`, `consideration_lower_usd`, `consideration_upper_usd`, `counting_priority`, `country`, `country_iso2`, `dashboard_eligible`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `has_blocking_quality_flag`, `has_supporting_web_source`, `in_announcement_window`, `in_closing_window`, `in_window`, `lifecycle_group_id`, `lifecycle_rank`, `primary_subsector`, `primary_web_confirmed`, `qualifies_threshold`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_amount_usd`, `raised_currency`, `raised_fx_date`, `raised_fx_date_basis`, `raised_fx_source_url`, `raised_fx_usd_per_unit`, `raised_lower_usd`, `raised_upper_usd`, `review_status`, `round_label`, `source_count`, `subsector_label`, `threshold_state`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_amount_usd`, `valuation_basis`, `valuation_currency`, `valuation_fx_date`, `valuation_fx_date_basis`, `valuation_fx_source_url`, `valuation_fx_usd_per_unit`, `valuation_lower_usd`, `valuation_upper_usd`, `web_confirmed`.

## sources

Public source links and publishers. Private evidence has opaque snapshot-scoped source IDs only.

Fields: `snapshot_id`, `evidence_access`, `kind`, `published_date`, `publisher`, `source_id`, `source_url`.

## event_sources

Event-to-evidence links, without email text or private summaries.

Fields: `snapshot_id`, `event_id`, `source_id`, `source_role`.

## investors

Investor names extracted as deal metadata.

Fields: `snapshot_id`, `investor_id`, `name`.

## event_investors

Deal investor relationships.

Fields: `snapshot_id`, `event_id`, `investor_id`.

## lifecycle_groups

Reconciliation groups. Use events_all.lifecycle_rank=1 for preferred observations.

Fields: `snapshot_id`, `lifecycle_group_id`, `lifecycle_key`, `link_basis`.

## quality_flags

Structured warning categories; raw private detail text is omitted.

Fields: `snapshot_id`, `event_id`, `flag`, `flag_id`, `related_event_id`, `severity`.

## reviewed_event_relationships

Source-reviewed distinctions between rounds, instruments, proposals and non-additive headlines. Public source URLs only; raw private relationship evidence is withheld.

Fields: `snapshot_id`, `left_event_id`, `public_evidence_urls`, `reason_categories`, `relationship`, `relationship_id`, `right_event_id`.

## registry_records

Every retained discovery-company record. A registry record is not a financing.

Fields: `snapshot_id`, `company_id`, `registry_record_id`, `review_status`.

## registry_sources

Source links for discovery and directory records.

Fields: `snapshot_id`, `registry_record_id`, `source_id`, `source_role`.

## company_financial_snapshots

Directory estimates, cumulative funding and valuation context. Never sum these as dated financing events.

Fields: `snapshot_id`, `amount`, `amount_lower`, `amount_qualifier`, `amount_upper`, `as_of_date`, `as_of_month`, `basis`, `company_id`, `company_snapshot_id`, `context_only`, `currency`, `directory_value_not_native_transaction_currency`, `extraction_review_status`, `metric`, `observed_at`, `registry_record_id`, `review_status`.

## company_coverage

Registry and financial-event coverage; zero linked events does not prove zero deals.

Fields: `snapshot_id`, `ai_scope`, `atlas_registry_records`, `canonical_name`, `company_domain`, `company_id`, `country`, `country_iso2`, `country_normalization_state`, `coverage_state`, `financial_snapshot_records`, `funding_snapshot_records`, `history_checked_at`, `history_review_outcome`, `observed_2026_event_records`, `observed_core_equity_records`, `observed_event_records`, `primary_subsector`, `prior_registry_records`, `registry_review_status`, `registry_source_count`, `total_registry_records`, `valuation_snapshot_records`.

## observations_all

One row per original retained event observation, projected to public financial facts. Conflicting assertions survive independently of preferred event values.

Fields: `snapshot_id`, `ai_scope`, `announcement_date`, `announcement_month`, `asserted_company`, `closing_date`, `closing_date_basis`, `closing_date_precision`, `committed_amount`, `committed_amount_qualifier`, `committed_basis`, `committed_currency`, `consideration_amount`, `consideration_amount_lower`, `consideration_amount_qualifier`, `consideration_amount_upper`, `consideration_basis`, `consideration_currency`, `date_basis`, `date_precision`, `event_id`, `event_status`, `event_type`, `extraction_method`, `extraction_review_status`, `financial_context_categories`, `funding_composition`, `observation_id`, `primary_subsector`, `raised_amount`, `raised_amount_basis`, `raised_amount_lower`, `raised_amount_qualifier`, `raised_amount_upper`, `raised_currency`, `review_status`, `round_label`, `valuation_amount`, `valuation_amount_lower`, `valuation_amount_qualifier`, `valuation_amount_upper`, `valuation_basis`, `valuation_currency`, `web_confirmed`.

## public_market_context_facts

Public IPO, listed placement and traded-capitalization facts, kept separate from VC raised cash. Gross, net, proposed proceeds, shares, greenshoe and trading/offer prices remain separate quantities.

Fields: `snapshot_id`, `base_net_proceeds`, `base_net_proceeds_qualifier`, `base_new_shares`, `closed_date`, `company`, `completed`, `context_only`, `counts_as_private_vc_cash`, `currency`, `estimated_net_proceeds`, `event_id`, `greenshoe_exercised_date`, `greenshoe_net_proceeds`, `greenshoe_net_proceeds_qualifier`, `greenshoe_new_shares`, `gross_proceeds`, `gross_proceeds_qualifier`, `kind`, `listing_date`, `market_capitalization`, `market_capitalization_qualifier`, `net_proceeds`, `net_proceeds_qualifier`, `new_shares`, `observation_id`, `offer_price_per_share`, `over_allotment_included`, `price_context`, `price_per_share`, `proceeds_qualifier`, `proposed_gross_proceeds`, `public_evidence_urls`, `reference_date`, `reference_traded_price`, `reported_gross_proceeds`, `reported_gross_proceeds_lower`, `signed_date`.

## observation_reviews

Explicit observation dispositions with public evidence and paraphrased issue categories.

Fields: `snapshot_id`, `checked_at`, `disposition`, `event_id`, `observation_id`, `public_evidence_urls`, `reason_categories`, `review_id`.

## leads_all

Every retained discovery lead and disposition, including resolved and excluded context.

Fields: `snapshot_id`, `checked_at`, `company`, `lead_id`, `public_evidence_urls`, `published_date`, `reason_categories`, `resolved_event_id`, `resolved_event_ids`, `source_url`, `status`.

## unresolved_leads

Pending and inaccessible leads; these are not verified transactions.

Fields: `snapshot_id`, `checked_at`, `company`, `lead_id`, `public_evidence_urls`, `published_date`, `reason_categories`, `resolved_event_id`, `resolved_event_ids`, `source_url`, `status`.

## company_history_reviews

Actual company research queries, checked sources, dated dispositions and issuer/acquirer reference boundaries.

Fields: `snapshot_id`, `checked_at`, `company`, `company_history_review_id`, `company_id`, `country_assertion`, `country_source_url`, `issuer_event_ids`, `public_opened_source_urls`, `public_source_urls`, `queries`, `reason_categories`, `related_acquisition_events`, `review_outcome`.

## audited_country_assertions

Country assertions with a valid public supporting URL. Company IDs belong to this snapshot; historical audit-company reference namespaces are labelled and numeric historical IDs are not promoted to current IDs.

Fields: `snapshot_id`, `assertion_id`, `checked_at`, `company`, `company_id`, `company_id_namespace`, `country`, `country_iso2s`, `country_role`, `historical_reference_namespace`, `source_url`.

## country_availability_metrics

Separate missing raw country, one normalized ISO, known multiple countries and known labels without a single ISO. Null ISO does not mean country was undisclosed; row counts may repeat the same issuer across different transactions.

Fields: `snapshot_id`, `dataset`, `known_label_without_single_iso`, `known_multiple_country_labels`, `missing_raw_country`, `null_iso_rows`, `raw_country_available_percent`, `raw_country_available_rows`, `single_iso_country`, `total_rows`.

## source_coverage

Source-family calendar and pagination coverage. Private Gmail searches and raw limitations are not published.

Fields: `snapshot_id`, `coverage_id`, `coverage_limit_categories`, `coverage_query_private`, `matched_records`, `pagination_complete`, `read_records`, `source_family`, `window_end`, `window_start`.

## completion_counts

Audit outcome counts, including pending and inaccessible cases.

Fields: `snapshot_id`, `audit_type`, `outcome`, `reviewed_rows`.

## fx_rates

Sourced FX rates actually referenced by exported event conversions.

Fields: `snapshot_id`, `currency`, `fx_rate_id`, `rate_date`, `source_url`, `usd_per_unit`.

## event_fx_conversions

Native monetary values are retained alongside explicit FX conversions.

Fields: `snapshot_id`, `amount_field`, `conversion_date_basis`, `event_id`, `fx_rate_id`, `usd_amount`, `usd_lower`, `usd_upper`.

## company_search_logs

Logged indexed company searches; indexed URLs are not automatically claims of full article access.

Fields: `snapshot_id`, `checked_at`, `company`, `indexed_source_urls`, `query`, `research_mode`.

## external_audit_response

One sanitized outcome per external audit finding, with public evidence and prior-public-event-ID to current-ID crosswalks. Free-text private audit reasons and original uploaded audit payload are withheld.

Fields: `snapshot_id`, `audit_finding_index`, `audited_snapshot_id`, `checked_at`, `company`, `country_cells_reviewed`, `country_cells_unresolved`, `country_cells_verified`, `crosswalk_basis`, `decision_summary`, `event_id_crosswalk`, `finding_type`, `issue_categories`, `matching_event_ids`, `preferred_linked_event_ids`, `previous_matching_event_ids`, `public_evidence_urls`, `review_status`.
