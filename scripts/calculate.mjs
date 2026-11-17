import { readFile } from 'node:fs/promises';
import { calculateBatch } from '../src/engine.ts';
const file=process.argv[2];
if(!file)throw new Error('Usage: node scripts/calculate.mjs project.json');
const project=JSON.parse(await readFile(file,'utf8'));
console.log(JSON.stringify(calculateBatch(project.tags),null,2));
