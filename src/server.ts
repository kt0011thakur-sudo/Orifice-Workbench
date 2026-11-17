import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateBatch } from './engine.ts';
import { fields, pipes, units, VERSION, manifest, readJSON } from './catalog.ts';
import { demoTag } from './defaults.ts';
import { importCSV, inputCSV, resultsCSV } from './csv.ts';
import { importWorkbook } from './xlsx-import.ts';

const root = fileURLToPath(new URL('../',import.meta.url));
const publicDir = path.join(root,'public');
const storage = process.env.ORIFICE_STORAGE_DIR ? path.resolve(process.env.ORIFICE_STORAGE_DIR) : path.join(root,'storage');
const maxBody = 6 * 1024 * 1024;
let writeQueue: Promise<unknown> = Promise.resolve();
function queueWrite<T>(fn:()=>Promise<T>): Promise<T> {const p = writeQueue.then(fn,fn); writeQueue = p.catch(()=>{}); return p;}
class HttpError extends Error { status: number; constructor(status: number, message: string) {super(message);this.status=status;} }
function checkProject(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400,'A project object is required.');
  const p = data as {name?: unknown,tags?: unknown,schemaVersion?: unknown};
  if (!Array.isArray(p.tags) || p.tags.length > 500 || p.tags.some(t => !t || typeof t !== 'object' || Array.isArray(t))) throw new HttpError(400,'Project needs an array of at most 500 tag objects.');
  if (p.schemaVersion !== undefined && p.schemaVersion !== 1) throw new HttpError(400,'Unsupported project schema version.');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 160) throw new HttpError(400,'Enter a project name of 1 to 160 characters.');
  return {name:p.name.trim(),tags:p.tags,schemaVersion:1};
}
async function body(req: http.IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415,'Use application/json.');
  let size=0;const chunks: Buffer[]=[];
  for await (const chunk of req) {size += chunk.length;if(size > maxBody)throw new HttpError(413,'Request exceeds 6 MB.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Invalid JSON.');}
}
function safeId(id: string) {if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new HttpError(400,'Invalid project ID.');return id;}
// Known user-data errors are 400. Unexpected I/O/program errors remain 500.
function inputAction<T>(fn: () => T): T {
  try { return fn(); } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid input.');
  }
}
export function createServer() {
  return http.createServer(async(req,res)=>{
    const json=(data: unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try{
      const port = (req.socket.localAddress && (req.socket as unknown as {localPort: number}).localPort) || 3000;
      const expectedHosts = [`127.0.0.1:${port}`,`localhost:${port}`];
      if (!expectedHosts.includes(req.headers.host ?? '')) throw new HttpError(403,'Invalid Host header. Open the local address printed by the server.');
      if (req.headers.origin && !expectedHosts.some(h=>req.headers.origin===`http://${h}`)) throw new HttpError(403,'Cross-origin requests are disabled.');
      const url = new URL(req.url!,'http://127.0.0.1');
      const route=url.pathname;
      if(req.method==='GET' && route==='/api/health')return json({ok:true,version:VERSION,localOnly:true});
      if(req.method==='GET' && route==='/api/catalog')return json({fields,pipes,units,manifest,version:VERSION,demo:demoTag()});
      if(req.method==='GET' && route==='/api/workbook')return json(readJSON('../examples/workbook-project.json'));
      if(req.method==='POST' && route==='/api/calculate'){
        const data=await body(req);if(!Array.isArray(data?.tags))throw new HttpError(400,'tags array required.');
        return json({results:inputAction(()=>calculateBatch(data.tags))});
      }
      if(req.method==='POST' && route==='/api/import/xlsx'){
        if(req.headers['content-type']!=='application/octet-stream')throw new HttpError(415,'Use application/octet-stream for XLSX import.');
        const chunks: Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw new HttpError(413,'XLSX exceeds 32 MB.');chunks.push(chunk);}
        return json(inputAction(()=>importWorkbook(Buffer.concat(chunks))));
      }
      if(req.method==='POST' && route==='/api/import/csv'){
        const data=await body(req);if(typeof data?.text!=='string')throw new HttpError(400,'CSV text required.');
        return json({tags:inputAction(()=>importCSV(data.text))});
      }
      if(req.method==='POST' && (route==='/api/export/inputs' || route==='/api/export/results')){
        const data=await body(req);const project=checkProject(data);
        const content=route.endsWith('inputs') ? inputCSV(project.tags) : resultsCSV(inputAction(()=>calculateBatch(project.tags)));
        res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="orifice-export.csv"'});return res.end(content);
      }
      if(req.method==='GET' && route==='/api/projects'){
        await mkdir(storage,{recursive:true});const list=[];
        for(const f of (await readdir(storage)).filter(f=>/^[0-9a-f-]{36}\.json$/.test(f))) {
          const p=JSON.parse(await readFile(path.join(storage,f),'utf8'));list.push({id:p.id,name:p.name,revision:p.revision,tagCount:p.tags.length,updatedAt:p.updatedAt});
        }
        return json({projects:list.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
      }
      if(req.method==='GET' && /^\/api\/projects\/[^/]+$/.test(route)){
        const id=safeId(route.split('/').pop()!);
        try{return json(JSON.parse(await readFile(path.join(storage,id+'.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new HttpError(404,'Project not found.');throw e;}
      }
      if(req.method==='POST' && route==='/api/projects'){
        const data=await body(req);const p=checkProject(data);
        const saved=await queueWrite(async()=>{
          await mkdir(storage,{recursive:true});const id=data.id ? safeId(data.id) : randomUUID();let revision=0;
          if(data.id){let old;try{old=JSON.parse(await readFile(path.join(storage,id+'.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new HttpError(404,'Project not found.');throw e;}
            if(data.revision!==old.revision)throw new HttpError(409,'Project changed. Export your current draft, then reload the saved project.');revision=old.revision;}
          const doc={...p,id,revision:revision+1,updatedAt:new Date().toISOString(),engineVersion:VERSION};
          const temporary=path.join(storage,id+'.'+randomUUID()+'.tmp');await writeFile(temporary,JSON.stringify(doc,null,2),'utf8');await rename(temporary,path.join(storage,id+'.json'));return doc;
        });return json(saved);
      }
      if(req.method==='GET'){
        const staticFiles: Record<string,string>={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
        const name=staticFiles[route];if(!name)throw new HttpError(404,'Not found.');
        const content=await readFile(path.join(publicDir,name));const ext=path.extname(name);
        res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[ext]!});return res.end(content);
      }
      throw new HttpError(404,'Route not found.');
    } catch(error) {
      const e=error as Error;
      const status=error instanceof HttpError ? error.status : 500;
      if(status===500) console.error('Backend request failed:', e.message);
      json({error:status===500 ? 'Internal server error. Check the local server log.' : e.message},status);
    }
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT ?? 3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
  const server=createServer();server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Orifice Workbench ${VERSION}\nOpen http://127.0.0.1:${port}\nProjects: ${storage}\nPress Ctrl+C to stop.`));
}
