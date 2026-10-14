'use strict';
const dns = require('node:dns').promises;
const https = require('node:https');
const {parsePublicUrl, isPublicAddress} = require('./public-web');

// Google publishes these article redirect parameters in the public article HTML.
// This request resolves an RSS redirect; it does not bypass a publisher's access controls.
async function batchRequest(body, deadline) {
  const addresses = await Promise.race([dns.lookup('news.google.com', {all: true}), new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('News redirect DNS timed out')),Math.max(1,deadline-Date.now()));timer.unref();})]);
  if (!addresses.length || addresses.some(x => !isPublicAddress(x.address))) throw Error('News redirect DNS is not public');
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.request('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      lookup: (_name, options, callback) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family),
      headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Content-Length': Buffer.byteLength(body), 'Accept-Encoding': 'identity'},
    }, response => {
      if (response.statusCode !== 200) {response.resume(); reject(Error('News redirect unavailable')); return;}
      const chunks = []; let size = 0;
      response.on('data', chunk => {size += chunk.length; if (size > 512000) {response.destroy(); reject(Error('News redirect response too large'));} else chunks.push(chunk);});
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(Error('News redirect deadline reached')), Math.max(1, deadline - Date.now()));
    request.on('close', () => clearTimeout(timer)); request.on('error', reject); request.end(body);
  });
}

async function resolveGoogleSource(page, {post = batchRequest, deadline = Date.now() + 9000} = {}) {
  const source = parsePublicUrl(page.finalUrl);
  if (source.hostname !== 'news.google.com') return source.href;
  const id = source.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{10,500})$/)?.[1];
  const signature = page.text.match(/data-n-a-sg="([A-Za-z0-9_-]{1,200})"/)?.[1];
  const timestamp = page.text.match(/data-n-a-ts="(\d{10})"/)?.[1];
  if (!id || !signature || !timestamp || page.status !== 200) throw Error('Original news source unresolved');
  const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(timestamp), signature]);
  const body = new URLSearchParams({'f.req': JSON.stringify([[['Fbv4je', inner]]])}).toString();
  const response = await post(body, deadline);
  for (const line of response.split('\n')) {
    if (!line.startsWith('[[')) continue;
    let rows; try {rows = JSON.parse(line);} catch {continue;}
    for (const row of rows) {
      if (row[0] !== 'wrb.fr' || row[1] !== 'Fbv4je' || typeof row[2] !== 'string') continue;
      let decoded; try {decoded = JSON.parse(row[2]);} catch {continue;}
      if (decoded[0] !== 'garturlres' || typeof decoded[1] !== 'string') continue;
      const target = parsePublicUrl(decoded[1]);
      if (target.protocol === 'https:' && target.hostname !== 'news.google.com') return target.href;
    }
  }
  throw Error('Original news source unresolved');
}
module.exports = {resolveGoogleSource};
