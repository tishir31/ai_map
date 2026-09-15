const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(`${root}/release-manifest.json`, 'utf8'));
function filesUnder(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(file);
    assert.ok(entry.isFile(), `Unexpected non-file release entry: ${file}`);
    return [file];
  });
}
assert.deepEqual(Object.keys(manifest.sha256).filter((file) => file.startsWith('physical-ai/')).sort(), filesUnder('physical-ai').sort(), 'Manifest must cover every current application file');
for (const [file, digest] of Object.entries(manifest.sha256)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(`${root}/${file}`)).digest('hex'), digest, file);
const html = fs.readFileSync(`${root}/physical-ai/index.html`,'utf8');
assert.match(html, /assets\/index-[^" ]+\.js/);
assert.match(fs.readFileSync(`${root}/physical-ai/how-it-works.html`,'utf8'), /Every research and workspace view is available without sign-in/);
assert.ok(manifest.publicRoutes.length >= 11);
console.log(`Verified release from ${manifest.sourceCommit}, ${Object.keys(manifest.sha256).length} hashes, ${manifest.publicRoutes.length} public routes`);
