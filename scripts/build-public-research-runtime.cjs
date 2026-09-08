const path=require('node:path');
const source=path.resolve(process.argv[2]||'../physical-ai-public-site');
require(path.join(source,'node_modules/esbuild')).buildSync({entryPoints:[path.join(source,'src/lib/researchAgents.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.resolve(__dirname,'../lib/research-agents.cjs')});
