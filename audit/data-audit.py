"""Catalog arithmetic, independent unit factors, workbook cache and source-cell evidence."""
import importlib.util,json,csv,math,hashlib
from pathlib import Path
from collections import Counter
import openpyxl
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/part5'
spec=importlib.util.spec_from_file_location('independent',ROOT/'audit/independent-check.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def audit_units(units):
 rows=[]
 for x in units:
  f,o=mod.UNITS[x['quantity'],x['unit']]
  valid=math.isclose(x['multiplier'],f,rel_tol=1e-10,abs_tol=1e-15) and math.isclose(x['offset'],o,rel_tol=1e-10,abs_tol=1e-8)
  rows.append({'quantity':x['quantity'],'unit':x['unit'],'actualFactor':x['multiplier'],'referenceFactor':f,'actualOffset':x['offset'],'referenceOffset':o,'pass':valid})
 return rows
units=audit_units(json.loads((ROOT/'data/units.json').read_text()))
legacy=json.loads((ROOT/'audit/baseline-units.json').read_text())
before=audit_units(legacy)
pipes=json.loads((ROOT/'data/pipes.json').read_text());bad=[];keys=set()
for x in pipes:
 key=(x['standard'],x['nps'],x['schedule'])
 if key in keys or not(0<x['idMm']<x['odMm'] and x['wtMm']>0) or abs(x['idMm']-(x['odMm']-2*x['wtMm']))>1e-8:bad.append(x)
 keys.add(key)
# Wheatland Schedule 40 sheet WFS-121824, page 2, metric OD/WT/ID.
reference=[('1',33.4,3.38,26.6),('1 1/4',42.2,3.56,35.1),('1 1/2',48.3,3.68,40.9),('2',60.3,3.91,52.5),('2 1/2',73.,5.16,62.7),('3',88.9,5.49,77.9),('3 1/2',101.6,5.74,90.1),('4',114.3,6.02,102.3),('5',141.3,6.55,158.2),('6',168.3,7.11,154.1),('8',219.1,8.18,202.7)]
spot=[]
for size,od,wt,ident in reference:
 matches=[x for x in pipes if x['standard']=='ASME B36.10M' and x['schedule']=='40' and x['nps']==size]
 if not matches:spot.append({'nps':size,'status':'NOT_IN_CATALOG'});continue
 x=matches[0];conflict=abs(ident-(od-2*wt))>.08
 spot.append({'nps':size,'catalog':{k:x[k] for k in ['odMm','wtMm','idMm']},'reference':{'odMm':od,'wtMm':wt,'idMm':ident},'odWtMatch':abs(x['odMm']-od)<.005 and abs(x['wtMm']-wt)<.005,'idMatchWithin0_08mm':abs(x['idMm']-ident)<=.08,'referenceInternalConflict':conflict,'status':'REFERENCE_CONFLICT' if conflict else 'PASS' if abs(x['odMm']-od)<.005 and abs(x['wtMm']-wt)<.005 and abs(x['idMm']-ident)<=.08 else 'DIFFERENCE'})
wb=json.loads((OUT/'workbook-results.json').read_text());cache=json.loads((ROOT/'data/workbook-cache.json').read_text());old=json.loads((OUT/'baseline-workbook-results.json').read_text())
cache_rows=[];missing=0
mapping={'I':('geometry','odMm'),'J':('geometry','wtMm'),'K':('geometry','idMm'),'L':('referenceBoreMm',),'M':('fsBeta',)}
letters=lambda n:openpyxl.utils.get_column_letter(n)
for start,key in [(15,'dp'),(19,'permanentLoss'),(23,'re'),(27,'pipeVelocity'),(31,'boreVelocity'),(35,'cd'),(39,'y'),(43,'density'),(47,'massKgS')]:
 for i,c in enumerate(mod.CASES):mapping[letters(start+i)]=('cases',c,key)
for r,source in zip(wb['results'],cache):
 for col,keys in mapping.items():
  b=source['outputs'].get(col);a=r
  for k in keys:a=a.get(k) if isinstance(a,dict) else None
  if not isinstance(a,(int,float)) or not isinstance(b,(int,float)):missing+=1;continue
  ok=abs(a-b)<=max(1e-8,abs(b)*1e-7)
  cache_rows.append({'tag':r['tag'],'cell':f'03_Outputs!{col}{source["sourceRow"]}','node':a,'cached':b,'pass':ok})
changes=[]
for a,b in zip(old['results'],wb['results']):
 if a['cases']!=b['cases'] or a['referenceBoreMm']!=b['referenceBoreMm'] or a['status']!=b['status']:changes.append(a['tag'])
w=openpyxl.load_workbook(ROOT/'source/workbook.xlsx',read_only=True,data_only=False);r7=w['03_Outputs']['R7'];source_cell={'cell':'03_Outputs!R7','stored':r7.value,'type':r7.data_type};w.close()
w=openpyxl.load_workbook(ROOT/'source/workbook.xlsx',read_only=True,data_only=True);source_cell['RO7_cached_Pa']=w['03_Outputs']['RO7'].value;w.close()
report={'unitFactors':{'beforePass':sum(x['pass'] for x in before),'afterPass':sum(x['pass'] for x in units),'total':len(units),'legacyMismatches':[x for x in before if not x['pass']],'rows':units,'note':'Numeric factor and offset verification. Gauge pressure assumes 101325 Pa atmosphere; base/stock volume requires valid supplied reference properties. SUS naming not independently standardized.'},'pipes':{'records':len(pipes),'internalFailures':bad,'manufacturerSpotChecks':spot,'note':'Manufacturer spot checks do not verify all schedules, tolerances, material selection or ASME editions.'},'workbook':{'tags':len(wb['tags']),'complete':sum(r['complete'] for r in wb['results']),'statusCounts':dict(Counter(r['status'] for r in wb['results'])),'allFourCasesMissing':sum(not r['cases'] for r in wb['results']),'computedCases':sum(len(r['cases']) for r in wb['results']),'numericChangesVersusPart4':changes,'cachedComparable':len(cache_rows),'cachedMatches':sum(x['pass'] for x in cache_rows),'cachedUnavailable':missing,'cachedMismatches':[x for x in cache_rows if not x['pass']],'comparisonScope':'I through AX only: five tag geometry/bore/beta columns plus nine quantities at four operating cases. Excel was not recalculated.','sourceCell':source_cell,'sha256':hashlib.sha256((ROOT/'source/workbook.xlsx').read_bytes()).hexdigest()}}
(OUT/'data-audit.json').write_text(json.dumps(report,indent=2)+'\n')
with (OUT/'workbook-cache-comparison.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=cache_rows[0].keys());writer.writeheader();writer.writerows(cache_rows)
with (OUT/'tag-readiness.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=['tag','phase','mode','status','complete','computedCases','failCodes','reviewCodes']);writer.writeheader()
 for t,r in zip(wb['tags'],wb['results']):writer.writerow(dict(tag=t['tag'],phase=t['phase'],mode=t['mode'],status=r['status'],complete=r['complete'],computedCases=len(r['cases']),failCodes=';'.join(sorted({i['code'] for i in r['issues'] if i['severity']=='FAIL'})),reviewCodes=';'.join(sorted({i['code'] for i in r['issues'] if i['severity']!='FAIL'}))))
print(json.dumps({**{k:report[k] for k in ['workbook']},'units':{'beforePass':report['unitFactors']['beforePass'],'afterPass':report['unitFactors']['afterPass'],'total':len(units)},'pipes':{'records':len(pipes),'internalFailures':len(bad),'spotStatuses':dict(Counter(x['status'] for x in spot))}},indent=2))
assert all(x['pass'] for x in units) and not bad and not changes
