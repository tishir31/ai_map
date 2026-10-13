'use strict';
const assert=require('node:assert/strict'),f=require('../lib/market-financing-evidence');
const company={id:'c-robot',name:'Known Robotics',website:'https://known-robotics.com',geography:'United States',subsector:'robotics'};
const candidate={id:'rq-v2',candidate_company:'KnownRobotics',candidate_date:'2026-10-08',activity_type:'financing',deal_value_usd:75000000};
const event='Known Robotics, the physical AI company automating manufacturing, today announced a $75 million Series B, bringing its total capital raised to over $100 million.';
const physical='Known Robotics builds robots that automate manufacturing.';
function page(text){return {status:200,finalUrl:'https://known-robotics.com/news/series-b',text};}
const source=page('October 6, 2026. '+event+' '+physical+' The round values the company at $1.5 billion.');
const extracted=f.extractEvidence(source,company,[],'2026-10-13');assert(extracted);assert.equal(extracted.amountUsd,75000000);assert.equal(extracted.eventDate,'2026-10-06');
assert.equal(f.verifyFinancingV2(candidate,company,source,extracted,'2026-10-13').disposition,'published');
for(const event of ['Known Robotics plans to raise $75 million in funding.','Known Robotics announced Partner Labs raised $75 million in Series B funding.','Known Robotics announced $75 million investment in Partner Labs.','Known Robotics announced a $10 million Series B, while Partner Labs raised $75 million.','Known Robotics announced it had not raised $75 million in funding.']) {
 const p=page('October 6, 2026. '+event+' '+physical);const x=f.extractEvidence(p,company,[],'2026-10-13');assert(!x||f.verifyFinancingV2(candidate,company,p,x,'2026-10-13').disposition==='held',event);
}
for(const [field,value]of [['eventDate','2026-10-07'],['amountUsd',100000000],['physicalQuote','Invented robots'],['round','Series C']])assert.equal(f.verifyFinancingV2(candidate,company,source,{...extracted,[field]:value},'2026-10-13').disposition,'held');
assert.equal(f.verifyFinancingV2(candidate,company,{...source,finalUrl:'https://known-robotics.com.evil.example/news'},extracted,'2026-10-13').disposition,'held');
assert.equal(f.verifyFinancingV2(candidate,company,{...source,text:source.text+' Correction: this round never closed.'},extracted,'2026-10-13').disposition,'held');
assert.equal(f.verifyFinancingV2({...candidate,gmail_message_id:'private'},company,source,extracted,'2026-10-13').disposition,'held');
assert.equal(f.verifyFinancingV2(candidate,{...company,geography:'Australia'},source,extracted,'2026-10-13').reason,'currency_requires_review');
assert.equal(f.extractEvidence(page('October 1, 2026. Other news. '+source.text),company,[],'2026-10-13'),null);
(async()=>{const urls=[];const result=await f.findOfficialFinancing(candidate,company,'2026-10-13',{read:async url=>{urls.push(url);return url===company.website?{status:200,finalUrl:url,text:'<a href="/news/series-b">New funding round</a><a href="https://evil.example">Funding</a>'}:source;}});assert.equal(result.disposition,'published');assert.equal(urls.length,2);assert(!urls.some(x=>x.includes('evil')));console.log('Live financing tests passed: natural announcements, separate source date, valuation/cumulative amounts, official discovery, conflicts/private/currency/ambiguity held');})().catch(e=>{console.error(e);process.exitCode=1;});
