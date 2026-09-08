"use strict";
const {createHash} = require('node:crypto');
const {databaseRpc} = require('./public-actions');
const {runResearchAgent} = require('./research-agents.cjs');
const {parsePublicUrl} = require('./public-web');
const columns = new Set(['website','hq','category','founded','total_funding','last_round','last_round_date','last_round_valuation','key_investors','tier_1_investor','employee_count','product','customers','ib_score','ib_angle','notes']);
const clean = (v,n=1500) => typeof v==='string' ? v.trim().slice(0,n) : '';
const nameKey = value => clean(value,150).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const hash = value => createHash('sha256').update(value).digest('hex').slice(0,20);
function publicUrl(value) { try { return parsePublicUrl(clean(value,2000)).href; } catch { return null; } }
function artifacts(task,output,existing) {
  const rows = new Map(existing.map(r=>[r.normalized_name,r]));
  for (const candidate of (Array.isArray(output.candidates)?output.candidates:[]).slice(0,8)) {
    const name=clean(candidate.companyName,150),key=nameKey(name); if (!key || rows.has(key) || rows.size>=30) continue;
    rows.set(key,{id:`row-${hash(task.run_id+':'+key)}`,run_id:task.run_id,company_name:name,normalized_name:key,rank:rows.size+1,relevance_score:Math.min(100,Math.max(0,Number(candidate.relevanceScore)||0)),website:publicUrl(candidate.website)});
  }
  const cells = new Map(),citations = new Map();
  for (const proposal of (Array.isArray(output.cellProposals)?output.cellProposals:[]).slice(0,24)) {
    const row=rows.get(nameKey(proposal.companyName)),column=clean(proposal.columnKey,40),value=clean(proposal.value);
    if (!row || !columns.has(column) || !value) continue;
    const id=`cell-${hash(row.id+':'+column)}`,ids=[];
    for (const c of (Array.isArray(proposal.citations)?proposal.citations:[]).slice(0,3)) {
      const url=publicUrl(c.url); if(!url) continue; const cid=`cit-${hash(id+':'+url)}`; ids.push(cid);
      citations.set(cid,{id:cid,run_id:task.run_id,row_id:row.id,cell_id:id,url,title:clean(c.title,200)||new URL(url).hostname,evidence:clean(c.evidence,600)||'Agent-provided citation; check the linked page.'});
    }
    if (!ids.length) continue;
    cells.set(id,{id,run_id:task.run_id,row_id:row.id,column_key:column,value,citation_ids:ids});
  }
  return {rows:[...rows.values()],cells:[...cells.values()],citations:[...citations.values()],summary:clean(output.summary,3000)||'Research step completed; check the cited findings.'};
}
async function processPublicResearch(runId) {
  const task=await databaseRpc('claim_public_research_task',{p_run_id:runId||null});
  if (!task) return {processed:false};
  try {
    const url=new URL('/rest/v1/research_rows',process.env.SUPABASE_URL);url.searchParams.set('run_id',`eq.${task.run_id}`);url.searchParams.set('select','*');url.searchParams.set('limit','30');
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if(!response.ok) throw Error('Research context unavailable'); const existing=await response.json();
    const result=await runResearchAgent({id:task.id,runId:task.run_id,type:task.type,status:'running',agentName:task.agent_name,createdAt:task.created_at,input:{...task.input,minAcceptedCompanies:8,rowContext:existing.map(r=>({companyName:r.company_name,website:r.website})),publicMode:true}}, {liveProvider:'gemini',geminiApiKey:process.env.GEMINI_API_KEY,geminiModel:'gemini-2.5-flash',allowMockFallback:false});
    const saved=await databaseRpc('finish_public_research_task',{p_task_id:task.id,p_lock:task.locked_by,p_result:artifacts(task,result.output,existing)});
    if(!saved) throw Error('Research lease expired');
    return {processed:true,runId:task.run_id,taskId:task.id};
  } catch {
    await databaseRpc('finish_public_research_task',{p_task_id:task.id,p_lock:task.locked_by,p_result:{failed:true,summary:'This research step could not complete. Other pending tasks remain available; findings already saved still need citation review.'}});
    throw Error('Research step failed. Existing findings are preserved; refresh for details.');
  }
}
module.exports={processPublicResearch,artifacts};
