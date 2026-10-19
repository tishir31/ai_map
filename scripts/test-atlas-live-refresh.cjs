'use strict';
const assert=require('node:assert/strict');
const {PRIMARY_MARKET_FEEDS,isPrimaryMarketItem,primaryFeedUrl}=require('../lib/primary-market-feeds');
const {primaryText}=require('../lib/market-financing-evidence');
const {extractTransaction,verifyTransaction,verifyWireIssuer}=require('../lib/market-transaction-evidence');
const {parseRss}=require('../api/ingest-web-news')._test;
const {gateCandidate}=require('../api/ingest-web-news')._test;
const collectionContext={companies:[],activities:[],pending:[],companyById:new Map(),refreshWindow:{startDate:'2026-10-13',endDate:'2026-10-19'}};
assert(gateCandidate({candidate_company:'120ft',candidate_date:'2026-10-15',activity_type:'financing',deal_value_usd:null,subject:'120ft raises angel funding for humanoid robot factories',description:'120ft raises angel funding for humanoid robot factories',snippet:'€576,000 angel funding',extracted_text:'Stock prices. Job openings. Subscribe to our podcast.'},collectionContext).keep,'A native-currency financing headline must survive unrelated article chrome; publication still requires independent source evidence');
const company={id:'c-surgical',name:'Surgical Robotics',website:'https://surgical-robotics.com',geography:'United States',subsector:'robotics',is_sample:false};
const candidate={id:'rq-surgical',candidate_company:company.name,candidate_date:'2026-10-19',activity_type:'financing',deal_value_usd:36000000};
const text='October 19, 2026. Surgical Robotics, a leader in non-invasive robotic brain surgery, today announced it has secured $36 million in financing led by Fund One. Surgical Robotics develops a robotic radiosurgery platform.';
const page={status:200,finalUrl:company.website+'/news/financing',text};
const evidence=extractTransaction(page,company,'2026-10-19');
assert(evidence,'Affirmative secured-financing clause and robotic application must resolve');
assert.equal(verifyTransaction(candidate,company,page,evidence,'2026-10-19').disposition,'published');
for(const negative of ['announced it has not secured','announced it may secure','denied it has secured']){
 const p={...page,text:text.replace('announced it has secured',negative)};
 assert.equal(verifyTransaction(candidate,company,p,extractTransaction(p,company,'2026-10-19'),'2026-10-19').disposition,'held',negative);
}
assert.equal(PRIMARY_MARKET_FEEDS.length,4);
for(const source of PRIMARY_MARKET_FEEDS)assert(new URL(primaryFeedUrl(source.query)).hostname==='www.globenewswire.com');
assert.throws(()=>primaryFeedUrl('feed:http://127.0.0.1/private'));
assert(isPrimaryMarketItem({title:'Surgery startup secures financing',summary:'The company develops robotic systems.'}));
assert(!isPrimaryMarketItem({title:'Robotics market size forecast and financing analysis'}));
const rss='<rss><channel><item><title>Robotic surgery financing</title><link>https://www.globenewswire.com/news-release/2026/10/19/surgical.html</link><pubDate>Mon, 19 Oct 2026 12:00:00 GMT</pubDate><description>Robotic systems secured funding.</description></item></channel></rss>';
assert(!('summary'in parseRss(rss,4)[0]),'Existing RSS contract is unchanged');
assert.match(parseRss(rss,4,true)[0].summary,/Robotic/);
assert.match(primaryText('<main>About Surgical Robotics. Learn more at <a href="https://surgical-robotics.com/">our website</a>.</main>'),/https:\/\/surgical-robotics\.com/);
(async()=>{
 const q={...candidate,source_url:'https://rss.globenewswire.com/news-release/2026/10/19/source.html'};
 const wire={status:200,finalUrl:q.source_url,text:'<main>'+text+' About Surgical Robotics. Learn more at <a href="https://surgical-robotics.com/">Surgical Robotics</a>.</main>'};
 const proof=await verifyWireIssuer(q,async url=>url===q.source_url?wire:{status:200,finalUrl:company.website,text:'Surgical Robotics develops robotic radiosurgery.'},company);
 assert(proof,'Public website in issuer anchor and official RSS-host release must retain issuer proof');
 console.log('Atlas live-refresh checks passed: direct feeds, unchanged RSS contract, issuer anchors, robotic applications, affirmative clauses and negation holds.');
})().catch(e=>{console.error(e);process.exitCode=1;});
// Public HTTP exports must never recover a record absent from the public projection.
const {marketCsv}=require('../lib/atlas-export');
const publicSnapshot={companies:[{id:'c',name:'=formula'}],activities:[{id:'public',company_id:'c',source_url:'https://issuer.org/announcement',activity_type:'financing',date_announced:'2026-10-19',description:'$36M public round',deal_value_usd:36000000}]};
assert.match(marketCsv(publicSnapshot,['public']),/https:\/\/issuer.org\/announcement/);
assert.match(marketCsv(publicSnapshot,['public']),/"'=formula"/);
assert.throws(()=>marketCsv(publicSnapshot,['private']));

const {buildSnapshot}=require('../lib/market-snapshot');
const privateKey='a-rq-gmail-'+('a1'.repeat(8))+'-approved-release';
const projection=buildSnapshot({companies:[{id:'c',name:'Surgical Robotics',is_sample:false}],activities:[{id:privateKey,company_id:'c',review_status:'approved',is_sample:false,confidence:'reported',source_type:'press release',source_url:'https://issuer.org/announcement',source_reference:'Public announcement',date_announced:'2026-10-19',activity_type:'financing'}],exclusions:[],ingestionRuns:[]});
assert(!JSON.stringify(projection).includes('a1'.repeat(8)),'Approved public releases must not expose their original mailbox key');
assert.match(projection.activities[0].id,/^public-[a-f0-9]{24}$/);
const {renderPublicDossier}=require('../lib/atlas-export-model.cjs');
const fixtureGraph={metadata:{asOf:'2026-10-19',counts:{}},entities:[{id:'ENT-9900010',kind:'company',canonicalName:'Public Robotics',displayName:'Public Robotics',aliases:[],externalIds:{}},{id:'ENT-9900011',kind:'person',canonicalName:'Public Founder',displayName:'Public Founder',aliases:[],externalIds:{}}],relationships:[{id:'public-founding',subjectId:'ENT-9900011',predicate:'founded',objectId:'ENT-9900010',layer:'company',temporal:{startYear:2024,endYear:null,precision:'exact_start'},evidenceIds:['public-source'],status:'published',derived:false,revision:1}],evidence:[{id:'public-source',url:'https://issuer.org/founder',publisher:'Issuer',tier:'official',retrievedAt:'2026-10-19',stance:'supports',locator:'Founder biography'}],facts:[],collections:[],authorMentions:[],signalDefinitions:[],coverage:[]};
assert.match(renderPublicDossier(fixtureGraph,'ENT-9900010',2,'2026-10-19'),/https:\/\/issuer.org\/founder/,'Delivered dossier must contain source URLs, not only evidence IDs');
