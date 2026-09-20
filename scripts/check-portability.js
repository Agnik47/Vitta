// The pieces that make Vitta run the same on macOS, Linux and Windows:
//   • the .env parser (a Windows editor's BOM, CRLF line endings, `export`, quotes)
//   • the ZIP writer the Nasiko upload uses instead of a `zip` binary
//   • the deploy script's version logic
// Dependency-free; the ZIP is read back with a reader written here from the ZIP spec, so it does not
// just agree with its own writer.
//
//   node scripts/check-portability.js        (Node 22.18+/24: loads the dashboard .ts file directly)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { createZip, collectFiles, crc32 } = require('../nasiko/zip');
const { compareVersions, bumpCardVersion, parseArgs } = require('../nasiko/deploy');

/** Reads a zip via its central directory, inflating and CRC-checking every entry. */
function readZip(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'end-of-central-directory record present');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(p), 0x02014b50, 'central directory signature');
    const method = buffer.readUInt16LE(p + 10);
    const crc = buffer.readUInt32LE(p + 16);
    const compressed = buffer.readUInt32LE(p + 20);
    const size = buffer.readUInt32LE(p + 24);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf-8', p + 46, p + 46 + nameLen);
    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50, 'local header signature');
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(start, start + compressed);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, size, `${name}: size`);
    assert.equal(crc32(data), crc, `${name}: crc32`);
    files[name] = data;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

(async () => {
  const { parseEnvFile } = await import(pathToFileURL(path.resolve(__dirname, '../dashboard/lib/env-file.ts')).href);
  let passed = 0;
  const check = (name, fn) => {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  };

  // ---- .env ---------------------------------------------------------------------------------------
  check('.env: a UTF-8 BOM does not corrupt the first key', () => {
    assert.deepEqual(parseEnvFile('﻿RAZORPAY_KEY_ID=rzp_test_x\nB=2'), { RAZORPAY_KEY_ID: 'rzp_test_x', B: '2' });
  });
  check('.env: Windows CRLF line endings', () => {
    assert.deepEqual(parseEnvFile('A=1\r\nB=two words\r\n\r\n# c\r\nC=3\r\n'), { A: '1', B: 'two words', C: '3' });
  });
  check('.env: `export`, matching quotes, comments, blank lines, "=" inside a value', () => {
    assert.deepEqual(parseEnvFile('export A="quoted value"\nB=\'single\'\n# comment\n\nC=a=b=c\nD="unbalanced\nE='), {
      A: 'quoted value', B: 'single', C: 'a=b=c', D: '"unbalanced', E: '',
    });
  });

  // ---- zip ----------------------------------------------------------------------------------------
  check('zip: a round trip through an independent reader, including nested paths, UTF-8 names and incompressible data', () => {
    const incompressible = require('node:crypto').randomBytes(4096);
    const entries = [
      { name: 'AgentCard.json', data: Buffer.from('{"name":"x"}') },
      { name: 'dist/cli/gate.js', data: Buffer.from('console.log(1);\n'.repeat(500)) },
      { name: 'dist/données/café.txt', data: Buffer.from('déjà vu') },
      { name: 'random.bin', data: incompressible },
      { name: 'empty.txt', data: Buffer.alloc(0) },
    ];
    const files = readZip(createZip(entries));
    assert.deepEqual(Object.keys(files), entries.map((e) => e.name));
    for (const e of entries) assert.deepEqual(files[e.name], e.data, e.name);
  });
  check('zip: a directory is collected recursively with forward-slash names (also on Windows), in a stable order', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitta-zip-'));
    try {
      fs.mkdirSync(path.join(dir, 'b', 'c'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'z.txt'), 'z');
      fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
      fs.writeFileSync(path.join(dir, 'b', 'c', 'deep.txt'), 'deep');
      const names = collectFiles(dir).map((e) => e.name);
      assert.deepEqual(names, ['a.txt', 'b/c/deep.txt', 'z.txt']);
      assert.ok(names.every((n) => !n.includes('\\')));
      assert.deepEqual(Object.keys(readZip(createZip(collectFiles(dir)))), names);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  check('zip: the file-attribute bits stay unsigned (a signed overflow crashed the first version)', () => {
    assert.doesNotThrow(() => createZip([{ name: 'a', data: Buffer.from('a') }]));
  });

  // ---- deploy.js ----------------------------------------------------------------------------------
  check('deploy: version comparison and the patch bump a redeploy needs', () => {
    assert.equal(compareVersions('0.1.2', '0.1.10'), -1);
    assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
    assert.equal(compareVersions('0.1.1', '0.1.1'), 0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitta-card-'));
    try {
      fs.writeFileSync(path.join(dir, 'AgentCard.json'), JSON.stringify({ name: 'a', version: '0.1.1' }));
      assert.equal(bumpCardVersion(dir, '0.1.2'), '0.1.3', 'Nasiko refuses a version it has seen: go one past it');
      assert.equal(bumpCardVersion(dir, '0.1.2'), '0.1.3', 'already past it: unchanged');
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'AgentCard.json'), 'utf-8')).version, '0.1.3');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  check('deploy: argument parsing', () => {
    assert.deepEqual(parseArgs(['planner', '--upload']), { which: 'planner', mode: 'upload' });
    assert.deepEqual(parseArgs(['--dry-run']), { which: 'all', mode: 'dry' });
    assert.deepEqual(parseArgs([]), { which: 'all', mode: 'cli' });
  });

  console.log(`\n${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
