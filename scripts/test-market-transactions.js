'use strict';
const assert=require('node:assert/strict');
const f=require('../lib/market-transaction-evidence');
const {resolveGoogleSource}=require('../lib/google-news-source');
const ingest=require('../api/ingest-web-news')._test;
const company={id:'c-known',name:'Known Robotics',website:'https://known-robotics.com',subsector:'robotics',geography:'United States',is_sample:false};
const day='2026-10-13';
function verified(event,{date=day,currencyAmount=75000000,type='financing',buyer=null,geography='United States'}={}){
 const c={...company,geography},q={id:'rq-proof',candidate_company:c.name,candidate_date:day,activity_type:type,deal_value_usd:currencyAmount,candidate_counterparty:buyer};
 const p={status:200,finalUrl:c.website+'/news/round',text:`${date}. ${event} Known Robotics builds autonomous industrial robots.`};
 return f.verifyTransaction(q,c,p,f.extractTransaction(p,c,day,{activityType:type,counterparty:buyer}),day);
}
assert.equal(verified('Known Robotics, a robot maker, today announced a $75 million Series B, bringing total funding to $100 million.').disposition,'published');
const debt=verified('Known Robotics closed a $5 billion term loan facility.',{currencyAmount:5000000000});assert.equal(debt.evidence.category,'debt');
const gbp=verified('Known Robotics has raised £350,000 in pre-seed financing.',{currencyAmount:null,geography:'United Kingdom'});assert.equal(gbp.evidence.currency,'GBP');assert.equal(gbp.activity.deal_value_usd,null);
for(const event of ['Known Robotics plans to raise $75 million in financing.','Known Robotics announced $75 million investment in Partner Labs.','Known Robotics announced $75 million investment to build a factory.','Known Robotics announced $75 million in total funding.','Known Robotics announced a $75 million valuation.','Partner Labs raised $75 million. Known Robotics announced new funding.','Known Robotics announced $75 million in Series B financing. Correction: the round never closed.'])assert.equal(verified(event).disposition,'held',event);
assert.equal(f.moneyValue('¥300 million',{geography:'N/A'}),null);
assert.equal(f.moneyValue('£2.6 million',{geography:'Egypt'}),null);
assert.equal(f.datedBefore('28th September 2026. Known Robotics announced financing.',21,'2026-10-13').date,'2026-09-28');
assert.equal(verified('Known Robotics announced $75 million in Series B financing.',{date:'2026-07-13'}).disposition,'held');
assert.equal(verified('Known Robotics announced $75 million in Series B financing.',{date:'2027-10-13'}).disposition,'held');
assert.equal(verified('Known Robotics announced $75 million in Series B financing.',{geography:'Australia'}).disposition,'held');
const ma=verified('Buyer Corp announced a definitive agreement to acquire Known Robotics. The transaction is valued at approximately $8.2 billion and is expected to close next quarter.',{type:'m&a',currencyAmount:8200000000,buyer:'Buyer Corp'});assert.equal(ma.disposition,'published');assert.equal(ma.evidence.category,'acquisition-announced');assert.match(ma.activity.description,/subject to closing/);
(async()=>{
 const q={id:'rq-new',candidate_company:'New Robotics',candidate_date:day,activity_type:'financing',deal_value_usd:4000000,source_url:'https://www.prnewswire.com/news/new'};
 const wire={status:200,finalUrl:q.source_url,text:`${day}. New Robotics announced US$4 million in Series A financing. New Robotics builds autonomous industrial robots. About New Robotics Learn more at https://new-robotics.com`};
 const home={status:200,finalUrl:'https://new-robotics.com/',text:'New Robotics builds autonomous industrial robots.'};
 const issuer=await f.verifyWireIssuer(q,async url=>url===q.source_url?wire:home);assert(issuer);assert.equal(issuer.company.geography,'N/A');
 assert.equal(await f.verifyWireIssuer(q,async url=>url===q.source_url?wire:{...home,text:'Other company'}),null);
 assert.equal(await f.verifyWireIssuer({...q,source_url:'https://untrusted.example/news'},()=>{throw Error('must not fetch');}),null);
 const page={status:200,finalUrl:'https://news.google.com/rss/articles/CBMi1234567890',text:'<div data-n-a-ts="1791958432" data-n-a-sg="signatureABC">'};
 const response=")]}'\n\n"+JSON.stringify([['wrb.fr','Fbv4je',JSON.stringify(['garturlres','https://issuer.example/news',1])]]);
 assert.equal(await resolveGoogleSource(page,{post:async body=>{assert.match(body,/Fbv4je/);return response;}}),'https://issuer.example/news');
 await assert.rejects(resolveGoogleSource(page,{post:async()=>response.replace('https://issuer.example/news','http://127.0.0.1/private')}));
 await assert.rejects(resolveGoogleSource({...page,text:'Consent required'},{post:()=>{throw Error('must not post');}}));
 const c=ingest.buildCandidate({title:'Buyer Corp to acquire Known Robotics for $8.2 billion',source:'Issuer',link:'https://issuer.example/news',pubDate:day},'Acquisitions',{url:'https://issuer.example/news',text:'Known Robotics builds robots. Buyer Corp announced a definitive agreement to acquire Known Robotics for $8.2 billion.'});
 assert.equal(c.activity_type,'m&a');assert.equal(c.candidate_company,'Known Robotics');assert.equal(c.candidate_counterparty,'Buyer Corp');
 console.log('Transaction/source tests passed: equity vs cumulative/valuation, debt, native currency, announced M&A, dates, wire issuer ownership, public redirect resolution and M&A staging');
})().catch(e=>{console.error(e);process.exitCode=1;});
