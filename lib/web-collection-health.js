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
function nextCollectionRun(latestRun,now){const next=new Date(now);next.setUTCHours(13,15,0,0);const today=now.toISOString().slice(0,10);if(next<=now||latestRun?.runDate===today)next.setUTCDate(next.getUTCDate()+1);return next.toISOString();}
function webHealth(read,scheduler,legacy,now=new Date(),legacyCheckpoint={ok:false},failureRead={ok:false}){
 const configured=scheduler.ok && scheduler.data?.configured===true;
 const newest=read.ok?read.data?.[0]:null;
 const legacyNewer=legacy && (!newest || legacy.startedAt>String(newest.started_at));
 const historicalUnrecoverable=Boolean(legacyNewer && legacyCheckpoint.ok && !legacyCheckpoint.data?.length);
 const latestRun=legacyNewer?{runDate:String(legacy.startedAt).slice(0,10),status:legacy.status,plannedQueries:null,completedQueries:null,selected:legacy.requestedItems??null,processed:legacy.processedItems??null,staged:legacy.candidatesFound??null,duplicates:null,rejected:null,errors:null,remaining:null,stopReason:historicalUnrecoverable?'historical-checkpoint-missing':legacy.stopReason,lastProgressAt:legacy.completedAt||null,completedAt:legacy.status==='completed'?legacy.completedAt:null,historicalUnrecoverable}:summarizeWebRun(newest);
 const day=now.toISOString().slice(0,10),withinWindow=now>=new Date(day+'T13:25:00Z') && now<new Date(day+'T17:00:00Z');
 const overdue=Boolean(configured && read.ok && withinWindow && (!latestRun || latestRun.runDate!==day));
 const failures=failureHealth(failureRead),nextExpectedRun=configured?nextCollectionRun(latestRun,now):null;
 const recoveryState=latestRun?.status==='running'?'continuing-frozen-run':latestRun?.status==='partial'?'awaiting-next-daily-run':latestRun?.status==='completed'?'scheduled':latestRun?'unknown':'not-observed';
 return {configured,overdue,historicalUnrecoverable,latestRun,failures,nextExpectedRun,recoveryState,cadence:'daily launch at 13:15 UTC; bounded retry probes through 14:45 UTC; two-minute continuation for frozen work',sourceScope:'8 configured Google News RSS queries; up to 4 items per query; public-source candidates only',...(!read.ok?{warning:'collection-telemetry-unavailable'}:!scheduler.ok?{warning:'collection-scheduler-status-unavailable'}:{})};
}
const backlogKeys=['pending','eventOlder7d','queueAged7d','publicPending','privatePending','unknownSourcePending','recentPublicPending','oldPublicPending','unknownDatePublic','recentPrivatePending','oldPrivatePending','unknownDatePrivate','missingCanonical','unresolvedAggregator','withCautions','linkedExisting','dailyReviewSelectable'];
function backlogHealth(read,now=new Date()){return {complete:read.ok && typeof read.data?.pending==='number',asOf:read.ok?read.data?.asOf||now.toISOString():now.toISOString(),...Object.fromEntries(backlogKeys.map(key=>[key,read.ok?read.data?.[key]??null:null])),policy:'source buckets partition pending; reason counts overlap; no candidate status changed'};}
module.exports={summarizeWebRun,failureHealth,webHealth,backlogHealth};
