const {test}=require('node:test');
const assert=require('node:assert/strict');
const {artifacts}=require('../lib/public-research-worker');
test('public worker stages bounded sourced cells and rejects unsafe citation URLs',()=>{
  const result=artifacts({run_id:'r'}, {summary:'Findings',candidates:[{companyName:'Figure AI',website:'https://www.figure.ai',relevanceScore:200}],cellProposals:[{companyName:'Figure AI',columnKey:'website',value:'https://www.figure.ai',confidence:'confirmed',citations:[{url:'http://127.0.0.1/private'},{url:'https://www.figure.ai/about'}]},{companyName:'Figure AI',columnKey:'last_round_valuation',value:'invented',citations:[]}]},[]);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].relevance_score,100);assert.equal(result.cells.length,1);assert.equal(result.citations.length,1);assert.equal(result.citations[0].url,'https://www.figure.ai/about');assert.equal(result.cells[0].confidence,undefined);
});
test('live agent metadata is derived from returned findings, without mock counts or publication claims',async()=>{
  const saved=global.fetch;global.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Two candidates need verification',candidates:[{companyName:'Figure AI'},{companyName:'Agility Robotics'}]})}]}}]})});
  try { const {runResearchAgent}=require('../lib/research-agents.cjs');const result=await runResearchAgent({type:'discovery',agentName:'Discovery',input:{}},{liveProvider:'gemini',geminiApiKey:'test'});assert.equal(result.status,'completed');assert.equal(result.output.acceptedCandidates,undefined);assert.equal(result.output.requiresVerification,true);assert.equal(result.output.candidates.length,2); }finally{global.fetch=saved;}
});
