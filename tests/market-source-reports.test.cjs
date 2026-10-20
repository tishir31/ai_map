'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const reports=require('../lib/market-source-reports'),router=require('../lib/physical-ai-router');
const row={id:'news-1',headline:'Known Robotics announces a new deployment',source_url:'https://publisher.example/robots',source_label:'Publisher',reported_date:'2026-10-19',first_seen_at:'2026-10-20T00:00:00Z',financial_totals_eligible:false,private_capture:'PRIVATE'};
test('public source-report projection excludes internal data, withdrawn, unsafe and financial payloads',()=>{
 const out=reports.publicReport(row);assert.equal(out.financialTotalsEligible,false);assert(!JSON.stringify(out).includes('PRIVATE'));
 for(const changes of [{withdrawn_at:'2026-10-20'},{source_url:'http://127.0.0.1/news'},{source_url:'https://www.extendrobotics.com/news'},{financial_totals_eligible:true},{headline:'PRIVATE@example.com'}])assert.equal(reports.publicReport({...row,...changes}),null);
});
test('real public route returns source reports with no-store and sanitized fields',async()=>{
 process.env.SUPABASE_URL='https://db.example';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 global.fetch=async(url)=>{assert(String(url).includes('/rest/v1/market_source_reports?'));return {ok:true,status:200,text:async()=>JSON.stringify([row])}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}};
 await router.handlePhysicalAiRoute({method:'GET',headers:{},query:{physicalAiRoute:'market-source-reports'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.news.length,1);assert.equal(res.body.news[0].verification,'source_report');assert(!JSON.stringify(res.body).includes('PRIVATE'));
 const config=require('../vercel.json');assert(config.rewrites.some(r=>r.source==='/api/market-source-reports'&&r.destination==='/api/pipeline-health?physicalAiRoute=market-source-reports'));
});
