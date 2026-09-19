'use strict';
const keys={runDate:'run_date',status:'status',plannedQueries:'planned_queries',completedQueries:'completed_queries',selected:'selected',processed:'processed',staged:'staged',duplicates:'duplicates',rejected:'rejected',errors:'errors',remaining:'remaining',stopReason:'stop_reason',lastProgressAt:'last_progress_at',completedAt:'completed_at'};
function summarizeWebRun(row){return row?{...Object.fromEntries(Object.entries(keys).map(([out,key])=>[out,row[key]??null])),historicalUnrecoverable:Boolean(row.legacy)}:null;}
function webHealth(read,scheduler,legacy,now=new Date(),legacyCheckpoint={ok:false}){
 const configured=scheduler.ok && scheduler.data?.configured===true;
 const newest=read.ok?read.data?.[0]:null;
 const legacyNewer=legacy && (!newest || legacy.startedAt>String(newest.started_at));
 const historicalUnrecoverable=Boolean(legacyNewer && legacyCheckpoint.ok && !legacyCheckpoint.data?.length);
 const latestRun=legacyNewer?{runDate:String(legacy.startedAt).slice(0,10),status:legacy.status,plannedQueries:null,completedQueries:null,selected:legacy.requestedItems??null,processed:legacy.processedItems??null,staged:legacy.candidatesFound??null,duplicates:null,rejected:null,errors:null,remaining:null,stopReason:historicalUnrecoverable?'historical-checkpoint-missing':legacy.stopReason,lastProgressAt:legacy.completedAt||null,completedAt:legacy.status==='completed'?legacy.completedAt:null,historicalUnrecoverable}:summarizeWebRun(newest);
 const day=now.toISOString().slice(0,10),withinWindow=now>=new Date(day+'T13:25:00Z') && now<new Date(day+'T17:00:00Z');
 const overdue=Boolean(configured && read.ok && withinWindow && (!latestRun || latestRun.runDate!==day));
 return {configured,overdue,historicalUnrecoverable,latestRun,...(!read.ok?{warning:'collection-telemetry-unavailable'}:!scheduler.ok?{warning:'collection-scheduler-status-unavailable'}:{})};
}
const backlogKeys=['pending','eventOlder7d','queueAged7d','publicPending','privatePending','unknownSourcePending','recentPublicPending','oldPublicPending','unknownDatePublic','recentPrivatePending','oldPrivatePending','unknownDatePrivate','missingCanonical','unresolvedAggregator','withCautions','linkedExisting','dailyReviewSelectable'];
function backlogHealth(read,now=new Date()){return {complete:read.ok && typeof read.data?.pending==='number',asOf:read.ok?read.data?.asOf||now.toISOString():now.toISOString(),...Object.fromEntries(backlogKeys.map(key=>[key,read.ok?read.data?.[key]??null:null])),policy:'source buckets partition pending; reason counts overlap; no candidate status changed'};}
module.exports={summarizeWebRun,webHealth,backlogHealth};
