"use strict";
const {parsePublicUrl}=require('./public-web');
const normalize=value=>String(value||'').normalize('NFC').replace(/\s+/g,' ').trim();
function decode(value) {return String(value).replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[a-f0-9]+);/gi,entity=>{const named={'&quot;':'"','&apos;':"'",'&amp;':'&','&lt;':'<','&gt;':'>'};if(named[entity.toLowerCase()])return named[entity.toLowerCase()];const n=parseInt(entity.slice(entity[2]?.toLowerCase()==='x'?3:2,-1),entity[2]?.toLowerCase()==='x'?16:10);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):entity;});}
function attributes(tag) {const result={};for(const match of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs))result[match[1].toLowerCase()]=decode(match[3]);return result;}
// A public directory record establishes registry identity only. It cannot
// establish founder, mentor, employment, funding, or deployment relationships.
function ycCompanyIdentity(html,sourceUrl,finalUrl) {
 try {
  const url=parsePublicUrl(sourceUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.ycombinator.com'||url.search||url.hash||!/^\/companies\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(url.pathname))return null;
  const canonical=url.href.replace(/\/$/,'');
  if(!finalUrl||parsePublicUrl(finalUrl).href.replace(/\/$/,'')!==canonical)return null;
  const tag=String(html).match(/<[^>]+\bdata-page\s*=\s*(["'])(.*?)\1[^>]*>/s)?.[0];if(!tag)return null;
  const page=JSON.parse(attributes(tag)['data-page']);const company=page.props?.company;
  if(page.component!=='ycdc_new/pages/Companies/ShowPage'||page.props.signedIn!==false||page.props.currentUser!==null||!Number.isSafeInteger(company?.id)||company.id<=0||typeof company.name!=='string'||normalize(company.name).length<2||normalize(company.name).length>200||typeof company.one_liner!=='string')return null;
  if(company.ycdc_url!==canonical||`https://www.ycombinator.com/companies/${company.slug}`!==canonical)return null;
  const canonicalTags=(String(html).match(/<link\b[^>]*>/gi)||[]).map(attributes).filter(x=>x.rel==='canonical');
  const metadata=(String(html).match(/<meta\b[^>]*>/gi)||[]).map(attributes);
  if(canonicalTags.length!==1||canonicalTags[0].href!==canonical||metadata.find(x=>x.property==='og:url')?.content!==canonical)return null;
  const expectedTitle=normalize(`${company.name}: ${company.one_liner} | Y Combinator`);
  if(normalize(decode(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]))!==expectedTitle||normalize(metadata.find(x=>x.property==='og:title')?.content)!==expectedTitle)return null;
  return {name:normalize(company.name),url:canonical,registryId:String(company.id),applicationText:[company.one_liner,company.long_description].filter(x=>typeof x==='string').map(normalize).join('\n')};
 } catch {return null;}
}
module.exports={ycCompanyIdentity,normalize};
