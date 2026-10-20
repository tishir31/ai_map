'use strict';
const keys={runDate:'run_date',status:'status',plannedQueries:'planned_queries',completedQueries:'completed_queries',selected:'selected',processed:'processed',staged:'staged',duplicates:'duplicates',rejected:'rejected',errors:'errors',remaining:'remaining',stopReason:'stop_reason',lastProgressAt:'last_progress_at',completedAt:'completed_at'};
const safeReasons=new Set(['provider-rate-limit','provider-timeout','provider-response','source-rate-limit','source-timeout','source-response','source-http-error','unsafe-source','storage-error','source-error','lease-attempts-exhausted']);
function summarizeWebRun(row){return row?{...Object.fromEntries(Object.entries(keys).map(([out,key])=>[out,row[key]??null])),historicalUnrecoverable:Boolean(row.legacy)}:null;}
function failureHealth(read){
 if(!read.ok)return{complete:false,terminalErrors:null,byReason:{},warning:'collection-failure-detail-unavailable'};
 const byReason={};let terminalErrors=0;
 for(const row of read.data||[]){if(row.status!=='error')continue;terminalErrors+=1;const reason=safeReasons.has(row.reason)?row.reason:'other';byReason[reason]=(byReason[reason]||0)+1;}
 return{complete:true,terminalErrors,byReason};
}
function nextCollectionRun(latestRun,now){const next=new Date(now);next.setUTCMinutes(15,0,0);if(next<=now)next.setUTCHours(next.getUTCHours()+1);return next.toISOString();}
function webHealth(read,scheduler,legacy,now=new Date(),legacyCheckpoint={ok:false},failureRead={ok:false}){
 const configured=scheduler.ok && scheduler.data?.configured===true;
 const newest=read.ok?read.data?.[0]:null;
 const legacyNewer=legacy && (!newest || legacy.startedAt>String(newest.started_at));
 const historicalUnrecoverable=Boolean(legacyNewer && legacyCheckpoint.ok && !legacyCheckpoint.data?.length);
 const latestRun=legacyNewer?{runDate:String(legacy.startedAt).slice(0,10),status:legacy.status,plannedQueries:null,completedQueries:null,selected:legacy.requestedItems??null,processed:legacy.processedItems??null,staged:legacy.candidatesFound??null,duplicates:null,rejected:null,errors:null,remaining:null,stopReason:historicalUnrecoverable?'historical-checkpoint-missing':legacy.stopReason,lastProgressAt:legacy.completedAt||null,completedAt:legacy.status==='completed'?legacy.completedAt:null,historicalUnrecoverable}:summarizeWebRun(newest);
 const day=now.toISOString().slice(0,10),withinWindow=now.getUTCMinutes()>=30;
 const overdue=Boolean(configured && read.ok && withinWindow && (!latestRun || latestRun.runDate!==day || now-new Date(latestRun.lastProgressAt||newest?.started_at||legacy?.startedAt||0)>2*3600000));
 const failures=failureHealth(failureRead),nextExpectedRun=configured?nextCollectionRun(latestRun,now):null;
 const recoveryState=latestRun?.status==='running'?'continuing-frozen-run':latestRun?.status==='partial'?'awaiting-next-daily-run':latestRun?.status==='completed'?'scheduled':latestRun?'unknown':'not-observed';
 return {configured,overdue,historicalUnrecoverable,latestRun,failures,nextExpectedRun,recoveryState,cadence:'hourly at minute 15 UTC; retry probes at minutes 20 and 25; two-minute continuation for frozen work',sourceScope:'one of eight rotating public transaction queries per hour; up to four items per query; at most 96 new selections per full day, plus preserved pre-release selections',...(!read.ok?{warning:'collection-telemetry-unavailable'}:!scheduler.ok?{warning:'collection-scheduler-status-unavailable'}:{})};
}
const backlogKeys=['pending','eventOlder7d','queueAged7d','publicPending','privatePending','unknownSourcePending','recentPublicPending','oldPublicPending','unknownDatePublic','recentPrivatePending','oldPrivatePending','unknownDatePrivate','missingCanonical','unresolvedAggregator','withCautions','linkedExisting','dailyReviewSelectable'];
function backlogHealth(read,now=new Date()){return {complete:read.ok && typeof read.data?.pending==='number',asOf:read.ok?read.data?.asOf||now.toISOString():now.toISOString(),...Object.fromEntries(backlogKeys.map(key=>[key,read.ok?read.data?.[key]??null:null])),policy:'source buckets partition pending; reason counts overlap; no candidate status changed'};}
module.exports={nextCollectionRun,summarizeWebRun,failureHealth,webHealth,backlogHealth};
