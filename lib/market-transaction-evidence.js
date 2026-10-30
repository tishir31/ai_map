'use strict';

const crypto = require('node:crypto');
const {parsePublicUrl, readPublicPage} = require('./public-web');
const {primaryText, sameAuthority, officialLinks, parseDate} = require('./market-financing-evidence');
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MONEY = '(?:US\\$|USD\\s*|\\$|GBP\\s*|£|JPY\\s*|¥|EUR\\s*|€)\\s*[0-9,]+(?:\\.[0-9]+)?(?:\\s*(?:billion|million|bn|[bm])\\b)?';
const DATE = /\b(?:20\d{2}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[,]?\s+20\d{2})\b/gi;
const BAD_EVENT = /\b(?:denied|denies|rumou?r|fabricated|hypothetical|illustrative|retracted|canceled|cancelled|withdrawn|not raised|never raised|seeking|plans to raise|may raise|might raise)\b/i;
const BAD_CAPTURE = /\b(?:false reports?|fabricated|hypothetical|financing was cancel(?:ed|led)|round never closed|round was withdrawn)\b/i;
const PHYSICAL = /\b(?:robots?|robotic|robotics|humanoids?|autonomous|autonomy|simulation|physics|physical AI|hardware engineering|sensors?|sensing|drones?|uncrewed|unmanned|manufacturing|tactile)\b/i;
const WIRES = new Set(['www.prnewswire.com', 'prnewswire.com', 'www.businesswire.com', 'businesswire.com', 'www.globenewswire.com', 'globenewswire.com', 'rss.globenewswire.com']);

function moneyValue(token, company) {
  const match = normalize(token).match(/^(US\$|USD\s*|\$|GBP\s*|£|JPY\s*|¥|EUR\s*|€)\s*([0-9,]+(?:\.[0-9]+)?)(?:\s*(billion|million|bn|[bm]))?$/i);
  if (!match) return null;
  const symbol = match[1].trim().toUpperCase();
  const currency = /^(US\$|USD)$/.test(symbol) ? 'USD' : symbol === '$'
    ? ['US', 'USA', 'United States'].includes(company.geography) ? 'USD' : null
    : symbol === 'GBP' || symbol === '£' && ['UK','United Kingdom','Great Britain'].includes(company.geography) ? 'GBP'
    : symbol === 'JPY' || symbol === '¥' && company.geography === 'Japan' ? 'JPY'
    : /^(EUR|€)$/.test(symbol) ? 'EUR' : null;
  const scaled = Number(match[2].replaceAll(',', '')) * (/^(billion|bn|b)$/i.test(match[3] || '') ? 1e9 : match[3] ? 1e6 : 1);
  const amount = Math.round(scaled * 100) / 100;
  return currency && Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER ? {currency, amount, amountUsd: currency === 'USD' ? amount : null} : null;
}

function namesFor(company, aliases = []) {
  return [...new Set([company.name, ...aliases].filter(x => typeof x === 'string' && x.trim().length >= 3).map(normalize))];
}

function datedBefore(text, index, runDate) {
  const dates = [...text.matchAll(DATE)].map(m => ({quote: m[0], date: parseDate(m[0]), index: m.index}))
    .filter(x => x.date && x.index <= index && x.index >= index - 5000);
  const nearest = dates.at(-1);
  if (!nearest || nearest.date > runDate || nearest.date < new Date(Date.parse(runDate + 'T00:00Z') - 30 * 864e5).toISOString().slice(0, 10)) return null;
  return nearest;
}

function sentenceFrom(text, start) {
  const rest = text.slice(start, start + 1500);
  const end = rest.search(/[.!?](?=\s+[A-Z“]|$)/u);
  return normalize(end >= 0 ? rest.slice(0, end + 1) : rest);
}

