import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2);
const outIndex=args.indexOf('--out');let output;
if(outIndex>=0){output=args[outIndex+1];if(!output)throw new Error('--out needs a filename.');args.splice(outIndex,2);}
const [command,fileOrId]=args;
const base=new URL(process.env.ORIFICE_API_URL || 'http://127.0.0.1:3000');
if(base.protocol!=='http:' || !['127.0.0.1','localhost'].includes(base.hostname) || base.username || base.password)throw new Error('Use a local http://127.0.0.1:PORT or http://localhost:PORT API URL.');
const help=`Usage: npm run api -- COMMAND [FILE_OR_ID] [--out NEW_FILE]
Commands: health, catalog, list, load ID, calculate PROJECT.json,
create PROJECT.json, save SAVED_PROJECT.json, import-xlsx FILE.xlsx,
import-csv FILE.csv, export-inputs PROJECT.json, export-results PROJECT.json.
create strips a saved ID/revision to make a new copy; save retains them.
--out writes UTF-8 and refuses to overwrite an existing file.
Set ORIFICE_API_URL to change the local port. Start npm start separately.`;
if(!command || ['help','--help','-h'].includes(command)){console.log(help);process.exit(0);}
const project=async()=>{if(!fileOrId)throw new Error('A project JSON filename is required.');return JSON.parse(await readFile(fileOrId,'utf8'));};
let route,options={};
const post=value=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
switch(command){
 case 'health':route='/api/health';break;
 case 'catalog':route='/api/catalog';break;
 case 'list':route='/api/projects';break;
 case 'load':if(!fileOrId)throw new Error('A saved project ID is required.');route='/api/projects/'+encodeURIComponent(fileOrId);break;
 case 'calculate':route='/api/calculate';options=post({tags:(await project()).tags});break;
 case 'create':{const p=await project();route='/api/projects';options=post({schemaVersion:p.schemaVersion??1,name:p.name,tags:p.tags});break;}
 case 'save':route='/api/projects';options=post(await project());break;
 case 'import-xlsx':if(!fileOrId)throw new Error('An XLSX filename is required.');route='/api/import/xlsx';options={method:'POST',headers:{'Content-Type':'application/octet-stream'},body:await readFile(fileOrId)};break;
 case 'import-csv':if(!fileOrId)throw new Error('A CSV filename is required.');route='/api/import/csv';options=post({text:await readFile(fileOrId,'utf8')});break;
 case 'export-inputs':case 'export-results':route='/api/export/'+command.slice(7);options=post(await project());break;
 default:throw new Error(help);
}
const response=await fetch(new URL(route,base),{...options,signal:AbortSignal.timeout(30000)});
const isJson=response.headers.get('content-type')?.includes('application/json');
let data=isJson ? await response.json() : await response.text();
if(!response.ok)throw new Error(`HTTP ${response.status}: ${data.error || data}`);
if(command==='import-csv')data={schemaVersion:1,name:path.basename(fileOrId,path.extname(fileOrId)),tags:data.tags};
const text=isJson ? JSON.stringify(data,null,2)+'\n' : data;
if(output){await writeFile(output,text,{encoding:'utf8',flag:'wx'});console.log('Written '+output);}else process.stdout.write(text);
