const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { isPublicAddress, parsePublicUrl } = require('../lib/public-web');
const savedFetch = global.fetch;
afterEach(() => { global.fetch = savedFetch; });
function handler(file, fetcher) {
  const filename = path.resolve(__dirname, '../api', file);
  const code = fs.readFileSync(filename,'utf8').replace('export default async function handler','module.exports = async function handler');
  const context = { module: { exports: {} }, require: createRequire(filename), fetch: fetcher, process: { env: { SUPABASE_URL: 'https://db.example.org', SUPABASE_SERVICE_ROLE_KEY: 'test', GEMINI_API_KEY: 'test' } }, URL, AbortSignal, Buffer, console, setTimeout, clearTimeout };
  vm.runInNewContext(code, context, { filename }); return context.module.exports;
}
function response() { return { statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; }, end(v) { this.body=v ? JSON.parse(v) : null; return this; } }; }
test('rejects loopback, link-local, private IPv4/IPv6, credentials, and non-web ports', () => {
  for (const ip of ['127.0.0.1','169.254.169.254','10.1.1.1','100.64.0.1','192.168.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1']) assert.equal(isPublicAddress(ip), false, ip);
  for (const url of ['http://127.1','http://2130706433','http://[::1]/','https://user:pass@example.org','http://example.org:3000','file:///etc/passwd','http://metadata.internal']) assert.throws(() => parsePublicUrl(url), url);
  assert.equal(parsePublicUrl('https://www.nasa.gov/news/').hostname, 'www.nasa.gov');
  assert.equal(isPublicAddress('8.8.8.8'), true);
});
test('AI availability check consumes no generation or quota request', async () => {
  let calls=0; const fn=handler('gemini.js',async()=>{ calls++; throw Error('unexpected request'); }); const res=response();
  await fn({method:'GET',headers:{}},res); assert.equal(res.statusCode,200); assert.equal(res.body.available,true); assert.equal(calls,0);
});
test('public research snapshots filter out preexisting private runs', async () => {
  const urls=[]; const fn=handler('research-company.js',async(url)=>{urls.push(String(url));return {ok:true,json:async()=>[]};}); const res=response();
  await fn({method:'GET',query:{action:'snapshot',runId:'legacy-private'},url:'/api/research-company?action=snapshot',headers:{host:'atlas.example.org'}},res);
  assert.equal(res.statusCode,200); assert.equal(res.body.snapshot,null); assert.equal(new URL(urls[0]).searchParams.get('public_mode'),'eq.true');
});
test('all legacy inline JavaScript still parses after rendering and navigation fixes', () => {
  const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
  const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean);
  for (const block of blocks) new vm.Script(block);
  assert.match(html,/All public tools/); assert.match(html,/escapeHTML\(result\)/); assert.doesNotMatch(html,/prompt: 'test'/);
});