function fundingClause(text, company, aliases, runDate = null) {
  const appositive = '(?:\\s*,\\s*[^;:]{1,240}?,)?';
  const announcement = '(?:(?:today|has|have|now|successfully)\\s+){0,3}(?:raised|raises|secured|closed|closes|announced|announces|announcing)\\s+(?:(?:(?:that\\s+)?it\\s+has\\s+(?:raised|secured|closed)|has\\s+(?:raised|secured|closed)|the\\s+(?:close|closing|completion)\\s+of|its|a|an|approximately|about|nearly|over|more\\s+than)\\s+){0,5}';
  const stealth = '(?:(?:today|has)\\s+){0,2}(?:emerged|emerges)\\s+from\\s+stealth\\s+with\\s+';
  const closing = '(?:(?:today|has)\\s+){0,2}closed\\s+(?:its|the|a)\\s+Series\\s+[A-Z][0-9]?\\s+(?:funding\\s+)?round\\s+with\\s+';
  const facility = '(?:(?:today|has)\\s+){0,2}entered\\s+into\\s+(?:a|an)\\s+';
  for (const issuer of namesFor(company, aliases)) {
    const re = new RegExp('\\b' + escape(issuer) + '(?:\\s*\\([^)]{1,100}\\))?' + appositive + '\\s+(?:' + announcement + '|' + stealth + '|' + closing + '|' + facility + ')(' + MONEY + ')', 'gi');
    for (const match of text.matchAll(re)) {
      if (runDate && !datedBefore(text, match.index, runDate)) continue;
      if ([...match[0].matchAll(new RegExp(MONEY, 'gi'))].length !== 1) continue;
      const event = sentenceFrom(text, match.index);
      if (BAD_EVENT.test(event) || !/\b(?:funding|financing|series|round|term loan)\b/i.test(event)) continue;
      const afterAmount = event.slice(match[0].length, match[0].length + 180);
      if (/\bentered\s+into\b/i.test(match[0]) && !/^\s*(?:(?:unsecured|secured)\s+)?financing\s+facility\b/i.test(afterAmount)) continue;
      if (/^\s*(?:in\s+)?(?:total|cumulative|valuation|revenue|investment in\b|investment into\b)/i.test(afterAmount)) continue;
      return {issuerQuote: issuer, amountQuote: match[0], moneyToken: match[1], eventQuote: event, index: match.index};
    }
  }
  return null;
}

function extractTransaction(page, company, runDate, {aliases = [], activityType = 'financing', counterparty = null} = {}) {
  const text = primaryText(page.text);
  if (BAD_CAPTURE.test(text)) return null;
  let clause;
  if (activityType === 'm&a') {
    const names = namesFor(company, aliases);
    const target = names.find(name => new RegExp('\\b(?:acquire|acquired|acquires|acquiring)\\s+' + escape(name) + '\\b', 'i').test(text));
    if (!target) return null;
    const targetAt = text.search(new RegExp('\\b(?:acquire|acquired|acquires|acquiring)\\s+' + escape(target) + '\\b', 'i'));
    // Select the actual announcement paragraph, not a navigation headline.
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z“])/u);
    const event = sentences.find(s => s.includes(target) && /\b(?:announced|entered into|signed|completed)\b/i.test(s) && /\b(?:definitive agreement|acquisition|acquire|acquired)\b/i.test(s));
    if (!event || !counterparty || !event.includes(counterparty) || BAD_EVENT.test(event)) return null;
    const announcement = new RegExp('\\b' + escape(counterparty) + '(?:\\s*\\([^)]{1,100}\\))?\\s+(?:today\\s+)?(?:announced|has announced|entered into|signed|completed)', 'i');
    const inside = event.search(announcement);
    if (inside < 0) return null;
    const index = text.indexOf(event) + inside;
    const cleaned = normalize(event.slice(inside));
    const near = text.slice(index, index + cleaned.length + 2000);
    const price = near.match(new RegExp('(?:transaction|purchase price|acquisition)[^.!?]{0,100}?(?:valued at|of|for)\\s+(?:approximately\\s+|about\\s+)?(' + MONEY + ')[^.!?]*(?:[.!?]|$)', 'i'));
    if (!price) return null;
    clause = {issuerQuote: target, counterpartyQuote: counterparty, amountQuote: price[0], moneyToken: price[1], eventQuote: cleaned, index, category: /\bcompleted\b/i.test(cleaned) && !/\bexpected|subject to\b/i.test(cleaned) ? 'acquisition-closed' : 'acquisition-announced'};
  } else {
    clause = fundingClause(text, company, aliases, runDate);
    if (!clause) return null;
    clause.category = /\b(?:term loan|debt financing|credit facility|loan facility|financing facility)\b/i.test(clause.eventQuote) ? 'debt' : 'equity';
  }
  const date = datedBefore(text, clause.index, runDate);
  const value = moneyValue(clause.moneyToken, company);
  const applications = text.split(/(?<=[.!?])\s+(?=[A-Z“])/u).map(normalize)
    .filter(s => PHYSICAL.test(s) && /\b(?:builds?|building|develop\w*|operates?|service|platform|pioneer\w*|introduced|manufactur\w*|deploy\w*|automates?|infrastructure|sensors?|models?|technology|technologies|data engine|provider)\b/i.test(s) && s.length >= 8 && s.length <= 1500 && !BAD_EVENT.test(s));
  const physicalQuote = applications.find(s => namesFor(company,aliases).some(name => s.toLowerCase().includes(name.toLowerCase())))
    || applications.find(s => text.indexOf(s)>=clause.index && text.indexOf(s)<clause.index+2500 && /\b(?:our|we|the company|this capital)\b/i.test(s));
  if (!date || !value || !physicalQuote || clause.eventQuote.length > 1500) return null;
  const round = clause.category === 'equity' ? clause.eventQuote.match(/\b(?:Series\s+[A-Z][0-9]?|Pre-A|pre-seed|seed)\b/i)?.[0] || null : null;
  return {...clause, eventDate: date.date, dateQuote: date.quote, physicalQuote, round, ...value};
}

