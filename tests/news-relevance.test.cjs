const test=require('node:test'),assert=require('node:assert/strict');
const collector=require('../api/ingest-web-news');
test('a software cybersecurity financing cannot inherit a manufacturing namesake',async()=>{
 const title='Hadrian Raises $40 Million to Expand Autonomous Offensive Security Platform';
 assert.equal(collector._test.isSoftwareOnlyCyberHeadline(title),true);
 assert.deepEqual(await collector.publicCollection.process({title,link:'https://publisher.example/news'},'Public source',{},{}),{disposition:'rejected',reason:'software-only-cybersecurity'});
 for(const physical of ['Exein raises $270 million for embedded cybersecurity','Cybersecurity startup raises funding for robot hardware','Hadrian raises financing for manufacturing automation'])assert.equal(collector._test.isSoftwareOnlyCyberHeadline(physical),false);
});
test('an unavailable article retains a qualifying private RSS lead without manufacturing evidence',async()=>{
 const web=require('../lib/public-web'),graph=require('../lib/graph-api'),{isPublicSafeActivity}=require('../lib/market-snapshot');
 const originalRead=web.readPublicPage,originalRest=graph.restRequest;
 web.readPublicPage=async()=>({status:403,finalUrl:'https://issuer.example/financing',text:'Access denied'});
 graph.restRequest=async(_config,name)=>{assert.equal(name,'web_collection_dedupe_context');return{companies:[],activities:[],pending:[]};};
 try{
  const result=await collector.publicCollection.process({title:'Kodama raises $7 million to scale physical AI for forestry',link:'https://issuer.example/financing',pubDate:'2026-10-19'},'Public RSS',{startDate:'2026-10-13',endDate:'2026-10-20'},{});
  assert.equal(result.disposition,'staged');assert.equal(result.candidate.status,'pending');
  assert.equal(result.provenance.sourceUnavailable,true);assert.equal(result.provenance.captureKind,'rss-headline-only');
  assert.match(result.candidate.intelligence_cautions.join(' '),/Independent issuer evidence/);
  assert.equal(isPublicSafeActivity(result.candidate),false);assert.equal(result.activity,undefined);
 }finally{web.readPublicPage=originalRead;graph.restRequest=originalRest;}
});
