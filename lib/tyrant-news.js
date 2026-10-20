'use strict';
const graph=require('./graph-api');
const publicWeb=require('./public-web');
const {authorizeScopedSchedulerRequest}=require('./scheduler-auth');
const PUBLIC_NEWS_URL=/^https:\/\/(?:prtimes\.jp\/main\/html\/rd\/p\/[A-Za-z0-9._-]+\.html|www\.tesollo\.com\/news\/press\/[a-z0-9-]+|www\.semafor\.com\/article\/\d{2}\/\d{2}\/\d{4}\/[a-z0-9-]+|www\.tectonicdefense\.com\/[a-z0-9-]+\/?|www\.globenewswire\.com\/news-release\/[\d/]+[A-Za-z0-9/_-]+\.html|origin\.tech\/blog\/[a-z0-9-]+|www\.fugro\.com\/news\/press-releases\/\d{4}\/[a-z0-9-]+)$/;
function validateNewsUrl(value){
 if(typeof value!=='string'||value.length>1500||/[\s?#@]/.test(value)||!PUBLIC_NEWS_URL.test(value))throw new Error('Unsupported public news URL.');
 return publicWeb.parsePublicUrl(value);
}
function sourceHeadline(html){
 const metas=String(html).match(/<meta\b[^>]*>/gi)||[];
 let raw='';
 for(const meta of metas){
  const attrs={};for(const m of meta.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g))attrs[m[1].toLowerCase()]=m[3];
  if((attrs.property||attrs.name||'').toLowerCase()==='og:title'){raw=attrs.content||'';break;}
 }
 raw ||= String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
 const title=raw.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):'';})
  .replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,name)=>entities[name]).replace(/\s+/g,' ').trim();
 if(title.length<8||/[<>\x00-\x1f]|[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i.test(title)||/^(?:access denied|forbidden|just a moment|sign in|log in|please wait|error\b)/i.test(title))return null;
 const words=title.split(/\s+/),short=words.length>24?words.slice(0,24).join(' ')+'…':title;
 return short.length>200?short.slice(0,199)+'…':short;
}
function publicNews(rows){
 return (rows||[]).filter(row=>{
  try{validateNewsUrl(row.source_url);return !row.withdrawn_at&&Number.isFinite(Date.parse(row.shared_at));}catch{return false;}
 }).map(row=>({id:row.id,sourceUrl:row.source_url,sharedAt:row.shared_at,headline:row.headline_status==='source_headline'?sourceHeadline('<title>'+row.source_title+'</title>'):null,
  attribution:'Tyrant',verification:'source_link',financialTotalsEligible:false}));
}
const rpc=(config,name,body)=>graph.restRequest(config,name,{method:'POST',rpc:true,body});
async function enrichNews(config,id,{call=rpc,read=publicWeb.readPublicPage}={}){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||''))throw new graph.ApiError(400,'Invalid news key.');
 const item=await call(config,'claim_tyrant_news_headline',{p_id:id});if(!item)return {status:'unchanged'};
 let title=null,result='source_unavailable';
 try{
  validateNewsUrl(item.sourceUrl);
  const page=await read(item.sourceUrl,0,Date.now()+9000,{validateUrl:validateNewsUrl});
  validateNewsUrl(page.finalUrl);
  if(page.status===200){title=sourceHeadline(page.text);result=title?'source_headline':'headline_unavailable';}
 }catch{/* The already published URL remains attributed and explicitly unverified. */}
 const applied=await call(config,'finish_tyrant_news_headline',{p_id:id,p_lease:item.leaseId,p_title:title,p_result:result});
 return {status:applied?result:'lease_expired'};
}
async function handler(req,res){
 graph.setCors(req,res,'GET, OPTIONS');if(req.method==='OPTIONS')return graph.sendJson(res,204,null);
 if(req.method!=='GET')return graph.sendJson(res,405,{ok:false,error:'Use GET.'});
 try{
  const config=graph.getConfig();
  const rows=await graph.restRequest(config,'tyrant_news_links',{params:{select:'id,source_url,shared_at,source_title,headline_status,withdrawn_at',withdrawn_at:'is.null',order:'shared_at.desc',limit:200}});
  return graph.sendJson(res,200,{ok:true,news:publicNews(rows),scope:'attributed-public-news-links'});
 }catch{return graph.sendJson(res,503,{ok:false,error:'Tyrant news handoff is not activated.'});}
}
async function enrichmentHandler(req,res){
 if(req.method!=='GET')return graph.sendJson(res,405,{ok:false,error:'Use GET.'});
 try{
  const auth=await authorizeScopedSchedulerRequest(req,'tyrant-news-enrich',process.env,[String(process.env.CRON_SECRET||'').trim()]);
  if(!auth.ok)throw new graph.ApiError(auth.status,auth.error);
  return graph.sendJson(res,200,{ok:true,...await enrichNews(graph.getConfig(),graph.param(req,'id'))});
 }catch(error){return graph.sendError(res,error);}
}
module.exports={handler,enrichmentHandler,enrichNews,sourceHeadline,publicNews,validateNewsUrl};
