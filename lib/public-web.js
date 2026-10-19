"use strict";
const dns = require("node:dns").promises;
const http = require("node:http");
const https = require("node:https");
const zlib = require("node:zlib");
const { BlockList, isIP } = require("node:net");
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]]) blockedV4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["::",128],["::1",128],["::ffff:0:0",96],["fc00::",7],["fe80::",10],["ff00::",8],["2001:db8::",32],["2002::",16],["2001::",32]]) blockedV6.addSubnet(address, prefix, "ipv6");

function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family !== 6) return false;
  const prefix = parseInt(address.split(":")[0], 16);
  return prefix >= 0x2000 && prefix <= 0x3fff && !blockedV6.check(address, "ipv6");
}
function parsePublicUrl(raw) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) throw new Error("Use a public HTTP or HTTPS page on its standard port.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname.includes(".") && !isIP(hostname) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(hostname) || isIP(hostname) && !isPublicAddress(hostname)) throw new Error("Only public web addresses can be analyzed.");
  return url;
}

function decodePublicBody(bytes, contentEncoding = "") {
  const encoding = String(contentEncoding).trim().toLowerCase();
  const limit = 1000000;
  if (bytes.length > limit) throw new Error("Source page exceeds 1 MB.");
  // Some issuer sites send gzip even when identity was requested, occasionally
  // without the header. Never pass compressed bytes to evidence/model parsing.
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  let body;
  if (encoding === "gzip" || gzip) body = zlib.gunzipSync(bytes, { maxOutputLength: limit });
  else if (encoding === "deflate") body = zlib.inflateSync(bytes, { maxOutputLength: limit });
  else if (encoding === "br") body = zlib.brotliDecompressSync(bytes, { maxOutputLength: limit });
  else if (!encoding || encoding === "identity") body = bytes;
  else throw new Error("Unsupported source content encoding.");
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

async function readPublicPage(raw, redirects = 0, deadline = Date.now() + 9000, { allowXml = false } = {}) {
  if (redirects > 4 || Date.now() >= deadline) throw new Error("Source redirect or time limit reached.");
  const url = parsePublicUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await Promise.race([dns.lookup(hostname, { all: true }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Source DNS timed out.")), Math.max(1, deadline - Date.now())); timer.unref(); })]);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Only public web addresses can be analyzed.");
  // Pin the validated address for the connection, preserving hostname/TLS.
  const result = await new Promise((resolve, reject) => {
    const selected = addresses[0];
    const request = (url.protocol === "https:" ? https : http).get(url, {
      lookup: (_name, options, callback) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family),
      headers: { "User-Agent": "PhysicalAI-PublicResearch/1.0", "Accept": allowXml ? "application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.7,text/plain;q=0.5" : "text/html,text/plain,application/xhtml+xml", "Accept-Encoding": "identity" },
    }, (response) => {
      const status = response.statusCode || 502;
      if ([301,302,303,307,308].includes(status)) { response.resume(); resolve({ redirect: response.headers.location }); return; }
      if (!(allowXml ? /^(text\/(html|plain|xml)|application\/(xhtml\+xml|rss\+xml|atom\+xml|xml))/i : /^(text\/(html|plain)|application\/xhtml\+xml)/i).test(response.headers["content-type"] || "")) { response.destroy(); reject(new Error("The URL must point to a readable HTML or text page.")); return; }
      const chunks = []; let bytes = 0;
      response.on("data", (chunk) => { bytes += chunk.length; if (bytes > 1000000) { response.destroy(); reject(new Error("Source page exceeds 1 MB. Paste the relevant excerpt instead.")); } else chunks.push(chunk); });
      response.on("end", () => {
        try { resolve({ status, text: decodePublicBody(Buffer.concat(chunks), response.headers["content-encoding"]), finalUrl: url.href }); }
        catch { reject(new Error("Source content decoding failed or exceeds 1 MB.")); }
      });
      response.on("error", reject);
    });
    request.setTimeout(Math.max(1, deadline - Date.now()), () => request.destroy(new Error("Source read timed out.")));
    const timer = setTimeout(() => request.destroy(new Error("Source deadline reached.")), Math.max(1, deadline - Date.now()));
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
  });
  if (Object.hasOwn(result, "redirect")) { if (!result.redirect) throw new Error("Source redirect is missing a destination."); return readPublicPage(new URL(result.redirect, url).href, redirects + 1, deadline, { allowXml }); }
  return result;
}
module.exports = { parsePublicUrl, isPublicAddress, readPublicPage, decodePublicBody };
