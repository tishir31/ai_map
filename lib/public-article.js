'use strict';
const {stripHtml} = require('./ecosystem-worker');

// Discovery gets a small capture budget. Select the article before truncating
// so publisher menus cannot displace the announcement or become its issuer.
// The publication verifier still captures and checks its own source evidence.
function articleText(raw) {
  const html = String(raw || '').replace(/<(script|style|nav|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i)?.[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1];
  return stripHtml(article || main || html.replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, ' '));
}
module.exports = {articleText};
