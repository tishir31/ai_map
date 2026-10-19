'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validBatch,reviewBeforeFetch,summary,runRecovery}=require('../lib/market-recovery-worker');
test('recovery validates named batches and holds stale/unsafe candidates before fetching',()=>{
 assert(validBatch('market-recovery-2026-10-19-user-cycle'));assert(!validBatch('../private'));
 assert.equal(reviewBeforeFetch({input:{candidate:{candidate_date:'2020-01-01',source_url:'https://issuer.org/'}}},'2026-10-19').reason,'historical_source_review_required');
 assert.equal(reviewBeforeFetch({input:{candidate:{candidate_date:'2026-10-19',source_url:'gmail:private'}}},'2026-10-19').reason,'canonical_source_required');
 assert.equal(reviewBeforeFetch({input:{candidate:{candidate_date:'2026-10-19',source_url:'https://issuer.org/'}}},'2026-10-19'),null);
});
test('recovery uses shared collection/review and commits durable evidence before completion',async()=>{
 const id='market-recovery-2026-10-19-user-cycle',calls=[];
 let state={id,runDate:'2026-10-19',collection:{status:'running',window:{startDate:'2026-10-13',endDate:'2026-10-19'}},review:null},claimed=false;
 const rpc=async(_,name,body)=>{calls.push(name);
  if(name==='market_recovery_status')return structuredClone(state);
  if(name==='claim_web_recovery_task')return {id:'feed',kind:'feed',locked_by:'lease',input:{query:'public financing'}};
  if(name==='finish_web_recovery_task'){assert.deepEqual(body.p_result.items,[]);state.collection.status='completed';return {};}
  if(name==='acquire_market_recovery_review'){state.review??={status:'running',selected:1};return state.review;}
  if(name==='claim_market_recovery_task'){if(claimed)return null;claimed=true;return {id:'review',locked_by:'lease',input:{candidate:{candidate_date:'2026-10-19',source_url:'https://issuer.org/'}}};}
  if(name==='finish_market_recovery_task'){assert.equal(body.p_result.disposition,'held');state.review={status:'completed',selected:1,reviewed:1,held:1};return state.review;}
  if(name==='close_market_recovery_disposition'||name==='close_market_recovery_batch')return null;
  throw Error(name);
 };
 const r=await runRecovery({}, {batch:id,asOf:'2026-10-19'},{rpc,collect:{search:async()=>[]},reviewTask:async()=>({disposition:'held',reason:'source_evidence_required'})});
 assert(r.done);assert(calls.indexOf('finish_web_recovery_task')<calls.indexOf('acquire_market_recovery_review'));assert(calls.includes('close_market_recovery_disposition'));
 assert(!JSON.stringify(summary(state)).includes('https://issuer.org'),'public response has counts, not private task inputs');
});
