'use strict';
const graph=require('./graph-api');
const rpc=(config,name,body)=>graph.restRequest(config,name,{method:'POST',rpc:true,body});
function coarseError(error){
 const text=String(error?.message||''),phase=error?.phase;
 if(phase==='storage')return'storage-error';
 if(phase==='model')return /429|quota/i.test(text)?'provider-rate-limit':/time|abort|deadline/i.test(text)?'provider-timeout':'provider-response';
 if(/public web|public HTTP|public address|Only public|standard port/i.test(text))return'unsafe-source';
 if(/429|quota/i.test(text))return'source-rate-limit';
 if(/time|abort|deadline/i.test(text))return'source-timeout';
 if(/RSS|feed|XML|parse|response/i.test(text))return'source-response';
 if(/HTTP/i.test(text))return'source-http-error';
 return'source-error';
}
async function runWebCollection(config,asOf,plan,dependencies){
 const call=dependencies.rpc||rpc;
 const run=await call(config,'acquire_web_collection_run',{p_run_date:asOf,p_plan:plan});
 if(run.legacy || run.status!=='running')return run;
 const task=await call(config,'claim_web_collection_task',{p_run_id:run.id});
 if(task){
  let result;
  try{result=task.kind==='feed'?{disposition:'feed-completed',items:await dependencies.search(task.input.query,4)}:await dependencies.process(task.input.item,task.input.sourceName,run.window);}
  catch(error){if(!error.phase)error.phase=task.kind==='feed'?'source':'source';result={disposition:'error',reason:coarseError(error),...(error.provenance?{provenance:error.provenance}:{})};}
  // Durable queue insert, disposition/cursor and telemetry are a single SQL transaction.
  await call(config,'finish_web_collection_task',{p_task_id:task.id,p_lock:task.locked_by,p_result:result});
 }
 const summary=await call(config,'summarize_web_collection_run',{p_run_id:run.id});
 if(run.run_date!==asOf && summary.status!=='running' && (dependencies.now||new Date())>=new Date(asOf+'T13:15:00Z'))return call(config,'acquire_web_collection_run',{p_run_date:asOf,p_plan:plan});
 return summary;
}
module.exports={runWebCollection,coarseError};
