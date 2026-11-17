// Starts its own server and uses temporary storage; leaves existing projects untouched.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temporary=await mkdtemp(path.join(os.tmpdir(),'orifice-api-walkthrough-'));
process.env.ORIFICE_STORAGE_DIR=temporary;
const {createServer}=await import('../src/server.ts');
let server;
const start=async()=>{server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return `http://127.0.0.1:${server.address().port}`;};
const close=async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));};
let base=await start();
const steps=[];
async function call(route,data,expected=200){const response=await fetch(base+route,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const content=await response.json();assert.equal(response.status,expected,JSON.stringify(content));return content;}
try {
 const health=await call('/api/health');assert.equal(health.localOnly,true);steps.push('Health and local API');
 const catalog=await call('/api/catalog');assert.equal(catalog.fields.length,79);assert.equal(catalog.pipes.length,355);steps.push('Versioned catalogs');
 const demo=JSON.parse(await readFile(new URL('../examples/demo-project.json',import.meta.url),'utf8'));
 const calculated=await call('/api/calculate',{tags:demo.tags});assert.equal(calculated.results[0].complete,true);assert.ok(Math.abs(calculated.results[0].cases.fs.dp-50)<1e-6);steps.push('Demo calculation at 50 kPa');
 const importedResponse=await fetch(base+'/api/import/xlsx',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:await readFile(new URL('../source/workbook.xlsx',import.meta.url))});assert.equal(importedResponse.status,200);const imported=await importedResponse.json();assert.equal(imported.tags.length,66);assert.equal(imported.tags[0].gamma,null);steps.push('66-tag XLSX import with missing data preserved');
 let saved=await call('/api/projects',demo);assert.equal(saved.revision,1);assert.deepEqual((await call('/api/projects/'+saved.id)).tags,demo.tags);steps.push('Create and read project');
 const previous=structuredClone(saved);saved=await call('/api/projects',{...saved,name:'API walkthrough revision 2'});assert.equal(saved.revision,2);await call('/api/projects',previous,409);steps.push('Update and stale-revision conflict');
 for(const kind of ['inputs','results']){
  const response=await fetch(base+'/api/export/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)});assert.equal(response.status,200);const csv=await response.text();
  if(kind==='inputs'){const roundtrip=await call('/api/import/csv',{text:csv});assert.equal(roundtrip.tags[0].tag,demo.tags[0].tag);assert.equal(roundtrip.tags[0].flowFs,10);}
  else assert.ok(csv.includes('engineeringVerified')&&csv.includes('ENGINEERING_REVIEW'));
 }
 steps.push('Input CSV round trip and freshly calculated results CSV');
 await close();base=await start();const reopened=await call('/api/projects/'+saved.id);assert.equal(reopened.revision,2);assert.equal(reopened.name,saved.name);steps.push('Persistence after server restart');
 // Run the client asynchronously so this server can keep processing requests.
 const {spawn}=await import('node:child_process');
 async function client(args){return await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/api-client.mjs',...args],{cwd:root,env:{...process.env,ORIFICE_API_URL:base},stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.once('error',reject);child.once('close',code=>code===0?resolve(out):reject(new Error(err)));});}
 const cliHealth=JSON.parse(await client(['health']));assert.equal(cliHealth.ok,true);
 const output=path.join(temporary,'walkthrough-results.csv');await client(['export-results','examples/demo-project.json','--out',output]);assert.ok((await readFile(output,'utf8')).includes('permanentLoss'));steps.push('API client and UTF-8 file export');
 const cliInputs=path.join(temporary,'walkthrough-inputs.csv');await client(['export-inputs','examples/demo-project.json','--out',cliInputs]);
 const csvProject=JSON.parse(await client(['import-csv',cliInputs]));assert.equal(csvProject.schemaVersion,1);assert.equal(csvProject.tags[0].flowFs,10);assert.ok(csvProject.name);
 steps.push('CSV client creates a portable project object');
 console.log(JSON.stringify({passed:true,checks:steps,sourceTags:imported.tags.length,engineVersion:health.version,savedRevision:reopened.revision,storage:'Temporary directory removed on completion'},null,2));
} finally {await close();await rm(temporary,{recursive:true,force:true});}
