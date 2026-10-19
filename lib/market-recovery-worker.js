'use strict';
const graph=require('./graph-api');
const {reviewTask,boundedModelJson}=require('./market-review-worker');
const {readPublicPage}=require('./public-web');
const rpc=(config,name,body)=>graph.restRequest(config,name,{method:'POST',rpc:true,body});
const validBatch=id=>/^market-recovery-\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,40}$/.test(id||'');

function reviewBeforeFetch(task,asOf){
 const q=task.input.candidate;
 if(!q?.candidate_date||q.candidate_date>asOf||q.candidate_date<new Date(Date.parse(asOf+'T00:00Z')-30*864e5).toISOString().slice(0,10))return {disposition:'held',reason:'historical_source_review_required'};
 if(!q.source_url||!/^https:\/\//.test(q.source_url))return {disposition:'held',reason:'canonical_source_required'};
 return null;
}
function summary(state){
 const c=state.collection,r=state.review;
 return {id:state.id,runDate:state.runDate,collection:c?{status:c.status,selected:c.selected,processed:c.processed,staged:c.staged,duplicates:c.duplicates,rejected:c.rejected,errors:c.errors,remaining:c.remaining}:null,
 review:r?{status:r.status,selected:r.selected,reviewed:r.reviewed,published:r.published,held:r.held,duplicates:r.duplicates,nonqualifying:r.nonqualifying,errors:r.errors}:null,
 done:Boolean(c&&c.status!=='running'&&r&&r.status!=='running')};
}
async function runRecovery(config,{batch,asOf},deps={}){
 if(!validBatch(batch))throw new graph.ApiError(400,'Invalid recovery batch.');
 const call=deps.rpc||rpc,collect=deps.collect||require('../api/ingest-web-news').publicCollection;
 let state=await call(config,'market_recovery_status',{p_id:batch});
 if(!state)throw new graph.ApiError(404,'Owner-created recovery not found.');
 if(summary(state).done){await call(config,'close_market_recovery_batch',{p_id:batch});return summary(state);}
 const started=Date.now();
 for(let n=0;n<8&&Date.now()-started<10000;n++){
  if(state.collection.status==='running'){
   const task=await call(config,'claim_web_recovery_task',{p_run_id:batch});
   if(!task)break;
   let result;
   try{result=task.kind==='feed'?{disposition:'feed-completed',items:await collect.search(task.input.query,4)}:await collect.process(task.input.item,task.input.sourceName,state.collection.window,config);}
   catch(error){result={disposition:'error',reason:require('./web-collection-worker').coarseError(error),...(error.provenance?{provenance:error.provenance}:{})};}
   await call(config,'finish_web_recovery_task',{p_task_id:task.id,p_lock:task.locked_by,p_result:result});
  }else{
   await call(config,'acquire_market_recovery_review',{p_id:batch});
   const task=await call(config,'claim_market_recovery_task',{p_run_id:batch});
   if(!task)break;
   let result;
   try{result=reviewBeforeFetch(task,asOf)||await (deps.reviewTask||reviewTask)(task,asOf,{readPublicPage:deps.readPublicPage||readPublicPage,modelJson:deps.modelJson||boundedModelJson});}
   catch(error){result={disposition:'error',reason:/429|quota/i.test(error.message||'')?'provider_rate_limit':/time|abort|deadline/i.test(error.message||'')?'provider_timeout':'source_or_model_error'};}
   await call(config,'finish_market_recovery_task',{p_task_id:task.id,p_lock:task.locked_by,p_result:result});
   await call(config,'close_market_recovery_disposition',{p_task_id:task.id});
  }
  state=await call(config,'market_recovery_status',{p_id:batch});
  if(summary(state).done)break;
 }
 await call(config,'close_market_recovery_batch',{p_id:batch});
 return summary(await call(config,'market_recovery_status',{p_id:batch}));
}
async function handler(req,res){
 graph.setCors(req,res,'GET, OPTIONS');if(req.method==='OPTIONS')return graph.sendJson(res,204,null);
 if(req.method!=='GET')return graph.sendJson(res,405,{ok:false,error:'Use GET.'});
 try{
  const auth=await require('./scheduler-auth').authorizeScopedSchedulerRequest(req,'market-review-daily',process.env,[String(process.env.CRON_SECRET||'').trim()]);
  if(!auth.ok)throw new graph.ApiError(auth.status,auth.error);
  const result=await runRecovery(graph.getConfig(),{batch:graph.param(req,'batch'),asOf:auth.schedulerRunDate});
  return graph.sendJson(res,result.done?200:202,{ok:true,recovery:result});
 }catch(error){return graph.sendError(res,error);}
}
module.exports={validBatch,reviewBeforeFetch,summary,runRecovery,handler};