function verifyTransaction(candidate, company, page, extracted, runDate, {aliases = [], registeredSources = []} = {}) {
  const held = reason => ({disposition: 'held', reason});
  if (!company || !company.website || company.is_sample) return held('unique_known_company_identity_required');
  if (page.status < 200 || page.status >= 300) return held('source_http_error');
  if (!sameAuthority(page.finalUrl, company.website) && !registeredSources.includes(page.finalUrl)) return held('canonical_source_not_official');
  if (candidate.gmail_message_id || !['financing', 'm&a'].includes(candidate.activity_type)) return held('event_type_requires_review');
  const text = primaryText(page.text);
  if (BAD_CAPTURE.test(text)) return held('source_context_requires_review');
  if (!extracted) return held('source_evidence_uncertain');
  for (const key of ['issuerQuote', 'dateQuote', 'eventQuote', 'amountQuote', 'moneyToken', 'physicalQuote']) {
    if (!normalize(extracted[key]) || extracted[key].length > 1500 || !text.includes(extracted[key])) return held('quote_not_in_capture');
  }
  if (!namesFor(company, aliases).includes(extracted.issuerQuote) || BAD_EVENT.test(extracted.eventQuote)) return held('issuer_or_status_conflict');
  const money = moneyValue(extracted.moneyToken, company);
  if (!money || money.amount !== extracted.amount || money.currency !== extracted.currency || money.amountUsd !== extracted.amountUsd) return held('currency_or_amount_conflict');
  const expected = candidate.deal_value_usd == null ? null : Number(candidate.deal_value_usd);
  if (expected !== money.amountUsd) return held('funding_amount_conflict');
  if (parseDate(extracted.dateQuote) !== extracted.eventDate || extracted.eventDate > runDate || extracted.eventDate < new Date(Date.parse(runDate + 'T00:00Z') - 30 * 864e5).toISOString().slice(0,10) || Math.abs(Date.parse(extracted.eventDate) - Date.parse(candidate.candidate_date)) > 7 * 864e5) return held('event_date_conflict');
  if (candidate.activity_type === 'financing') {
    const bound = fundingClause(extracted.eventQuote, company, aliases);
    if (!bound || bound.moneyToken !== extracted.moneyToken || bound.amountQuote !== extracted.amountQuote) return held('issuer_amount_binding_required');
    const debt = /\b(?:term loan|debt financing|credit facility|loan facility|financing facility)\b/i.test(extracted.eventQuote);
    if (!['equity','debt'].includes(extracted.category) || (extracted.category === 'debt') !== debt) return held('financing_category_conflict');
    const assertedRound = String(candidate.description || '').match(/\b(?:Series\s+[A-Z][0-9]?|pre-seed|seed)\b/i)?.[0];
    if (assertedRound && assertedRound.toLowerCase() !== String(extracted.round || '').toLowerCase()) return held('round_conflict');
  } else if (!['acquisition-announced','acquisition-closed'].includes(extracted.category) || extracted.counterpartyQuote !== candidate.candidate_counterparty || !extracted.counterpartyQuote || !extracted.eventQuote.includes(extracted.counterpartyQuote) || !/\b(?:acquire|acquired)\b/i.test(extracted.eventQuote) || (extracted.category === 'acquisition-closed' && (!/\bcompleted\b/i.test(extracted.eventQuote) || /\bexpected|subject to\b/i.test(extracted.eventQuote)))) return held('acquisition_binding_required');
  const actor = 'PhysicalAI evidence review: public transaction announcement; user-authorized publication';
  const qualifier = extracted.amountQuote.match(new RegExp('\\b(approximately|about|nearly|over|more than)\\s+'+escape(extracted.moneyToken)+'$', 'i'))?.[1] || '';
  const amountLabel = (qualifier ? qualifier.toLowerCase()+' ' : '') + (money.currency === 'USD' ? '$' + (money.amount / (money.amount >= 1e9 ? 1e9 : 1e6)).toLocaleString('en-US') + (money.amount >= 1e9 ? ' billion' : ' million') : money.currency + ' ' + money.amount.toLocaleString('en-US'));
  const description = candidate.activity_type === 'm&a'
    ? `${extracted.counterpartyQuote} ${extracted.category === 'acquisition-closed' ? 'completed its acquisition of' : 'announced a definitive agreement to acquire'} ${company.name} for ${amountLabel}. ${extracted.category === 'acquisition-announced' ? 'The transaction is announced and remains subject to closing conditions. ' : ''}This is a company-reported transaction.`
    : `${company.name} ${extracted.category === 'debt' ? 'announced ' + amountLabel + ' in debt financing' : 'announced ' + amountLabel + ' in ' + (extracted.round ? extracted.round + ' ' : '') + 'financing'}. This is a company-reported financing announcement.`;
  return {disposition: 'published', reason: 'public_transaction_verified', activity: {id: 'a-daily-review-' + candidate.id, company_id: company.id, date_announced: extracted.eventDate, activity_type: candidate.activity_type, deal_value_usd: money.amountUsd, counterparty: extracted.counterpartyQuote || 'N/A', subsector: company.subsector, geography: company.geography, description, source_id: 's-daily-review-' + candidate.id, source_type: 'press release', source_url: page.finalUrl, source_reference: company.name + ' transaction announcement', confidence: 'reported', review_status: 'approved', is_sample: false, entered_by: actor, approved_by: actor}, evidence: {policyVersion: 'transactions-v3', canonicalUrl: page.finalUrl, companyId: company.id, companyWebsite: company.website, eventDate: extracted.eventDate, category: extracted.category, currency: money.currency, amountNative: money.amount, amountUsd: money.amountUsd, moneyToken: extracted.moneyToken, round: extracted.round || null, issuerQuote: extracted.issuerQuote, counterpartyQuote: extracted.counterpartyQuote || null, dateQuote: extracted.dateQuote, eventQuote: extracted.eventQuote, amountQuote: extracted.amountQuote, physicalQuote: extracted.physicalQuote, captureText: text, captureHash: crypto.createHash('sha256').update(text).digest('hex')}};
}

