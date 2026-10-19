'use strict';
const graph=require('./graph-api');
const snapshots=require('./graph-snapshot');
const {loadSnapshot}=require('./market-snapshot');

function csvCell(value){const text=String(value??'');return '"'+(/^[=+@-]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';}
function marketCsv(snapshot,ids){
  const selected=new Set(ids);
  const companies=new Map(snapshot.companies.map(company=>[company.id,company.name]));
  const rows=snapshot.activities.filter(row=>selected.has(row.id));
  if(rows.length!==selected.size)throw new graph.ApiError(409,'Some selected records are no longer public. Refresh the list and export again.');
  const lines=[['Date','Company','Activity','USD value','Investors or counterparty','Description','Sources'],...rows.map(row=>[row.date_announced,companies.get(row.company_id)||row.company_id,row.activity_type,row.deal_value_usd,row.counterparty,row.description,[row.source_url,...(row.additional_sources||[]).map(source=>source.url)].join(' | ')])];
  return lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
async function handler(req,res){
  graph.setCors(req,res,'GET, OPTIONS');
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  if(req.method!=='GET')return graph.sendJson(res,405,{ok:false,error:'Use GET.'});
  try{
    let content,filename,type;
    if(graph.param(req,'kind')==='market'){
      const ids=graph.param(req,'ids').split(',').filter(Boolean);
      if(ids.length>1000||ids.some(id=>!/^[a-zA-Z0-9_-]{1,160}$/.test(id)))throw new graph.ApiError(400,'Invalid selected public records.');
      const snapshot=await loadSnapshot({supabaseUrl:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
      content=marketCsv(snapshot,ids);filename='physical-ai-activities.csv';type='text/csv';
    }else if(graph.param(req,'kind')==='dossier'){
      const id=graph.requiredEntityId(graph.param(req,'id'));
      const hops=graph.parseHops(graph.param(req,'hops'));
      const asOf=graph.parseAsOf(graph.param(req,'asOf'));
      const snapshot=await snapshots.load(graph.getConfig(),graph.param(req,'version')||undefined);
      const publicGraph=await snapshots.snapshotGraph(snapshot);
      content=require('./atlas-export-model.cjs').renderPublicDossier(publicGraph,id,hops,asOf);
      filename=id.toLowerCase()+'-investigation.md';type='text/markdown';
    }else throw new graph.ApiError(400,'Unknown public export kind.');
    res.statusCode=200;res.setHeader('Content-Type',type+'; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');return res.end(content);
  }catch(error){return graph.sendError(res,error);}
}
module.exports={handler,marketCsv};
