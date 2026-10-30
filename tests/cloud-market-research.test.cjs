'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const f=require('../lib/cloud-market-research');
const company={id:'c-test',name:'Test Robotics',website:'https://testrobotics.com',geography:'United States',subsector:'robotics'};
const day='2026-10-30',event='Test Robotics announced a partnership with Acme to pilot autonomous warehouse robots in 2027.';
const physical='Test Robotics develops autonomous warehouse robots.';
const page={status:200,finalUrl:'https://testrobotics.com/news/pilot',text:`October 30, 2026. ${event} ${physical}`};
const data={qualifying:true,date:day,dateQuote:'October 30, 2026',issuerQuote:company.name,eventQuote:event,physicalQuote:physical,type:'partnership',counterparty:'Acme',summary:'Test Robotics and Acme announced a warehouse robotics pilot planned for 2027. The announcement does not establish an operating deployment.',status:'planned'};
const verified={supported:true,identityCorrect:true,dateCorrect:true,typeCorrect:true,statusCorrect:true,physicalRelevance:true,noUnsupportedClaims:true,noConflict:true,issues:[]};
test('broader types remain source-bound and never create financial value',()=>{const r=f.verifyEditorial(company,page,data,verified,day);assert.equal(r.disposition,'published');assert.equal(r.activity.deal_value_usd,null);assert.equal(r.activity.activity_type,'partnership');});
for(const [name,patch,check]of[['invented quotation',{eventQuote:'Test Robotics deployed 1000 robots.'},{}],['wrong date',{date:'2026-10-29'},{}],['wrong issuer',{issuerQuote:'Acme'},{}],['wrong event type',{type:'financing'},{}],['independent disagreement',{}, {statusCorrect:false}],['conflicting source',{}, {issues:['Pilot is not deployed']}],['private text',{summary:'Contact private@example.com for confidential terms of this robot deployment.'},{}]])test('holds '+name,()=>assert.equal(f.verifyEditorial(company,page,{...data,...patch},{...verified,...check},day).disposition,'held'));
test('cannot relabel financing as other',()=>{const s='Test Robotics raised USD10 million in Series A funding.';assert.equal(f.verifyEditorial(company,{...page,text:page.text+' '+s},{...data,type:'other',eventQuote:s},verified,day).reason,'transaction_type_cannot_be_bypassed');});
test('discovery excludes private, denied, future and redirect sources',()=>{const r={company:'Example Robotics',date:day,type:'product launch',url:'https://robot.example.org/news',title:'New robot'};const a=[r,{...r,url:'http://127.0.0.1/test'},{...r,url:'https://extendrobotics.com/news'},{...r,url:'https://news.google.com/foo'},{...r,date:'2099-01-01'},{...r,type:'partnership'}];assert.equal(f.sanitizeDiscovery({items:a},{start:day,end:day}).length,2);});
test('date parsing supports original Chinese announcement dates',()=>assert.equal(f.dateFromQuote('2026年10月30日'),day));
test('discovery must actually use grounded web search',async()=>{await assert.rejects(f.discover({input:{topic:1,window:{start:day,end:day}}},async()=>({data:{items:[]},groundedUrls:[]})),/grounding/);});
test('worker persists failures for retry and always validates finish lease',async()=>{const calls=[];const t={id:'task',locked_by:'lock',kind:'discover',input:{topic:1,window:{start:day,end:day}}};await f.run({}, {rpc:async(c,name,body)=>{calls.push({name,body});return name==='claim_cloud_market_task'?t:{};},model:async()=>{throw Error('HTTP 429');}});assert.equal(calls[1].body.p_result.reason,'provider_rate_limit');assert.equal(calls[1].body.p_lock,'lock');});
test('read-only/private candidate cannot fetch or call models',async()=>{const r=await f.review({input:{candidate:{gmail_message_id:'private',source_url:'https://testrobotics.com/news'}}},day,{read:()=>{throw Error('should not fetch');}});assert.equal(r.reason,'private_or_invalid_candidate');});
test('unknown issuer is held for source discovery, not fabricated',async()=>{const r=await f.review({input:{candidate:{source_url:'https://unrecognized.example.org/news',candidate_company:'Unknown'}}},day);assert.equal(r.disposition,'needs_source');});
test('provider diagnostics retain quota identity without raw errors or credentials',()=>{
 const d=f.providerDiagnostics(429,{error:{status:'RESOURCE_EXHAUSTED',message:'secret credential and source text',details:[{violations:[{quotaMetric:'generativelanguage.googleapis.com/generate_content_free_tier_requests',quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier',quotaValue:'0',secret:'hidden'}]},{retryDelay:'45s'}]}},'gemini-3.5-flash-lite');
 assert.equal(d.quotas[0].value,0);assert.equal(d.retryDelay,'45s');assert.equal(JSON.stringify(d).includes('secret'),false);
});
test('cloud model override uses current-model parameters without changing legacy defaults',async()=>{
 const saved=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fixture';
 try{await require('../lib/ecosystem-worker').modelJson('test',{model:'gemini-3.5-flash-lite',search:true,fetchImpl:async(u,o)=>{
  assert.match(u,/gemini-3\.5-flash-lite:generateContent/);const body=JSON.parse(o.body);assert.deepEqual(body.tools,[{google_search:{}}]);assert.equal(body.generationConfig.temperature,undefined);assert.equal(body.generationConfig.thinkingConfig,undefined);
  return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"items":[]}'}]}}]})};
 }});}finally{if(saved===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=saved;}
});
test('OpenAI research requires real search output and keeps provider storage disabled',async()=>{
 const body={status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://testrobotics.com/news/pilot'}]}},{type:'message',content:[{type:'output_text',text:'{"items":[]}'}]}]};
 const fetchImpl=async(u,o)=>{assert.equal(u,'https://api.openai.com/v1/responses');const request=JSON.parse(o.body);assert.equal(request.store,false);assert.equal(request.tool_choice,'required');assert.deepEqual(request.tools,[{type:'web_search'}]);return{ok:true,json:async()=>body};};
 const options={search:true,env:{OPENAI_API_KEY:'fixture'},fetchImpl};
 const result=await f.openAiModel('Return JSON',options);assert.equal(result.groundedUrls[0],'https://testrobotics.com/news/pilot');assert.equal(result.model,'openai:gpt-4.1-mini');
 body.output.shift();await assert.rejects(f.openAiModel('Return JSON',options),/grounding/);
 body.status='incomplete';await assert.rejects(f.openAiModel('Return JSON',options),/Incomplete/);
});
test('OpenAI provider errors preserve only safe diagnostics',async()=>{
 await assert.rejects(f.openAiModel('Return JSON',{env:{OPENAI_API_KEY:'fixture'},fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:{code:'insufficient_quota',message:'secret prompt',param:null}})})}),e=>e.providerDiagnostics.code==='insufficient_quota'&&!JSON.stringify(e.providerDiagnostics).includes('secret'));
});