async function verifyWireIssuer(candidate, read, knownCompany = null) {
  try {if(!WIRES.has(parsePublicUrl(candidate.source_url).hostname))return null;} catch {return null;}
  let page; try {page = await read(candidate.source_url);} catch {return null;}
  if (page.status !== 200 || !WIRES.has(parsePublicUrl(page.finalUrl).hostname)) return null;
  const text = primaryText(page.text), name = normalize(knownCompany?.name || candidate.candidate_company);
  if (name.length < 3 || name.length > 100 || /[@<>]|\b(?:N\/A|unknown)\b/i.test(name)) return null;
  let aboutName=name,nameBindingQuote=null,aboutAt=text.toLowerCase().lastIndexOf('about '+name.toLowerCase());
  if(aboutAt<0){
    const binding=text.match(new RegExp(escape(name)+'(?:\\s+https:\\/\\/\\S+)?\\s*\\(\\s*[“"]([^”"]{3,80})[”"](?:\\s+or\\s+(?:the\\s+)?[“"](?:the\\s+)?Company[”"])?\\s*\\)','i'));
    if(binding&&new RegExp('^'+escape(binding[1])+'\\s+(?:(?:Industries|Inc\\.?|Incorporated|Ltd\\.?|Limited|Corp\\.?|Corporation|Technologies|Technology|Robotics|Group|Holdings|LLC|PLC)\\s*)+$','i').test(name)&&binding[0].length<=1500){aboutName=binding[1];nameBindingQuote=binding[0];aboutAt=text.toLowerCase().lastIndexOf('about '+aboutName.toLowerCase());}
  }
  if (aboutAt < 0 || !text.includes(name)) return null;
  const about = text.slice(Math.max(0,aboutAt-300), aboutAt + 4000);
  const links = [...about.matchAll(/https?:\/\/[^\s<>"']+/g)].map(x => x[0].replace(/[.,;)]+$/, '')).filter(url => {
    try {const u=parsePublicUrl(url); return u.protocol==='https:' && !/(^|\.)(?:businesswire|prnewswire|globenewswire)\.com$/.test(u.hostname) && !/linkedin|twitter|facebook|instagram|youtube/i.test(u.hostname);} catch {return false;}
  });
  const websites = [...new Set(links.map(url => new URL(url).origin))];
  if (websites.length !== 1 || knownCompany && !sameAuthority(websites[0], knownCompany.website)) return null;
  let home; try {home = await read(websites[0]);} catch {return null;}
  const homepageText = primaryText(home.text);
  if (home.status !== 200 || !sameAuthority(home.finalUrl, websites[0]) || !homepageText.toLowerCase().includes(name.toLowerCase())) return null;
  const company = knownCompany || {id:'c-verified-'+crypto.createHash('sha256').update(new URL(websites[0]).hostname).digest('hex').slice(0,16),name,website:websites[0],geography:'N/A',subsector:'other',is_sample:false,overview:name+' develops technology for physical-world automation. Detailed sector classification is pending.'};
  const proof = {wireUrl:page.finalUrl,website:company.website,websiteQuote:links[0],sourceText:text,sourceHash:crypto.createHash('sha256').update(text).digest('hex'),homepageUrl:home.finalUrl,homepageText,homepageHash:crypto.createHash('sha256').update(homepageText).digest('hex'),...(nameBindingQuote?{aboutName,nameBindingQuote}:{})};
  return {company,proof,page};
}

async function findOfficialTransaction(candidate, company, runDate, {aliases = [], registeredSources = [], read = readPublicPage} = {}) {
  const urls = [...registeredSources];
  if (sameAuthority(candidate.source_url, company.website)) urls.unshift(candidate.source_url);
  urls.push(company.website);
  const seen = new Set();
  for (let checked = 0; urls.length && checked < 6;) {
    const url = urls.shift();
    if (seen.has(url)) continue;
    seen.add(url); checked++;
    let page; try { page = await read(url); } catch { continue; }
    const evidence = extractTransaction(page, company, runDate, {aliases, activityType: candidate.activity_type, counterparty: candidate.candidate_counterparty});
    const result = verifyTransaction(candidate, company, page, evidence, runDate, {aliases, registeredSources});
    if (result.disposition === 'published') return result;
    if (sameAuthority(page.finalUrl, company.website)) urls.unshift(...officialLinks(page, company.website).filter(link => !seen.has(link)));
  }
  return {disposition: 'held', reason: 'official_transaction_source_unresolved'};
}

module.exports = {moneyValue, fundingClause, extractTransaction, verifyTransaction, findOfficialTransaction, verifyWireIssuer, datedBefore, sentenceFrom, WIRES};
