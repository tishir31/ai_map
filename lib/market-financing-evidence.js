'use strict';
const crypto = require('node:crypto');
const {stripHtml} = require('./ecosystem-worker');
const {parsePublicUrl,readPublicPage} = require('./public-web');
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MONEY = '(?:US\\$|USD\\s*|\\$)\\s*([0-9,]+(?:\\.[0-9]+)?)\\s*(billion|million|bn|[bm])\\b';
const unsafeEvent = /\b(?:not|never|denied|denies|rumou?r|fictional|hypothetical|illustrative|fabricated|template|cancel(?:ed|led)|withdrawn|unclosed|pending|subject to|has yet to|will close|expected to close|plans?|aims?|expects?|seeking|may|might)\b/i;
const physical = /\b(?:robots?|robotics|autonomous|simulation|physics|physical AI|hardware engineering|sensors?|drones?|manufacturing)\b/i;
function host(url) { return parsePublicUrl(url).hostname.toLowerCase().replace(/^www\./,''); }
function sameAuthority(url,website) {try {const h=host(url),root=host(website);return parsePublicUrl(url).protocol==='https:'&&(h===root||h.endsWith('.'+root));}catch{return false;}}
function primaryText(raw) {
  const article=String(raw).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main=String(raw).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  return stripHtml(article || main || raw);
}
function aliasesFor(company,aliases=[]) {return [...new Set([company.name,...aliases].filter(x=>typeof x==='string'&&x.trim().length>2).map(normalize))];}
function fundingClause(event,aliases) {
  for(const alias of aliases) {
    // Bind the amount to the issuer's completed raise, including a descriptive appositive.
    const re=new RegExp('\\b'+escape(alias)+'(?:,\\s+[^,]{1,220},)?\\s+(?:(?:today|has|have|now|successfully)\\s+){0,3}(?:raised|raises|secured|closed|closes|announced|announces)\\s+(?:(?:a|an|its)\\s+)?'+MONEY,'i');
    const match=event.match(re);
    if(match)return {alias,quote:match[0],token:match[0].match(new RegExp(MONEY,'i'))[0],amount:Number(match[1].replaceAll(',',''))*(/^(?:billion|bn|b)$/i.test(match[2])?1e9:1e6)};
  }
  return null;
}
function parseDate(quote) {
  const iso=quote.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if(iso&&new Date(iso[1]+'T00:00Z').toISOString().slice(0,10)===iso[1])return iso[1];
  const match=quote.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})\b/i);
  if(!match)return null;
  const parsed=new Date(match[0]);return Number.isFinite(parsed.valueOf())?parsed.toISOString().slice(0,10):null;
}
function extractEvidence(page,company,aliases,runDate) {
  const text=primaryText(page.text),names=aliasesFor(company,aliases);
  const sentences=text.split(/(?<=[.!?])\s+(?=[A-Z“])/u);
  // Headlines and decimal money amounts can cross a simplistic sentence boundary.
  const events=sentences.map(normalize).filter(s=>fundingClause(s,names)&&/\b(?:funding|financing|series|round)\b/i.test(s)&&!unsafeEvent.test(s));
  const fullEvent=events.find(s=>/\b(?:has raised|announced|secured|closed)\b/i.test(s)&&s.endsWith('.'))||events[0];
  // Do not bind a page title/menu to a dateline buried later in the page.
  const event=fullEvent&&fullEvent.length>1500?(fullEvent.includes(' -- ')?fullEvent.slice(fullEvent.lastIndexOf(' -- ')+4):null):fullEvent;
  if(!event||event.length>1500)return null;
  const clause=fundingClause(event,names);
  const dates=[...text.matchAll(/\b(?:20\d{2}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2})\b/gi)].map(m=>({quote:m[0],date:parseDate(m[0]),index:m.index})).filter(x=>x.date&&x.date<=runDate&&x.index>=text.indexOf(event)-2500&&x.index<=text.indexOf(event)+event.length);
  const dated=new Set(dates.map(x=>x.date)).size===1?dates.find(x=>x.date>=new Date(Date.parse(runDate+'T00:00Z')-30*864e5).toISOString().slice(0,10)):null;
  const physicalQuote=sentences.map(normalize).find(s=>physical.test(s)&&/\b(?:builds?|building|develops?|automates?|automating|platform|manufactures?|manufacturing|robotics integrator|supply|deployments?|simulation|reasoning|physical AI company)\b/i.test(s)&&!unsafeEvent.test(s)&&s.length>=8&&s.length<=1500);
  if(!dated||!physicalQuote)return null;
  const round=event.match(/\b(?:Series\s+[A-Z][0-9]?|pre-seed|seed)\b/i)?.[0]||null;
  return {qualifying:true,eventDate:dated.date,amountUsd:clause.amount,issuerQuote:clause.alias,amountQuote:clause.quote,eventQuote:event,dateQuote:dated.quote,physicalQuote,round,roundQuote:round?event:null,lead:null,leadQuote:null};
}
function verifyFinancingV2(candidate,company,page,extracted,runDate,{aliases=[],registeredSources=[]}={}) {
  const held=reason=>({disposition:'held',reason});
  if(!company||!company.website||company.is_sample)return held('unique_known_company_identity_required');
  if(page.status<200||page.status>=300)return held('source_http_error');
  if(!sameAuthority(page.finalUrl,company.website)&&!registeredSources.includes(page.finalUrl))return held('canonical_source_not_official');
  if(candidate.gmail_message_id||candidate.activity_type!=='financing')return held('event_type_requires_review');
  const text=primaryText(page.text);
  if(!extracted||extracted.qualifying!==true)return held('source_evidence_uncertain');
  for(const key of ['issuerQuote','amountQuote','eventQuote','dateQuote','physicalQuote'])if(!normalize(extracted[key])||normalize(extracted[key]).length>1500||!text.includes(normalize(extracted[key])))return held('quote_not_in_capture');
  const event=normalize(extracted.eventQuote),names=aliasesFor(company,aliases),clause=fundingClause(event,names);
  if(!clause||unsafeEvent.test(event)||!/\b(?:funding|financing|series|round)\b/i.test(event))return held('funding_status_requires_review');
  if(/\b(?:false reports?|fabricated|hypothetical|correction|retracted|retraction|financing was cancel(?:ed|led)|round (?:never closed|was withdrawn))\b/i.test(text))return held('source_context_requires_review');
  const amount=Number(extracted.amountUsd);
  if(clause.amount!==amount||amount!==Number(candidate.deal_value_usd)||!Number.isFinite(amount)||amount<=0||!normalize(extracted.amountQuote).includes(clause.token))return held('funding_amount_conflict');
  if(!/^(?:US\$|USD)/i.test(clause.token)&&!['US','USA','United States'].includes(company.geography))return held('currency_requires_review');
  const date=String(extracted.eventDate||''),canonicalDate=parseDate(normalize(extracted.dateQuote));
  if(date!==canonicalDate||date>runDate||date<new Date(Date.parse(runDate+'T00:00Z')-30*864e5).toISOString().slice(0,10)||Math.abs(Date.parse(date)-Date.parse(candidate.candidate_date))>7*864e5)return held('event_date_conflict');
  if(!physical.test(extracted.physicalQuote)||unsafeEvent.test(extracted.physicalQuote)||!/\b(?:builds?|building|develops?|automates?|automating|platform|manufactures?|manufacturing|robotics integrator|supply|deployments?|simulation|reasoning|physical AI company)\b/i.test(extracted.physicalQuote))return held('physical_relevance_requires_review');
  const round=normalize(extracted.round)||null;
  if(round&&(!/^(?:Series [A-Z][0-9]?|pre-seed|seed)$/i.test(round)||!event.toLowerCase().includes(round.toLowerCase())))return held('round_not_supported');
  const actor='PhysicalAI daily review agent: official-source financing evidence; user-authorized publication';
  const activity={id:'a-daily-review-'+candidate.id,company_id:company.id,date_announced:date,activity_type:'financing',deal_value_usd:amount,counterparty:'N/A',subsector:company.subsector,geography:company.geography,description:`${company.name} announced $${(amount/1e6).toLocaleString('en-US')} million in ${round?round+' ':''}financing. This is a company-reported financing announcement.`,source_id:'s-daily-review-'+candidate.id,source_type:'press release',source_url:page.finalUrl,source_reference:company.name+' financing announcement',confidence:'reported',review_status:'approved',is_sample:false,entered_by:actor,approved_by:actor};
  return {disposition:'published',reason:'official_financing_verified',activity,evidence:{policyVersion:'financing-v2',canonicalUrl:page.finalUrl,companyId:company.id,companyWebsite:company.website,eventDate:date,amountUsd:amount,moneyToken:clause.token,round,lead:null,issuerQuote:clause.alias,dateQuote:normalize(extracted.dateQuote),amountQuote:clause.quote,eventQuote:event,physicalQuote:normalize(extracted.physicalQuote),roundQuote:round?event:null,leadQuote:null,captureText:text,captureHash:crypto.createHash('sha256').update(text).digest('hex')}};
}
function officialLinks(page,website) {
  const links=[];
  for(const m of String(page.text).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {const url=new URL(m[1].replace(/&amp;/g,'&'),page.finalUrl).href,label=stripHtml(m[2]);if(sameAuthority(url,website)&&/fund|financ|series|rais|press|news|blog/i.test(url+' '+label))links.push({url,priority:/fund|financ|series|rais/i.test(url+' '+label)?0:1});}catch{}
  }
  return [...new Map(links.sort((a,b)=>a.priority-b.priority).map(x=>[x.url,x])).values()].map(x=>x.url).slice(0,8);
}
async function findOfficialFinancing(candidate,company,runDate,{aliases=[],registeredSources=[],read=readPublicPage}={}) {
  const urls=[...registeredSources];
  if(sameAuthority(candidate.source_url,company.website))urls.unshift(candidate.source_url);
  urls.push(company.website);
  const seen=new Set();let checked=0;
  while(urls.length&&checked<4) {
    const url=urls.shift();if(seen.has(url))continue;seen.add(url);checked++;
    let page;try {page=await read(url);}catch{continue;}
    if(!sameAuthority(page.finalUrl,company.website)&&!registeredSources.includes(page.finalUrl))continue;
    const extracted=extractEvidence(page,company,aliases,runDate);
    if(extracted){const result=verifyFinancingV2(candidate,company,page,extracted,runDate,{aliases,registeredSources});if(result.disposition==='published')return result;}
    urls.unshift(...officialLinks(page,company.website).filter(x=>!seen.has(x)));
  }
  return {disposition:'held',reason:'official_financing_source_unresolved',provenance:{officialPagesChecked:checked}};
}
module.exports={extractEvidence,verifyFinancingV2,findOfficialFinancing,fundingClause,primaryText,sameAuthority,parseDate,officialLinks};
