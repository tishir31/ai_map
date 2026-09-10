"use strict";
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const sourceRoot=path.resolve(process.env.PHYSICAL_AI_SOURCE_ROOT||path.join(__dirname,'../../physical-ai-ecosystem-work'));
const source=fs.readFileSync(path.join(sourceRoot,'src/lib/ecosystemSnapshot.ts'),'utf8');
const prefix=source.slice(source.indexOf('type Json ='),source.indexOf('function safeShardUrl'));
const esbuild=require(path.join(sourceRoot,'node_modules/esbuild'));
const output='// Generated from src/lib/ecosystemSnapshot.ts validation contracts. Do not edit.\n// Source SHA256 '+crypto.createHash('sha256').update(prefix).digest('hex')+'\n'+esbuild.transformSync(prefix,{loader:'ts',format:'cjs',target:'node20'}).code;
const destination=path.resolve(__dirname,'../lib/ecosystem-validator.cjs');
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8')!==output)throw Error('Server ecosystem validator is stale');console.log('Server/browser ecosystem validators match');}else{fs.writeFileSync(destination,output);console.log('Built shared ecosystem validator');}
