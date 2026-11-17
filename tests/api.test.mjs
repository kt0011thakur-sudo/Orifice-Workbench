import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,writeFile,rename} from 'node:fs/promises';import os from 'node:os';import http from 'node:http';import path from 'node:path';import {demoTag} from '../src/defaults.ts';
const dir=await mkdtemp(path.join(os.tmpdir(),'orifice-test-'));process.env.ORIFICE_STORAGE_DIR=dir;
const {createServer}=await import('../src/server.ts');const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const post=(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
test('health, static app and catalog return expected content',async()=>{const health=await (await fetch(base+'/api/health')).json();assert.equal(health.localOnly,true);const html=await fetch(base+'/');assert.equal(html.status,200);assert.match(await html.text(),/Orifice Workbench/);assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);const c=await (await fetch(base+'/api/catalog')).json();assert.equal(c.pipes.length,355);assert.equal(c.fields.length,79);});
test('calculation API returns a complete reviewable demo and rejects malformed input',async()=>{const r=await post('/api/calculate',{tags:[demoTag()]});assert.equal(r.status,200);assert.equal((await r.json()).results[0].complete,true);assert.equal((await post('/api/calculate',{tags:'no'})).status,400);assert.equal((await post('/api/calculate',{tags:[]},{'Content-Type':'text/plain'})).status,415);});
test('save/load, revision conflict and serialized concurrent writes',async()=>{const p={schemaVersion:1,name:'API fixture',tags:[demoTag()]};const created=await (await post('/api/projects',p)).json();assert.equal(created.revision,1);assert.equal((await (await fetch(base+'/api/projects/'+created.id)).json()).name,p.name);const attempts=await Promise.all([post('/api/projects',{...created,name:'A'}),post('/api/projects',{...created,name:'B'})]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);const saved=await (await fetch(base+'/api/projects/'+created.id)).json();assert.equal(saved.revision,2);assert.equal((await (await fetch(base+'/api/projects')).json()).projects.length,1);});
test('cross-origin mutation, invalid host and arbitrary project path are rejected',async()=>{assert.equal((await post('/api/projects',{name:'x',tags:[]},{Origin:'http://evil.example'})).status,403);const badHost=await new Promise((resolve,reject)=>{const request=http.get(base+'/api/health',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);});request.on('error',reject);});assert.equal(badHost,403);assert.notEqual((await fetch(base+'/api/projects/not-a-uuid')).status,200);});
test('XLSX upload and CSV download API work end-to-end',async()=>{const buffer=await readFile(new URL('../source/workbook.xlsx',import.meta.url));const r=await fetch(base+'/api/import/xlsx',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:buffer});assert.equal(r.status,200);assert.equal((await r.json()).tags.length,66);const csv=await post('/api/export/results',{name:'export',tags:[demoTag()]});assert.equal(csv.status,200);assert.match(await csv.text(),/engineeringVerified/);});

test('malformed JSON, invalid project schemas and malformed imports have client errors',async()=>{
 assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'})).status,400);
 for(const p of [{name:'',tags:[]},{name:'x',tags:[3]},{name:'x',tags:[],schemaVersion:2}])assert.equal((await post('/api/projects',p)).status,400);
 assert.equal((await post('/api/import/csv',{text:'tag,unknown\nT1,no'})).status,400);
 assert.equal((await fetch(base+'/api/import/xlsx',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'not xlsx'})).status,400);
 assert.equal((await post('/api/calculate',{tags:Array(501).fill(demoTag())})).status,400);
});
test('saved project inputs are readable from a restarted server',async()=>{
 const p=await (await post('/api/projects',{name:'restart fixture',tags:[demoTag()]})).json();
 const fresh=createServer();await new Promise(resolve=>fresh.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch(`http://127.0.0.1:${fresh.address().port}/api/projects/${p.id}`);assert.equal(response.status,200);const saved=await response.json();assert.deepEqual(saved.tags,p.tags);assert.equal(saved.revision,p.revision);}finally{await new Promise(resolve=>fresh.close(resolve));}
});
test('unexpected storage failure returns 500 instead of mislabeling it as bad input',async t=>{
 const backup=dir+'-backup';await rename(dir,backup);await writeFile(dir,'not a directory');
 // Capture only within this deliberate failure test; production logging is unchanged.
 const errorLog=t.mock.method(console,'error',()=>{});
 try{
  const response=await post('/api/projects',{name:'I/O failure fixture',tags:[]});
  assert.equal(response.status,500);
  assert.equal((await response.json()).error,'Internal server error. Check the local server log.');
  assert.equal(errorLog.mock.callCount(),1);
  assert.equal(errorLog.mock.calls[0].arguments[0],'Backend request failed:');
  assert.match(errorLog.mock.calls[0].arguments[1],/EEXIST|ENOTDIR/);
 }
 finally{errorLog.mock.restore();await rm(dir,{force:true});await rename(backup,dir);}
});
