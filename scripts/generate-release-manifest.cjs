const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function filesUnder(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(file);
    assert.ok(entry.isFile(), `Unexpected non-file release entry: ${file}`);
    return [file];
  });
}

// Run intentionally after building, with explicit source and backend provenance.
// CI verifies this manifest; it must never regenerate it to make a check pass.
const sourceCommit = process.env.RELEASE_SOURCE_COMMIT;
const backendBaseCommit = process.env.RELEASE_BACKEND_COMMIT;
assert.match(sourceCommit || '', /^[a-f0-9]{40}$/, 'RELEASE_SOURCE_COMMIT must be an explicit commit SHA');
assert.match(backendBaseCommit || '', /^[a-f0-9]{40}$/, 'RELEASE_BACKEND_COMMIT must be an explicit commit SHA');
const builtAt = new Date(process.env.RELEASE_BUILT_AT || Date.now()).toISOString();
const backendFiles = ['api', 'lib'].flatMap(filesUnder).filter(file => /\.(?:js|cjs)$/.test(file));
const files = [...new Set([...Object.keys(manifest.sha256).filter((file) => !file.startsWith('physical-ai/')), ...backendFiles, ...filesUnder('physical-ai')])].sort();
const sha256 = {};
for (const file of files) {
  sha256[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}
const output = { ...manifest, release: `physical-ai-ecosystem-${builtAt.slice(0, 10)}`, sourceCommit, backendBaseCommit, builtAt, sha256 };
fs.writeFileSync(manifestPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${Object.keys(sha256).length} release hashes for ${output.sourceCommit}`);
