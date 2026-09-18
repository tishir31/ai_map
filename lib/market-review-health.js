"use strict";
function summarizeReviewRun(row) {
  if(!row)return null;
  return {runDate:row.run_date,status:row.status,selected:Number(row.selected||0),reviewed:Number(row.reviewed||0),published:Number(row.published||0),held:Number(row.held||0),duplicates:Number(row.duplicates||0),nonqualifying:Number(row.nonqualifying||0),errors:Number(row.errors||0),notReviewed:Number(row.selected||0)-Number(row.reviewed||0),startedAt:row.started_at,lastReviewAt:row.last_review_at||null,completedAt:row.completed_at||null,collectorWindowStatus:row.collector_window_status||'unknown'};
}
function reviewHealth(read,now=new Date(),scheduler={ok:false}) {
  const configured=scheduler.ok && scheduler.data?.configured===true;
  const slots=[[15,10],[15,40],[16,10],[16,40]].map(([hour,minute])=>{const date=new Date(now);date.setUTCHours(hour,minute,0,0);return date;});
  const next=slots.find(date=>date>now)||(()=>{const date=slots[0];date.setUTCDate(date.getUTCDate()+1);return date;})();
  const latestRun=read.ok?summarizeReviewRun(read.data?.[0]):null,today=now.toISOString().slice(0,10),grace=new Date(now);grace.setUTCHours(15,20,0,0);
  const overdue=Boolean(configured && read.ok && (latestRun?.status==='running' && latestRun.runDate<today || now>=grace && latestRun?.runDate!==today));
  return {configured,overdue,latestRun,nextExpectedReview:configured?next.toISOString():null,coverageScope:'recent-public-subset',publicationScope:'known-company official-source financing only',...(!read.ok?{warning:'review-telemetry-unavailable'}:!scheduler.ok?{warning:'review-scheduler-status-unavailable'}:{})};
}
module.exports={summarizeReviewRun,reviewHealth};
