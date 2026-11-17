// Dependency-free entry point. Check the runtime before importing TypeScript.
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'Usage: node scripts/start.mjs [--check]\n--check verifies runtime, files and writable project storage without starting a server.';

export function checkRuntime(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  if (major !== 24 || !Number.isInteger(minor) || minor < 12) {
    throw new Error(`Node ${version} is outside this package's supported range. Install Node 24 LTS, version 24.12 or newer within major 24, from https://nodejs.org/en/download.`);
  }
}

export async function start(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error(usage);
  checkRuntime(process.versions.node);
  const rawPort = process.env.PORT ?? '3000';
  if (!/^\d+$/.test(rawPort)) throw new Error('PORT must be a whole number between 1 and 65535.');
  const port = Number(rawPort);
  if (port < 1 || port > 65535) throw new Error('PORT must be a whole number between 1 and 65535.');
  const storage = process.env.ORIFICE_STORAGE_DIR
    ? path.resolve(process.env.ORIFICE_STORAGE_DIR) : path.join(root, 'storage');
  const required = [
    'public/index.html', 'public/app.js', 'public/styles.css', 'public/favicon.svg',
    'examples/demo-project.json', 'examples/workbook-project.json', 'source/workbook.xlsx'
  ];
  for (const file of required) {
    try { await readFile(path.join(root, file)); }
    catch { throw new Error(`Package file is missing or unreadable: ${file}. Extract the complete ZIP into a writable folder.`); }
  }
  try {
    await mkdir(storage, {recursive:true});
    const probe = path.join(storage, `.orifice-write-check-${randomUUID()}.tmp`);
    const handle = await open(probe, 'wx');
    await handle.close();
    await unlink(probe);
  } catch (error) {
    throw new Error(`Project storage is not writable: ${storage}\nChoose a writable ORIFICE_STORAGE_DIR. ${error.code ?? error.message}`);
  }
  process.env.ORIFICE_STORAGE_DIR = storage;
  // Loading the server also checks that its modules and JSON catalogs can load.
  const { createServer } = await import('../src/server.ts');
  const { VERSION } = await import('../src/catalog.ts');
  if (args[0] === '--check') {
    console.log(`Startup check passed. Node ${process.versions.node}; engine ${VERSION}.\nProjects: ${storage}\nNo server was started; port availability is checked when starting.`);
    return;
  }
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error(`Port ${port} is already in use. Stop your previous Orifice Workbench terminal, or set PORT to another free port and start again.`);
    throw error;
  }
  server.on('error', error => { console.error(`Server error: ${error.message}`); process.exitCode = 1; server.close(); });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log('\nStopping Orifice Workbench...');
    server.close(error => { if (error) { console.error(error.message); process.exitCode = 1; } });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log(`Orifice Workbench - Part 6 / engine ${VERSION}\nOpen http://127.0.0.1:${port}\nProjects: ${storage}\nKeep this terminal open. Press Ctrl+C to stop.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch(error => { console.error(`Cannot start Orifice Workbench: ${error.message}`); process.exitCode = 1; });
}
