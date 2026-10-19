'use strict';

// Published in GlobeNewswire's RSS catalogue, verified 2026-10-19. These
// supplement broad discovery with direct issuer announcements, avoiding an
// aggregator redirect and a frequently inaccessible media page per event.
const PRIMARY_MARKET_FEEDS = [
  ['Financing agreements','https://www.globenewswire.com/RssFeed/subjectcode/17-Financing%20Agreements/feedTitle/GlobeNewswire%20-%20Financing%20Agreements'],
  ['Industrial machinery','https://www.globenewswire.com/RssFeed/industry/2757-Industrial%20Machinery/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Industrial%20Machinery'],
  ['Medical equipment','https://www.globenewswire.com/RssFeed/industry/4535-Medical%20Equipment/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Medical%20Equipment'],
  ['Mergers and acquisitions','https://www.globenewswire.com/RssFeed/subjectcode/27-Mergers%20and%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20and%20Acquisitions'],
].map(([name,url])=>({name:`Primary issuer announcements: ${name}`,query:`feed:${url}`}));

const physical=/\b(?:robots?|robotic|robotics|humanoids?|autonom\w*|physical AI|embodied AI|simulation|lidar|sensors?|drones?|unmanned|manufacturing|industrial automation|surgical|radiosurgery)\b/i;
const transaction=/\b(?:funding|financing|raised|raises?|secure[sd]|series [a-z]|seed|acqui\w*|merger|invest\w*)\b/i;

function isPrimaryMarketItem(item) {
  const text=`${item.title||''} ${item.summary||''}`;
  return physical.test(text)&&transaction.test(text)&&!(/\b(?:market research|market size|forecast|CAGR|class action|investor alert|shareholder investigation)\b/i.test(item.title||''));
}
function primaryFeedUrl(query) {
  if(!String(query).startsWith('feed:'))return null;
  const url=String(query).slice(5);
  if(!PRIMARY_MARKET_FEEDS.some(source=>source.query===query))throw Error('Unregistered primary feed');
  return url;
}
module.exports={PRIMARY_MARKET_FEEDS,isPrimaryMarketItem,primaryFeedUrl};
