import { fields, CASES } from './catalog.ts';
import type { TagInput } from './types.ts';
import type { Result } from './engine.ts';

export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i+1] === '"') {cell += '"'; i++;} else {quoted = false; closed = true;} }
      else cell += ch;
    } else if (ch === '"' && cell === '' && !closed) quoted = true;
    else if (ch === ',') {row.push(cell); cell = ''; closed = false;}
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; closed = false;
    } else { if (closed || ch === '"') throw new Error('Malformed CSV quoting.'); cell += ch; }
  }
  if (quoted) throw new Error('Unclosed quote in CSV.');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"','""') + '"';
}
export function rowsCSV(rows: unknown[][]): string { return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }
export function inputCSV(tags: TagInput[]): string {
  const keys = fields.map((f: {key: string}) => f.key);
  return rowsCSV([keys, ...tags.map(t => keys.map((k: keyof TagInput) => t[k]))]);
}
export function importCSV(text: string): TagInput[] {
  const rows = parseCSV(text), headers = rows.shift();
  if (!headers) throw new Error('CSV is empty.');
  const selected = headers.map(h => fields.find((f: {key: string,label: string}) => f.key === h.trim() || f.label === h.trim()));
  if (selected.some(x => !x)) throw new Error('Unknown CSV column. Use the input CSV template from this application.');
  if (new Set(selected.map(x=>x.key)).size !== selected.length) throw new Error('Duplicate CSV headers.');
  if (!selected.some(x=>x.key==='tag')) throw new Error('CSV must contain a tag column.');
  if (rows.length > 500) throw new Error('Maximum 500 tags per project.');
  return rows.map((r,index) => {
    if (r.length !== headers.length) throw new Error(`CSV row ${index+2} has ${r.length} columns; expected ${headers.length}.`);
    const obj: Record<string,unknown> = {};
    selected.forEach((f,i) => {
      const s = r[i].trim();
      if (s === '') obj[f.key] = null;
      else if (f.type === 'number') {const n = Number(s); if (!Number.isFinite(n)) throw new Error(`CSV row ${index+2}, ${f.key}: invalid number.`); obj[f.key] = n;}
      else obj[f.key] = s;
    });
    return obj as TagInput;
  });
}
export function resultsCSV(results: Result[]): string {
  const rows: unknown[][] = [['tag','status','complete','engineeringVerified','engineVersion','sourceHash','case','referenceBoreMm','operatingBoreMm','beta','dpUnit','dp','permanentLoss','reynolds','cd','expansibility','pipeVelocityM_s','boreVelocityM_s','densityKg_m3','massKg_s','pressureRatio','issues']];
  for (const r of results) for (const c of CASES) {
    const v = r.cases[c];
    rows.push([r.tag,r.status,r.complete,r.engineeringVerified,r.engineVersion,r.sourceHash,c,r.referenceBoreMm,v?.boreMm,v?.beta,r.dpUnit,v?.dp,v?.permanentLoss,v?.re,v?.cd,v?.y,v?.pipeVelocity,v?.boreVelocity,v?.density,v?.massKgS,v?.pressureRatio,r.issues.map(x=>`${x.severity} ${x.code}${x.case ? ' ('+x.case+')' : ''}: ${x.message}`).join(' | ')]);
  }
  return rowsCSV(rows);
}
