'use strict';
const assert=require('node:assert/strict');
const worker=require('../lib/market-review-worker');
const health=require('../lib/market-review-health');
const company={id:'c-known',name:'Known Robotics',website:'https://known-robotics.com',subsector:'other',geography:'United States',is_sample:false};
const candidate={id:'rq-public-fixture',candidate_company:company.name,candidate_date:'2026-09-18',activity_type:'financing',deal_value_usd:70000000,description:'Known Robotics raises Series C',source_url:'https://known-robotics.com/news',source_type:'article',status:'pending'};
const text='September 18, 2026: Known Robotics announced US$70 million in Series C financing led by Investor Capital. Known Robotics builds autonomous industrial robots for physical manufacturing.';
const extracted={qualifying:true,eventDate:'2026-09-18',amountUsd:70000000,round:'Series C',lead:'Investor Capital',issuerQuote:'Known Robotics announced',dateQuote:'September 18, 2026: Known Robotics announced US$70 million in Series C financing led by Investor Capital.',amountQuote:'Known Robotics announced US$70 million in Series C financing',eventQuote:'Known Robotics announced US$70 million in Series C financing led by Investor Capital.',physicalQuote:'Known Robotics builds autonomous industrial robots for physical manufacturing.',roundQuote:'US$70 million in Series C financing',leadQuote:'financing led by Investor Capital.'};
const page={status:200,text,finalUrl:candidate.source_url};
const positive=worker.verifyEvidence(candidate,company,page,extracted,'2026-09-18');assert.equal(positive.disposition,'published');assert.equal(positive.activity.approved_by,worker.ACTOR);assert.equal(positive.activity.confidence,'reported');
for(const [field,value,reason]of[['eventDate','2026-09-17','event_date_conflict'],['amountUsd',270000000,'funding_amount_conflict'],['round','Series D','round_not_supported'],['lead','Made up','lead_not_supported'],['issuerQuote','External company announced','quote_not_in_capture']]){assert.equal(worker.verifyEvidence(candidate,company,page,{...extracted,[field]:value},'2026-09-18').reason,reason);}
assert.equal(worker.verifyEvidence(candidate,company,{...page,finalUrl:'https://known-robotics.com.evil.example/news'},extracted,'2026-09-18').reason,'canonical_source_not_official');
assert.equal(worker.verifyEvidence(candidate,company,page,{qualifying:false},'2026-09-18').disposition,'held');
assert.equal(worker.officialUrl('http://known-robotics.com/news',company.website),false);assert.equal(worker.officialUrl('https://known-robotics.com@evil.example/news',company.website),false);
assert.equal(worker.verifyEvidence(candidate,company,page,{...extracted,eventQuote:'Known Robotics plans US$70 million in financing'},'2026-09-18').disposition,'held');
for(const scenario of [
 {event:'Known Robotics announced it had not raised US$70 million in Series C financing.'},
 {event:'Known Robotics announced Partner Labs raised US$70 million in Series C financing.'},
 {event:'Known Robotics announced US$10 million in financing, while Partner Labs raised US$70 million.',round:null,roundQuote:null,lead:null,leadQuote:null,amountQuote:'Partner Labs raised US$70 million.'},
 {event:'Known Robotics announced US$70 million in investment in Partner Labs.',round:null,roundQuote:null,lead:null,leadQuote:null,amountQuote:'US$70 million in investment'},
 {dateQuote:'September 18, 2026: New product available. Archive: September 18, 2025: '+extracted.eventQuote},
 {physicalQuote:'Known Robotics has physical offices in Boston.'},
 {physicalQuote:'Other Company builds autonomous industrial robots.'},
 {context:'False reports said: "'},
 {context:'A quotation: "'},
 {suffix:' Correction: this round never closed.'},
 {suffix:' Update: This financing was canceled before closing.'},
 {suffix:' This financing remains subject to approval and will close next year.'},
 {event:'Known Robotics announced US$70 million in financing',round:null,roundQuote:null,lead:null,leadQuote:null,amountQuote:'US$70 million in financing',suffix:' targets for 2027; fundraising has yet to begin.'},
 {event:'Known Robotics announced US$70 million in financing.',round:'Series C',roundQuote:'US$70 million in Series C financing',lead:null,leadQuote:null,amountQuote:'US$70 million in financing',append:' In 2020, Other Labs raised US$70 million in Series C financing.'}
]){
 const event=scenario.event||extracted.eventQuote,dateQuote=scenario.dateQuote||'September 18, 2026: '+event;
 const x={...extracted,...scenario,eventQuote:event,dateQuote,issuerQuote:scenario.event?event:extracted.issuerQuote,amountQuote:scenario.amountQuote||event};
 const capture=(scenario.context||'')+dateQuote+(scenario.context?'"':'')+' '+x.physicalQuote+(scenario.suffix||'')+(scenario.append||'');
 assert.equal(worker.verifyEvidence({...candidate,description:scenario.round===null?'Financing':candidate.description},company,{...page,text:capture},x,'2026-09-18').disposition,'held',JSON.stringify(scenario));
}
assert.equal(worker.verifyEvidence({...candidate,intelligence_cautions:['conflicting round']},company,page,extracted,'2026-09-18').disposition,'held');
let calls=0;const deps={readPublicPage:async()=>{calls++;return page;},modelJson:async()=>({data:extracted,model:'configured-provider-fixture'})};
(async()=>{
 const savedFetch=global.fetch,savedKey=process.env.GEMINI_API_KEY;let providerCalls=0;
 process.env.GEMINI_API_KEY='synthetic-test-key';global.fetch=async()=>{providerCalls++;return {ok:false,status:429};};
 try{await assert.rejects(worker.boundedModelJson('fixture'));assert.equal(providerCalls,1);}finally{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=savedKey;}
 assert.equal((await worker.reviewTask({input:{candidate,company}},'2026-09-18',deps)).disposition,'published');assert.equal(calls,1);
 assert.equal((await worker.reviewTask({input:{candidate,company:null}},'2026-09-18',deps)).reason,'unique_known_company_identity_required');assert.equal(calls,1);
 let finished;const rpc=async(_c,name)=>name==='acquire_market_review_run'?{id:'run',status:'running',run_date:'2026-09-18'}:name==='claim_market_review_task'?{id:'task',locked_by:'lock',input:{candidate,company}}:name==='finish_market_review_task'?{status:'completed'}:{status:'completed'};
 await worker.runDailyReview({}, {asOf:'2026-09-18'}, {rpc:async(c,n,b)=>{if(n==='finish_market_review_task')finished=b;return rpc(c,n,b);},...deps});assert.equal(finished.p_result.disposition,'published');
 await assert.rejects(worker.runDailyReview({}, {asOf:'2026-09-18'}, {rpc:async(c,n,b)=>{if(n==='finish_market_review_task')throw Error('telemetry unavailable');return rpc(c,n,b);},...deps}));
 let acquisitions=0,claims=0;
 const rolloverRpc=async(_c,n)=>n==='acquire_market_review_run'?(++acquisitions===1?{id:'old',run_date:'2026-09-17',status:'running'}:{id:'today',run_date:'2026-09-18',status:'running'}):n==='claim_market_review_task'?(claims++,null):{status:'completed'};
 const carried=await worker.runDailyReview({}, {asOf:'2026-09-18'}, {now:new Date('2026-09-18T16:00Z'),rpc:rolloverRpc});
 assert.equal(carried.id,'today');assert.equal(acquisitions,2);assert.equal(claims,1);
 acquisitions=0;claims=0;assert.equal((await worker.runDailyReview({}, {asOf:'2026-09-18'}, {now:new Date('2026-09-18T03:00Z'),rpc:rolloverRpc})).status,'completed');assert.equal(acquisitions,1);
 const summary=health.reviewHealth({ok:true,data:[{run_date:'2026-09-18',status:'completed',selected:0,reviewed:0,input:'PRIVATE',started_at:'2026-09-18'}]},new Date('2026-09-18T16:00Z'));assert.equal(summary.latestRun.selected,0);assert(!JSON.stringify(summary).includes('PRIVATE'));assert.equal(health.reviewHealth({ok:false}).warning,'review-telemetry-unavailable');
 assert.equal(summary.configured,false);assert.equal(summary.nextExpectedReview,null);
 assert.equal(health.reviewHealth({ok:true,data:[]},new Date('2026-09-18T16:00Z'),{ok:true,data:{configured:true}}).nextExpectedReview,'2026-09-18T16:10:00.000Z');
 const active={ok:true,data:{configured:true}},previous={ok:true,data:[{run_date:'2026-09-17',status:'completed',selected:0}]};
 assert.equal(health.reviewHealth(previous,new Date('2026-09-18T15:19Z'),active).overdue,false);
 assert.equal(health.reviewHealth(previous,new Date('2026-09-18T15:20Z'),active).overdue,true);
 assert.equal(health.reviewHealth({ok:true,data:[{run_date:'2026-09-18',status:'running'}]},new Date('2026-09-18T15:30Z'),active).overdue,false);
 assert.equal(health.reviewHealth({ok:true,data:[{run_date:'2026-09-17',status:'running'}]},new Date('2026-09-18T09:00Z'),active).overdue,true);
 assert.equal(health.reviewHealth(previous,new Date('2026-09-18T16:00Z'),{ok:false}).overdue,false);
 console.log('market review tests passed: strict issuer/date/amount/round/lead, URL authority, unknown company, bounded provider, durable finish errors, safe zero subset');
})().catch(e=>{console.error(e);process.exitCode=1;});
