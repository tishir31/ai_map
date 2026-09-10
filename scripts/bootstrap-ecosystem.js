#!/usr/bin/env node
"use strict";
// Validate first; --publish explicitly uploads a version and registers its public sources.
const fs=require("node:fs"); const path=require("node:path"); const crypto=require("node:crypto");
const snapshots=require("../lib/graph-snapshot"); const graph=require("../lib/graph-api"); const policy=require("../lib/ecosystem-policy");
async function main() {
  const args=process.argv.slice(2);const publish=args.includes("--publish");const sqlIndex=args.indexOf("--sql-out");const sqlOut=sqlIndex>=0?args[sqlIndex+1]:null;if(sqlIndex>=0&&!sqlOut)throw Error("--sql-out requires a path");
  const chunkIndex=args.indexOf("--chunk-dir");const chunkDir=chunkIndex>=0?args[chunkIndex+1]:null;if(chunkIndex>=0&&!chunkDir)throw Error("--chunk-dir requires a path");
  const datasetPath=args.find((x,i)=>!x.startsWith("--")&&(sqlIndex<0||i!==sqlIndex+1)&&(chunkIndex<0||i!==chunkIndex+1)) || path.resolve(__dirname,"../physical-ai/ecosystem.v1.json");
  const assetDir=path.resolve(__dirname,"../physical-ai/assets");
  const files=fs.readdirSync(assetDir);
  const coreFile=files.filter(x=>/^knowledgeGraphRuntimeData-.*\.json$/.test(x));
  const researchFile=files.filter(x=>/^knowledgeGraphResearchRuntimeData-.*\.json$/.test(x));
  if(coreFile.length!==1||researchFile.length!==1)throw Error("Expected exactly one release core/research runtime shard");
  const snapshot={core:JSON.parse(fs.readFileSync(path.join(assetDir,coreFile[0]))),research:JSON.parse(fs.readFileSync(path.join(assetDir,researchFile[0]))),discovery:JSON.parse(fs.readFileSync(datasetPath))};
  const prepared=await snapshots.prepare(snapshot,{selectedVersion:snapshot.discovery.version,publishedAt:snapshot.discovery.publishedAt||new Date().toISOString(),coverage:{checked:snapshot.discovery.sources.filter(x=>x.outcome==="checked").length,held:snapshot.discovery.sources.filter(x=>x.outcome==="unresolved").length,failed:snapshot.discovery.sources.filter(x=>["not_found","inaccessible"].includes(x.outcome)).length,remaining:snapshot.discovery.researchOutcomes.filter(x=>x.outcome==="unresolved").length}});
  const full=await snapshots.snapshotGraph(snapshot);
  const verifiedUrls=new Set(full.evidence.filter(x=>["primary","official"].includes(x.tier)).map(x=>policy.canonicalUrl(x.url)));
  const knownIdentifiers=new Set(full.entities.flatMap(policy.stableIdentifiers));
  const sources=snapshot.discovery.sources.map(source=>({id:source.id,url:policy.canonicalUrl(source.url),descriptor:{...source,url:policy.canonicalUrl(source.url),verifiedIdentity:source.outcome==="checked" && (verifiedUrls.has(policy.canonicalUrl(source.url)) || knownIdentifiers.has(policy.canonicalUrl(source.url)))},last_checked_at:source.checkedAt,content_hash:source.contentHash||null,last_outcome:source.outcome}));
  const identities=full.entities.flatMap(entity=>policy.stableIdentifiers(entity).map(identifier=>({identifier,entity_id:entity.id,kind:entity.kind,canonical_name:entity.canonicalName})));
  const groups=new Map();for(const row of identities){if(!groups.has(row.identifier))groups.set(row.identifier,[]);groups.get(row.identifier).push(row);}
  const unique=[...groups.values()].filter(rows=>new Set(rows.map(x=>x.entity_id)).size===1).map(rows=>rows[0]);
  if(chunkDir) {
    const dir=path.resolve(chunkDir);if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw Error("--chunk-dir must be empty so files from a previous upload cannot be mixed");fs.mkdirSync(dir,{recursive:true});
    const envelope=Buffer.from(JSON.stringify({manifest:prepared.manifest,shards:prepared.shards,sources,identifiers:unique}));
    const id=crypto.randomUUID(),sha256=crypto.createHash("sha256").update(envelope).digest("hex"),chunkCount=Math.ceil(envelope.length/48000);
    const begin=`select public.begin_ecosystem_bootstrap('${id}','${sha256}',${envelope.length},${chunkCount},(select version from public.ecosystem_snapshot_releases where active));\n`;
    fs.writeFileSync(path.join(dir,"000-begin.sql"),begin);
    for(let i=0;i<chunkCount;i++)fs.writeFileSync(path.join(dir,`${String(i+1).padStart(3,"0")}-chunk.sql`),`select public.put_ecosystem_bootstrap_chunk('${id}',${i},'${envelope.subarray(i*48000,(i+1)*48000).toString("base64")}');\n`);
    fs.writeFileSync(path.join(dir,`${String(chunkCount+1).padStart(3,"0")}-finish.sql`),`select public.finish_ecosystem_bootstrap('${id}');\n`);
    fs.writeFileSync(path.join(dir,"payload.json"),envelope);
    const report={validated:true,uploadId:id,version:prepared.manifest.version,sha256,bytes:envelope.length,chunks:chunkCount,directory:dir,shards:prepared.shards.map(x=>({name:x.name,bytes:Buffer.byteLength(x.payload),sha256:x.sha256})),registeredSources:sources.length,authorityResolved:sources.filter(x=>x.descriptor.verifiedIdentity).length};
    fs.writeFileSync(path.join(dir,"upload-manifest.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
  }
  if(sqlOut) {
    const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
    const sql=`begin;
set local standard_conforming_strings=on;
insert into public.ecosystem_sources select * from jsonb_populate_recordset(null::public.ecosystem_sources,${literal(sources.map(x=>({...x,active:true})))}) on conflict(url) do nothing;
insert into public.ecosystem_entity_identifiers select * from jsonb_populate_recordset(null::public.ecosystem_entity_identifiers,${literal(unique)}) on conflict(identifier) do nothing;
select public.publish_ecosystem_snapshot(${literal(prepared.manifest)},${literal(prepared.shards)},null,(select version from public.ecosystem_snapshot_releases where active),true,null);
commit;
`;
    fs.writeFileSync(path.resolve(sqlOut),sql);console.log(JSON.stringify({validated:true,version:prepared.manifest.version,sqlFile:path.resolve(sqlOut),bytes:Buffer.byteLength(sql),registeredSources:sources.length,authorityResolved:sources.filter(x=>x.descriptor.verifiedIdentity).length}));return;
  }
  if(!publish){console.log(JSON.stringify({validated:true,version:prepared.manifest.version,shards:prepared.shards.map(x=>({name:x.name,bytes:Buffer.byteLength(x.payload),sha256:x.sha256})),registeredSources:sources.length,authorityResolved:sources.filter(x=>x.descriptor.verifiedIdentity).length},null,2));return;}
  const config=graph.getConfig();let current=null;
  try{current=await snapshots.manifest(config);}catch(error){if(error.status!==503)throw error;}
  await graph.restRequest(config,"ecosystem_sources",{method:"POST",body:sources,prefer:"resolution=ignore-duplicates,return=minimal"});
  for(let i=0;i<unique.length;i+=300)await graph.restRequest(config,"ecosystem_entity_identifiers",{method:"POST",body:unique.slice(i,i+300),prefer:"resolution=ignore-duplicates,return=minimal"});
  await snapshots.publish(config,prepared,{expectedVersion:current?.version||null,activate:true});
  console.log(JSON.stringify({published:true,version:prepared.manifest.version,registeredSources:sources.length,registeredIdentifiers:unique.length,mode:"Existing settings retained; migration defaults to shadow."},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
