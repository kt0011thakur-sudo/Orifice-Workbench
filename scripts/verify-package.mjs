// Detect accidental modification of the delivered source, catalogs and workbook.
// This local hash manifest is not a digital signature or engineering approval.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'docs/part6/release-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid release manifest.');
  const failures = [];
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(entry.path)
      || path.isAbsolute(entry.path) || entry.path.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('Invalid file entry in release manifest.');
    }
    try {
      const actual = createHash('sha256').update(await readFile(path.join(root, entry.path))).digest('hex');
      if (actual !== entry.sha256) failures.push(`${entry.path}: changed`);
    } catch { failures.push(`${entry.path}: missing or unreadable`); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`PASS: ${manifest.files.length} delivered files match the Part 6 manifest. Engine ${manifest.engineVersion}.\nThis verifies file identity, not engineering approval. Generated evidence and saved projects are excluded.`);
} catch (error) { console.error(`Package verification failed: ${error.message}`); process.exitCode = 1; }
