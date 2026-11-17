import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTag} from '../src/engine.ts';
import {demoTag} from '../src/defaults.ts';
import {toSI,fromSI} from '../src/catalog.ts';
const fixed = ()=>({...demoTag(),mode:'Solve for DP',boreMm:45.49736523684261,beta:null,targetDp:null});
test('4 C water factors follow NIST rather than conventional water',()=>{
 assert.equal(toSI('DP',1,'inH2O_4C'),249.082);
 assert.equal(toSI('DP',1,'mmH2O_4C'),9.80638);
 assert.equal(fromSI('DP',249.082,'inH2O_4C'),1);
});
test('unused zero or negative target DP cannot block fixed-bore calculation',()=>{
 const expected=calculateTag(fixed());
 for(const targetDp of [0,-1,1,100]){
  const r=calculateTag({...fixed(),targetDp});assert.equal(r.complete,true);
  assert.equal(r.cases.fs.dpPa,expected.cases.fs.dpPa);
  assert(r.issues.some(i=>i.code==='TARGET_DP_UNUSED'));
 }
});
test('target DP stays mandatory and positive for target sizing',()=>{
 for(const mode of ['Solve for Bore','Solve for Beta'])for(const targetDp of [null,0,-1]){
  const r=calculateTag({...demoTag(),mode,targetDp});assert.equal(r.complete,false);assert.equal(r.status,'FAIL');
 }
});
test('missing existing-bore target is explicitly HOLD without hiding fixed-bore results',()=>{
 const r=calculateTag({...fixed(),mode:'Check Existing Bore'});
 assert.equal(r.complete,true);assert.equal(r.status,'HOLD');assert.equal(r.engineeringVerified,false);
 assert(r.issues.some(i=>i.code==='EXISTING_TARGET_MISSING'));
});
test('supplied existing-bore target is validated and actually compared',()=>{
 assert.equal(calculateTag({...fixed(),mode:'Check Existing Bore',targetDp:0}).complete,false);
 const r=calculateTag({...fixed(),mode:'Check Existing Bore',targetDp:1});
 assert(r.issues.some(i=>i.code==='EXISTING_BORE_DP'));assert(!r.issues.some(i=>i.code==='EXISTING_TARGET_MISSING'));
});
test('water-unit changes preserve SI output for equivalent input pressure',()=>{
 const base=calculateTag(demoTag());
 for(const [dpUnit,k] of [['inH2O_4C',249.082],['mmH2O_4C',9.80638]]){
  const r=calculateTag({...demoTag(),dpUnit,targetDp:50000/k});
  assert(Math.abs(r.referenceBoreMm-base.referenceBoreMm)<1e-8);
  assert(r.issues.some(i=>i.code==='WATER_DP_CONVERSION'));assert.equal(r.engineVersion,'0.2.0');
 }
});
import {bisect} from '../src/equations.ts';
const gasBoundary=()=>({...demoTag(),phase:'Gas',propertyBasis:'MW + Z',molecularWeight:28.965,zMin:1,zNormal:1,zMax:1,zFs:1,gamma:1.4,viscosity:.018,flowMin:.2,flowNormal:.5,flowMax:.8,flowFs:1,targetDp:250});
test('gas sizing at pressure ratio 0.75 respects solver residual tolerance',()=>{
 const r=calculateTag(gasBoundary());assert.equal(r.complete,true);
 assert(Math.abs(r.cases.fs.dp-250)<1e-7);assert(r.cases.fs.pressureRatio>=.75);
 assert(Math.abs(r.cases.fs.residualKgS)<=1e-11);
});
test('gas mass flow materially beyond the pressure-ratio limit is not clipped',()=>{
 const solved=calculateTag(gasBoundary());
 const r=calculateTag({...gasBoundary(),mode:'Solve for DP',boreMm:solved.referenceBoreMm,beta:null,targetDp:null,flowFs:1.000001});
 assert.equal(r.cases.fs,undefined);assert(r.issues.some(i=>i.code==='EXPANSIBILITY_RANGE'&&i.case==='fs'));
});
test('bisection accepts endpoint residual within tolerance but rejects a real unbracketed root',()=>{
 assert.equal(bisect(x=>x-1-1e-12,0,1).value,1);
 assert.throws(()=>bisect(x=>x-1-1e-6,0,1));
});
