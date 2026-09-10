"use strict";
const policy=require('./ecosystem-policy');
// Citation metadata is a bounded, source-specific parser. A byline name alone
// never establishes identity: an adjacent stable author URL/ORCID must resolve.
function citationAuthors(html,source,entities,relationships,observedAt) {
 const decode=value=>String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
 const meta=[];for(const tag of String(html).match(/<meta\b[^>]{0,4000}>/gi)||[]) {
  const attrs={};for(const match of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g))attrs[match[1].toLowerCase()]=decode(match[3]);
  if(attrs.name?.startsWith('citation_')&&attrs.content)meta.push({name:attrs.name,content:attrs.content});
 }
 if(!['publication','institution','personal'].includes(source.kind))return null;
 const title=meta.find(x=>x.name==='citation_title')?.content;const authors=[];
 for(const field of meta) {
  if(field.name==='citation_author')authors.push({name:field.content,identity:null});
  if(['citation_author_orcid','citation_author_url'].includes(field.name)&&authors.length){const author=authors.at(-1);if(author.identity)author.ambiguous=true;author.identity=field.name==='citation_author_orcid'&&!/^https:/.test(field.content)?`https://orcid.org/${field.content}`:field.content;}
 }
 if(!title||!authors.length)return null;
 const paper=policy.resolveIdentity({name:title,url:source.url},entities);
 if(paper.error||paper.entity.kind!=='paper')return {accepted:[],held:[{reason:'publication_metadata_identity_unresolved'}],metadata:meta};
 const accepted=[],held=[];
 for(const [index,author] of authors.entries()) {
  const resolved=policy.resolveIdentity({name:author.name,url:author.identity},entities);
  if(author.ambiguous||resolved.error||resolved.entity?.kind!=='person'){held.push({name:author.name,reason:'author_metadata_requires_stable_identity'});continue;}
  if(relationships.some(x=>x.subjectId===resolved.entity.id&&x.objectId===paper.entity.id&&x.predicate==='authored'))continue;
  const quote=`citation_author=${author.name}; citation_title=${title}`;
  const candidate={type:'relationship',predicate:'authored',eventDate:null,datePrecision:'unknown',locator:`citation_author[${index+1}] with citation_author_orcid/url and citation_title`};
  const item=policy.materialize(candidate,{subject:resolved.entity,object:paper.entity,quote},source,observedAt);
  item.relationship.authorPosition=index+1;item.relationship.isFirstAuthor=index===0;item.relationship.authorResolutionTier=1;item.relationship.authorResolutionMethod='official_source_identifier';
  accepted.push(item);
 }
 return {accepted,held,metadata:meta};
}
module.exports={citationAuthors};
