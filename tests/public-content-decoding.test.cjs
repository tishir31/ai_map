'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {decodePublicBody}=require('../lib/public-web');
test('issuer gzip/br/deflate and mislabeled gzip yield exact UTF-8 source evidence',()=>{
 const text='<main>2026.10.19 WHILL 資金調達。Robotic financing.</main>',bytes=Buffer.from(text);
 for(const [encoding,body]of [['identity',bytes],['gzip',zlib.gzipSync(bytes)],['',zlib.gzipSync(bytes)],['br',zlib.brotliCompressSync(bytes)],['deflate',zlib.deflateSync(bytes)]])assert.equal(decodePublicBody(body,encoding),text);
});
test('decoding bounds compressed expansion and rejects corrupt/unknown/invalid UTF-8 bodies',()=>{
 assert.throws(()=>decodePublicBody(zlib.gzipSync(Buffer.alloc(1000001,'a'))),'expanded page cap');
 assert.throws(()=>decodePublicBody(Buffer.from([255,255])));
 assert.throws(()=>decodePublicBody(Buffer.from('corrupt'),'gzip'));
 assert.throws(()=>decodePublicBody(Buffer.from('source'),'unknown'));
});
