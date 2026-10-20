const test=require('node:test'),assert=require('node:assert/strict');
const collector=require('../api/ingest-web-news');
test('a software cybersecurity financing cannot inherit a manufacturing namesake',async()=>{
 const title='Hadrian Raises $40 Million to Expand Autonomous Offensive Security Platform';
 assert.equal(collector._test.isSoftwareOnlyCyberHeadline(title),true);
 assert.deepEqual(await collector.publicCollection.process({title,link:'https://publisher.example/news'},'Public source',{},{}),{disposition:'rejected',reason:'software-only-cybersecurity'});
 for(const physical of ['Exein raises $270 million for embedded cybersecurity','Cybersecurity startup raises funding for robot hardware','Hadrian raises financing for manufacturing automation'])assert.equal(collector._test.isSoftwareOnlyCyberHeadline(physical),false);
});
