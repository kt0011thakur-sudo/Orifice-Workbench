/** Bounded, read-only importer for this workbook layout. It does not evaluate formulas.
 * Supports ordinary unencrypted XLSX ZIP (stored/deflate), shared/inline strings and numeric cells.
 * No external relationships, macros, formula execution or arbitrary worksheet code is used.
 */
import { inflateRawSync } from 'node:zlib';
import { fields } from './catalog.ts';
import type { TagInput } from './types.ts';

function xmlText(s: string): string {
  return s.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_m,hex,dec,named)=> {
    if(hex||dec){const n=parseInt(hex||dec,hex ? 16 : 10);return n>=0 && n<=0x10ffff ? String.fromCodePoint(n) : '\uFFFD';}
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[named.toLowerCase()];
  });
}
function attrs(s: string): Record<string,string> {
  return Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],xmlText(m[2])]));
}
function zipEntries(buffer: Buffer) {
  if(buffer.length>32*1024*1024)throw new Error('XLSX exceeds 32 MB.');
  let end=-1;
  for(let p=buffer.length-22;p>=Math.max(0,buffer.length-65557);p--){if(buffer.readUInt32LE(p)===0x06054b50){end=p;break;}}
  if(end<0)throw new Error('Not a supported XLSX ZIP archive.');
  if(buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6))throw new Error('Multipart ZIP is unsupported.');
  const count=buffer.readUInt16LE(end+10), directory=buffer.readUInt32LE(end+16);
  if(count>2000 || directory>=buffer.length)throw new Error('XLSX archive directory exceeds supported limits.');
  const files=new Map<string,()=>string>();let p=directory;
  for(let i=0;i<count;i++){
    if(p+46>buffer.length || buffer.readUInt32LE(p)!==0x02014b50)throw new Error('Malformed ZIP directory.');
    const flags=buffer.readUInt16LE(p+8),method=buffer.readUInt16LE(p+10),size=buffer.readUInt32LE(p+20),raw=buffer.readUInt32LE(p+24);
    const nl=buffer.readUInt16LE(p+28),xl=buffer.readUInt16LE(p+30),cl=buffer.readUInt16LE(p+32),offset=buffer.readUInt32LE(p+42);
    const name=buffer.toString('utf8',p+46,p+46+nl);p+=46+nl+xl+cl;
    if(flags&1)throw new Error('Encrypted workbooks are unsupported.');
    if(files.has(name))throw new Error('Duplicate ZIP entry.');
    files.set(name,()=>{
      if(raw>100*1024*1024||offset+30>buffer.length || buffer.readUInt32LE(offset)!==0x04034b50)throw new Error('XLSX entry exceeds limits or is malformed.');
      const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);
      if(start+size>buffer.length)throw new Error('Truncated ZIP entry.');
      const compressed=buffer.subarray(start,start+size);
      const output=method===0 ? compressed : method===8 ? inflateRawSync(compressed,{maxOutputLength:100*1024*1024}) : null;
      if(!output||output.length!==raw)throw new Error('Unsupported compression or damaged ZIP entry.');
      const xml=output.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('XML entity declarations are not supported.');return xml;
    });
  }
  return files;
}
function values(xml: string, strings: string[], allowedColumns: Set<string>): Map<string,unknown> {
  const out=new Map<string,unknown>();
  for(const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const a=attrs(m[1]);const loc=/^([A-Z]+)(\d+)$/.exec(a.r ?? '');
    if(!loc || !allowedColumns.has(loc[1]) || +loc[2]>504)continue;
    const contents=m[2]??'';const raw=/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(contents)?.[1];
    if(/<f\b/.test(contents) && +loc[2]>=5)throw new Error(`Input cell ${a.r} contains a formula. Replace formula-driven inputs with checked values before importing.`);
    let value: unknown=null;
    if(a.t==='inlineStr')value=[...contents.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join('');
    else if(raw!==undefined){value=a.t==='s' ? strings[Number(raw)] : a.t==='str'||a.t==='e' ? xmlText(raw) : a.t==='b' ? raw==='1' : Number(raw);}
    out.set(a.r,value);
  }
  return out;
}
export function importWorkbook(buffer: Buffer): {schemaVersion:number;name:string;tags:TagInput[];importNotes:string[]} {
  const files=zipEntries(buffer);
  const get=(p: string)=>{const f=files.get(p);if(!f)throw new Error(`Missing XLSX part ${p}.`);return f();};
  const wb=get('xl/workbook.xml'), rel=get('xl/_rels/workbook.xml.rels');
  const targets=new Map([...rel.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)].map(m=>{const a=attrs(m[1]);if(a.TargetMode==='External')return [a.Id,''];return [a.Id,a.Target];}));
  const sheets=new Map([...wb.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)].map(m=>{const a=attrs(m[1]);const raw=targets.get(a['r:id'])??'';const target=raw.startsWith('/') ? raw.slice(1) : 'xl/'+raw;return [a.name,target];}));
  const shared=files.has('xl/sharedStrings.xml') ? get('xl/sharedStrings.xml') : '';
  const strings=[...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join(''));
  const maps=new Map<string,Map<string,unknown>>();
  for(const name of ['01_Input Entry','02_Output Settings']){
    const target=sheets.get(name);if(!target)throw new Error(`This importer requires the ${name} worksheet.`);
    const fs=fields.filter((f:{sheet:string})=>f.sheet===name);
    const map=values(get(target),strings,new Set(fs.map((f:{column:string})=>f.column)));
    for(const f of fs){if(map.get(f.column+'4')!==f.label)throw new Error(`Header mismatch in ${name}!${f.column}4. Expected ${f.label}.`);}
    maps.set(name,map);
  }
  const tags: TagInput[]=[];
  for(let row=5;row<=504;row++){
    if(!maps.get('01_Input Entry')!.get('A'+row))continue;
    const tag: Record<string,unknown>={sourceRow:row};
    for(const f of fields){let v=maps.get(f.sheet)!.get(f.column+row)??null;if(f.type==='text'&&typeof v==='number')v=String(v);tag[f.key]=v;}
    tags.push(tag as TagInput);
  }
  return {schemaVersion:1,name:'Imported Excel workbook',tags,importNotes:['Inputs imported by checked sheet headers. No Excel formulas were executed.','Reference pipe and unit catalogs remain those of the delivered source version; changed catalogs require a reviewed migration.']};
}
