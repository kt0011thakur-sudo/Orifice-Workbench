import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRuntime } from '../scripts/start.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(root, 'scripts/start.mjs');
async function temporary(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'orifice startup '));
  t.after(() => rm(dir, {recursive:true, force:true}));
  return dir;
}
function launch(cwd, env, args = []) {
  const child = spawn(process.execPath, [script, ...args], {cwd, env:{...process.env, ...env}, stdio:['ignore','pipe','pipe']});
  let output = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => output += data);
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal, output}));
  });
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 12000);
  done.then(() => clearTimeout(watchdog), () => clearTimeout(watchdog));
  return {child, done, output:() => output};
}
async function waitReady(run) {
  const ready = new Promise(resolve => {
    const handler = () => { if (run.output().includes('Open http://')) { run.child.stdout.off('data', handler); resolve(); } };
    run.child.stdout.on('data', handler);
    handler();
  });
  await Promise.race([ready, run.done.then(r => { throw new Error(`Server exited before startup (${r.code}): ${r.output}`); })]);
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function assertRequestedStop(result, platform = process.platform) {
  // Windows emulates child.kill('SIGTERM') as forced termination. Node reports
  // code:null and signal:'SIGTERM', not the POSIX handler's normal exit code 0.
  // Accept only an ordinary successful exit or that exact Windows outcome.
  const cleanExit = result.code === 0 && result.signal === null;
  const windowsStop = platform === 'win32' && result.code === null && result.signal === 'SIGTERM';
  assert.ok(cleanExit || windowsStop,
    'Unexpected stop on ' + platform + ': ' + JSON.stringify(result));
}

async function stopAndCheck(run) {
  assert.equal(run.child.kill('SIGTERM'), true, 'Expected the running test server to accept the stop request.');
  assertRequestedStop(await run.done);
}

test('requested-stop assertion accepts Windows SIGTERM but rejects crashes and timeouts', () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    assert.doesNotThrow(() => assertRequestedStop({code:0,signal:null},platform));
    for (const outcome of [
      {code:1,signal:null}, {code:null,signal:null},
      {code:null,signal:'SIGKILL'}, {code:null,signal:'SIGINT'}
    ]) assert.throws(() => assertRequestedStop(outcome,platform), /Unexpected stop/);
  }
  assert.doesNotThrow(() => assertRequestedStop({code:null,signal:'SIGTERM'},'win32'));
  for (const platform of ['linux','darwin'])
    assert.throws(() => assertRequestedStop({code:null,signal:'SIGTERM'},platform), /Unexpected stop/);
});

test('entry point refuses unsupported Node versions before loading TypeScript', () => {
  for (const version of ['20.19.0','22.18.0','24.11.9','25.0.0','26.0.0']) assert.throws(() => checkRuntime(version), /outside this package/);
  assert.doesNotThrow(() => checkRuntime('24.12.0'));
  assert.doesNotThrow(() => checkRuntime('24.19.0'));
});
test('startup preflight works outside project cwd, handles spaces and removes its probe', async t => {
  const dir = await temporary(t), storage = path.join(dir,'saved projects');
  const result = await launch(dir, {ORIFICE_STORAGE_DIR:storage,PORT:'3000'}, ['--check']).done;
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Startup check passed/);
  assert.match(result.output, /No server was started/);
  assert.deepEqual(await readdir(storage), []);
});
test('startup rejects a malformed port with an actionable error', async t => {
  const dir = await temporary(t);
  const result = await launch(dir,{ORIFICE_STORAGE_DIR:dir,PORT:'3000oops'}).done;
  assert.equal(result.code,1);assert.match(result.output,/PORT must be a whole number/);
});
test('startup rejects an unusable project storage path', async t => {
  const dir = await temporary(t), file = path.join(dir,'not-a-directory');
  await writeFile(file,'Keep this existing file');
  const result = await launch(dir,{ORIFICE_STORAGE_DIR:file,PORT:'3000'},['--check']).done;
  assert.equal(result.code,1);assert.match(result.output,/Project storage is not writable/);
  assert.equal(await readFile(file,'utf8'),'Keep this existing file');
});
test('launcher serves real calculations and saved projects survive a process restart', async t => {
  const dir = await temporary(t), port = await freePort(), env = {ORIFICE_STORAGE_DIR:path.join(dir,'project data'),PORT:String(port)};
  let run;
  try {
    run = launch(dir,env);await waitReady(run);
    const base = `http://127.0.0.1:${port}`;
    const api = async (route,body) => {
      const response = await fetch(base+route,{signal:AbortSignal.timeout(3000),...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
      assert.equal(response.status,200);return response.json();
    };
    assert.deepEqual(await api('/api/health'),{ok:true,version:'0.2.0',localOnly:true});
    const demo = JSON.parse(await readFile(path.join(root,'examples/demo-project.json'),'utf8'));
    const result = (await api('/api/calculate',{tags:demo.tags})).results[0];
    assert.equal(result.engineeringVerified,false);
    assert.ok(Math.abs(result.referenceBoreMm-45.49736523684261)<1e-8);
    const saved = await api('/api/projects',demo);
    await stopAndCheck(run);
    run = launch(dir,env);await waitReady(run);
    const loaded = await api('/api/projects/'+saved.id);
    assert.deepEqual(loaded.tags,demo.tags);assert.equal(loaded.revision,1);
    await stopAndCheck(run);
  } finally {
    if (run && run.child.exitCode === null && run.child.signalCode === null) {
      run.child.kill('SIGTERM');await run.done;
    }
  }
});
test('occupied port produces a clear message without terminating the other server', async t => {
  const dir = await temporary(t), held = createServer();
  await new Promise((resolve,reject) => {held.once('error',reject);held.listen(0,'127.0.0.1',resolve);});
  try {
    const result = await launch(dir,{ORIFICE_STORAGE_DIR:dir,PORT:String(held.address().port)}).done;
    assert.equal(result.code,1);assert.match(result.output,/already in use/);assert(held.listening);
  } finally {await new Promise(resolve => held.close(resolve));}
});
