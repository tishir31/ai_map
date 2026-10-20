'use strict';
const graph=require('./graph-api');
const {parsePublicUrl}=require('./public-web');
function publicReport(row){
 try{
  const source=parsePublicUrl(row.source_url);
  if(source.protocol!=='https:'||source.search||source.hash||row.financial_totals_eligible!==false||row.withdrawn_at||typeof row.headline!=='string'||/[<>@]/.test(row.headline)||row.headline.length<8||row.headline.length>500)return null;
  return {id:row.id,headline:row.headline,sourceUrl:source.href,publisher:String(row.source_label||'Public RSS').replace(/[<>@]/g,'').slice(0,100),reportedDate:row.reported_date||null,firstSeenAt:row.first_seen_at,verification:'source_report',financialTotalsEligible:false};
 }catch{return null;}
}
async function handler(req,res){
 graph.setCors(req,res,'GET, OPTIONS');
 if(req.method==='OPTIONS')return graph.sendJson(res,204,null);
 if(req.method!=='GET')return graph.sendJson(res,405,{ok:false,error:'Use GET.'});
 try{const rows=await graph.restRequest(graph.getConfig(),'market_source_reports?select=id,headline,source_url,source_label,reported_date,first_seen_at,withdrawn_at,financial_totals_eligible&withdrawn_at=is.null&order=reported_date.desc.nullslast,first_seen_at.desc,id.asc&limit=200');return graph.sendJson(res,200,{ok:true,news:rows.map(publicReport).filter(Boolean)},'no-store');}
 catch{return graph.sendJson(res,503,{ok:false,error:'Public source reports are temporarily unavailable.'},'no-store');}
}
module.exports={publicReport,handler};
