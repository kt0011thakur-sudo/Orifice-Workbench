import {readFileSync,writeFileSync} from 'node:fs';
import {calculateBatch} from '../src/engine.ts';
const args=process.argv.slice(2);const project=JSON.parse(readFileSync(args[0],'utf8'));
writeFileSync(args[1],JSON.stringify({name:project.name,tags:project.tags,results:calculateBatch(project.tags)},null,2)+'\n');
