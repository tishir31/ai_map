'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {articleText} = require('../lib/public-article');
const {buildCandidate} = require('../api/ingest-web-news')._test;
const {reviewTask} = require('../lib/market-review-worker');
const {verifyWireIssuer} = require('../lib/market-transaction-evidence');

test('long publisher navigation cannot consume the discovery capture or become the issuer', () => {
  const html = `<html><nav>${'Kit Membership Subscribe Contact Us Canada Raises prices. '.repeat(300)}</nav><main><article><header>October 30, 2026</header><h1>Atlas Robotics raises $40 million</h1><p>Atlas Robotics builds industrial robots.</p></article></main></html>`;
  const text = articleText(html).slice(0, 8000);
  assert.match(text, /October 30, 2026/);
  assert.match(text, /Atlas Robotics builds industrial robots/);
  assert.doesNotMatch(text, /Membership/);
  const candidate = buildCandidate({title:'Atlas Robotics raises $40 million',source:'Publisher',link:'https://publisher.example/news',pubDate:'2026-10-30'},'Public news',{text});
  assert.equal(candidate.candidate_company, 'Atlas Robotics');
  assert.equal(candidate.deal_value_usd, 40000000);
});

const company = {id:'c-atlas',name:'Atlas Robotics',website:'https://atlas-robotics.example',geography:'United States',subsector:'robotics',is_sample:false};
const candidate = {id:'rq-atlas',candidate_company:company.name,candidate_date:'2026-10-30',activity_type:'financing',deal_value_usd:40000000,source_url:'https://news.google.com/rss/articles/unavailable'};
const official = {status:200,finalUrl:company.website+'/news/round',text:'October 30, 2026. Atlas Robotics announced $40 million in Series A financing. Atlas Robotics builds industrial robots.'};
test('known issuer can publish verified official evidence even when Google redirect fails', async () => {
  const result = await reviewTask({input:{candidate,company,registeredSources:[official.finalUrl]}},'2026-10-30',{
    readPublicPage:async url => url===candidate.source_url ? {status:200,finalUrl:url,text:'unavailable redirect'} : official,
    resolveGoogleSource:async()=>{throw Error('source timeout');},
    modelJson:async()=>{throw Error('must use verified evidence');}
  });
  assert.equal(result.disposition,'published');
  assert.equal(result.activity.source_url,official.finalUrl);
});
test('unresolved Google link cannot invent an unknown issuer', async () => {
  await assert.rejects(reviewTask({input:{candidate,company:null}},'2026-10-30',{
    readPublicPage:async url=>({status:200,finalUrl:url,text:'unavailable redirect'}),
    resolveGoogleSource:async()=>{throw Error('source timeout');}
  }), /source timeout/);
});
test('wire tracking host is excluded while an explicit issuer URL still needs homepage proof', async () => {
  const q={...candidate,source_url:'https://www.businesswire.com/news/home/round'};
  const wire={status:200,finalUrl:q.source_url,text:`About Atlas Robotics: Learn more at <a href="https://cts.businesswire.com/tracking">https://atlas-robotics.example</a>.`};
  const read=async url=>url===q.source_url?wire:{status:200,finalUrl:url,text:'Atlas Robotics builds industrial robots.'};
  const issuer=await verifyWireIssuer(q,read,company);
  assert.equal(issuer.company.id,company.id);
  assert.equal(issuer.proof.websiteQuote,company.website);
  assert.equal(await verifyWireIssuer(q,async url=>url===q.source_url?wire:{status:200,finalUrl:url,text:'An unrelated company.'},company),null);
});
