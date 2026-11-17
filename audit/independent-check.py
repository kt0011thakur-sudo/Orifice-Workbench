"""Independent implementation check. Requires fluids==1.3.1 and SciPy.
No hydraulic functions or unit coefficients are imported from the Node application.
Pipe lookup still uses the supplied catalog; external spot checks are a separate audit.
"""
from pathlib import Path
import json,math,subprocess,sys,platform,hashlib
import fluids,scipy
from fluids.flow_meter import C_Reader_Harris_Gallagher as rhg,orifice_expansibility,dP_orifice
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/part5';OUT.mkdir(parents=True,exist_ok=True)
CASES=['min','normal','max','fs'];TAPS={'Flange taps':'flange','Corner taps':'corner','D and D/2 taps':'D'}
PIPES=json.loads((ROOT/'data/pipes.json').read_text())
DEMO=json.loads((ROOT/'examples/demo-project.json').read_text())['tags'][0]
R=8314.46261815324
# Independently expressed SI conversions from exact SI/customary definitions and NIST SP811.
INCH=.0254;FT=12*INCH;LB=.45359237;G0=9.80665;USGAL=231*INCH**3;BBL=42*USGAL
PSI=LB*G0/INCH**2
UNITS={}
def u(q,k,f,o=0):UNITS[q,k]=(f,o)
for k,f in {'kg/s':1,'kg/h':1/3600,'t/h':1000/3600,'lb/h':LB/3600,'m3/s':1,'m3/h':1/3600,'L/s':.001,'L/min':.001/60,'USgpm':USGAL/60,'bbl/d actual':BBL/86400,'kbbl/d actual':1000*BBL/86400,'bbl/d @60F':BBL/86400,'kbbl/d @60F':1000*BBL/86400,'SUS kbbl/d @60F':1000*BBL/86400,'Sm3/h':1/3600,'Nm3/h':1/3600,'Sm3/d':1/86400,'Nm3/d':1/86400,'SCFD':FT**3/86400,'MSCFD':1000*FT**3/86400,'MMSCFD':1e6*FT**3/86400,'ft3/d actual':FT**3/86400}.items():u('Flow',k,f)
for k,f,o in [('degC',1,273.15),('degF',5/9,273.15-32*5/9),('K',1,0)]:u('Temperature',k,f,o)
for k,f in {'Pa':1,'kPa':1000,'MPa':1e6,'bar':100000,'psi':PSI}.items():
 u('Pressure',k+'(g)',f,101325);u('Pressure','psia' if k=='psi' else k+'(a)',f)
u('Pressure','kg/cm2(g)',G0/1e-4,101325)
for k,f in {'Pa':1,'kPa':1000,'mbar':100,'bar':100000,'psi':PSI,'mmH2O_4C':98.0638/10,'inH2O_4C':249.082}.items():u('DP',k,f)
for k,f in {'kg/m3':1,'kg/L':1000,'lb/ft3':LB/FT**3}.items():u('Density',k,f)
for k,f in {'Pa.s':1,'cP':.001,'mPa.s':.001}.items():u('Viscosity',k,f)
def si(q,v,k):f,o=UNITS[q,k];return v*f+o
def geometry(t):
 p=next(p for p in PIPES if p['standard']==t['pipeStandard'] and str(p['dn' if t['sizeUnit']=='DN' else 'nps'])==str(t['size']) and p['schedule']==t['schedule'])
 return t['manualIdMm'] if t['pipeIdMode']=='MANUAL ID' else p['odMm']-2*t['manualWtMm'] if t['pipeIdMode']=='MANUAL WT' else p['idMm']
def state(t,c):
 suffix=c.capitalize();tk=si('Temperature',t['temperature'+suffix],t['temperatureUnit']);p=si('Pressure',t['pressure'+suffix],t['pressureUnit']);mu=si('Viscosity',t['viscosity'],t['viscosityUnit'])
 basis=t['propertyBasis'];rho=None
 if basis in ['Direct Density','Manual Properties']:rho=si('Density',t['density'+suffix],t['densityUnit'])
 elif basis=='Specific Gravity':rho=t['specificGravity']*999.016 # inherited SG reference, not an independently verified property
 else:
  mw=t['specificGravity']*28.9625 if basis=='Gas SG + Z' else t['molecularWeight'];rho=p*mw/(R*tk*t['z'+suffix])
 unit=t['flowUnit'];q=si('Flow',t['flow'+suffix],unit)
 if unit in ['kg/s','kg/h','t/h','lb/h']:mass=q
 elif unit in ['m3/s','m3/h','L/s','L/min','USgpm','bbl/d actual','kbbl/d actual','ft3/d actual']:mass=q*rho
 else:
  base=t.get('baseDensity')
  if base in [None,'']:
   mw=t['specificGravity']*28.9625 if basis=='Gas SG + Z' else t['molecularWeight'];base=t['basePressureKpa']*1000*mw/(R*(t['baseTemperatureC']+273.15)*t['baseZ'])
  mass=q*base
 dp=1+(t['pipeAlpha'] if t['thermalExpansion']=='YES' else 0)*(tk-293.15)
 df=1+(t['plateAlpha'] if t['thermalExpansion']=='YES' else 0)*(tk-293.15)
 return {'temperatureK':tk,'pressurePa':p,'density':rho,'massKgS':mass,'pipeM':geometry(t)/1000*dp,'plateFactor':df,'mu':mu}
def coeff(t,s,d):return t['manualCd'] if t['cdMode']=='Manual' else rhg(s['pipeM'],d,s['density'],s['mu'],s['massKgS'],taps=TAPS[t['taps']])
def mass_at(t,s,d,dp):
 eps=1 if t['phase']=='Liquid' else orifice_expansibility(s['pipeM'],d,s['pressurePa'],s['pressurePa']-dp,t['gamma'])
 return coeff(t,s,d)*eps*(math.pi*d*d/4)*math.sqrt(2*s['density']*dp/(1-(d/s['pipeM'])**4))
def pressure(t,s,d):
 if s['massKgS']==0:return 0
 if t['phase']=='Liquid':return (s['massKgS']/(coeff(t,s,d)*math.pi*d*d/4))**2*(1-(d/s['pipeM'])**4)/(2*s['density'])
 return brentq(lambda dp:mass_at(t,s,d,dp)-s['massKgS'],0,.25*s['pressurePa'],xtol=1e-8,rtol=1e-13)
def refbore(t):
 if t['mode'] not in ['Solve for Bore','Solve for Beta']:return (t['boreMm'] if t.get('boreMm') not in [None,''] else t['beta']*geometry(t))/1000
 s=state(t,'fs');dp=si('DP',t['targetDp'],t['dpUnit'])
 # Broad independent search interval. Node uses project beta bounds and bisection.
 return brentq(lambda d:mass_at(t,s,d,dp)-s['massKgS'],.05*s['pipeM'],.85*s['pipeM'],xtol=1e-14,rtol=1e-13)/s['plateFactor']
def expected(t,c,ref):
 s=state(t,c);D=s['pipeM'];d=ref*s['plateFactor'];dp=pressure(t,s,d);C=None if s['massKgS']==0 else coeff(t,s,d)
 eps=1 if t['phase']=='Liquid' else orifice_expansibility(D,d,s['pressurePa'],s['pressurePa']-dp,t['gamma'])
 ppl=0 if C is None else dP_orifice(D,d,s['pressurePa'],s['pressurePa']-dp,C)
 return {**{k:s[k] for k in ['temperatureK','pressurePa','density','massKgS','pipeM']},'re':4*s['massKgS']/(math.pi*s['mu']*D),'boreMm':d*1000,'beta':d/D,'cd':C,'y':eps,'dpPa':dp,'permanentLossPa':ppl,'pipeVelocity':s['massKgS']/(s['density']*math.pi*D**2/4),'boreVelocity':s['massKgS']/(s['density']*math.pi*d**2/4),'pressureRatio':1-dp/s['pressurePa']}
def fixtures():
 tags=[]
 for D,size in [(.06,'3'),(.1,'4')]:
  for phase in ['Liquid','Gas','Steam']:
   for taps in TAPS:
    for thermal in ['NO','YES']:
     for cdmode in ['RHG','Manual']:
      t=dict(DEMO,phase=phase,pipeIdMode='MANUAL ID',manualIdMm=D*1000,manualWtMm=None,size=size,schedule='40',taps=taps,thermalExpansion=thermal,pipeAlpha=12e-6,plateAlpha=17e-6,cdMode=cdmode,manualCd=.61,dpUnit='Pa',flowUnit='kg/s',propertySource='Synthetic Part 5 numerical verification fixture',maxDp=None,minDp=None,pipeVelocityLimit=None,boreVelocityLimit=None)
      t.update(propertyBasis='MW + Z' if phase=='Gas' else 'Manual Properties' if phase=='Steam' else 'Direct Density',viscosity=1.002 if phase=='Liquid' else .018 if phase=='Gas' else .02,gamma=1.4 if phase=='Gas' else 1.3,molecularWeight=28.965)
      for c,f,T,Z,rho in zip(CASES,[.25,.5,.8,1],[20,40,60,80],[.96,.98,1,1.02],[8,7,6,5]):
       x=c.capitalize();t['flow'+x]=f*1e5*(t['viscosity']*.001)*D*math.pi/4;t['temperature'+x]=T+(140 if phase=='Steam' else 0);t['z'+x]=Z;t['density'+x]=998.2 if phase=='Liquid' else rho
      target=pressure(t,state(t,'fs'),D*.5*state(t,'fs')['plateFactor'])
      for mode in ['Solve for Bore','Solve for Beta','Solve for DP','Check Existing Bore']:
       v=dict(t,tag='AUD-'+str(len(tags)+1).zfill(3),mode=mode,targetDp=target,boreMm=D*500 if mode=='Check Existing Bore' else None,beta=.5 if mode=='Solve for DP' else None)
       tags.append(v)
 return {'schemaVersion':1,'name':'Part 5 independent numerical fixtures','tags':tags}
def run_node(project,filename):
 inp=OUT/(filename+'-inputs.json');out=OUT/(filename+'-results.json');inp.write_text(json.dumps(project,indent=2)+'\n')
 subprocess.run(['node',str(ROOT/'scripts/audit-snapshot.mjs'),str(inp),str(out)],check=True)
 return json.loads(out.read_text())
def compare(snapshot,require_complete=False):
 rows=[];fail=[];counts=0;maxrel=0;casen=0
 for t,r in zip(snapshot['tags'],snapshot['results']):
  if require_complete and not r['complete']:fail.append({'tag':t['tag'],'problem':'Fixture incomplete','issues':r['issues']})
  if not r['cases']:continue
  try:ref=refbore(t)
  except Exception as e:fail.append({'tag':t['tag'],'problem':'Oracle could not solve','error':str(e)});continue
  pairs=[('referenceBoreMm',r['referenceBoreMm'],ref*1000,'tag')]
  for c,a in r['cases'].items():
   casen+=1;e=expected(t,c,ref)
   for k,b in e.items():
    if b is not None:pairs.append((k,a[k],b,c))
  for k,a,b,c in pairs:
   counts+=1;diff=abs(a-b);rel=diff/max(abs(b),1e-30);maxrel=max(maxrel,rel)
   # DP cancellation in the independent P1-P2 implementation gets an absolute floor.
   atol=1e-5 if k in ['dpPa','permanentLossPa'] else 1e-8
   ok=math.isfinite(a) and diff<=max(atol,abs(b)*1e-7)
   row={'tag':t['tag'],'case':c,'quantity':k,'node':a,'independent':b,'absoluteError':diff,'relativeError':rel,'pass':ok}
   rows.append(row)
   if not ok:fail.append(row)
 return {'tags':len(snapshot['tags']),'computedCases':casen,'comparisons':counts,'failures':fail,'maxRelativeError':maxrel,'rows':rows}
def main():
 data=run_node(fixtures(),'synthetic');syn=compare(data,True)
 wb=run_node(json.loads((ROOT/'examples/workbook-project.json').read_text()),'workbook');source=compare(wb)
 report={'kind':'Independent software implementation comparison, not standards certification or physical calibration','fluids':fluids.__version__,'scipy':scipy.__version__,'python':platform.python_version(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'formulaReference':'https://fluids.readthedocs.io/fluids.flow_meter.html','scope':'RHG comparison restricted to Node-computed cases at Re >= 5000; Fluids low-Re extensions are inactive. Supplied densities and catalog geometry are assumptions, not independent physical-property verification.','tolerance':'max(1e-8 absolute,1e-7 relative); pressure quantities use 1e-5 Pa absolute floor','synthetic':syn,'sourceWorkbook':source}
 (OUT/'independent-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
 import csv
 with (OUT/'independent-comparison.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=['group',*syn['rows'][0].keys()]);w.writeheader()
  for g,items in [('synthetic',syn['rows']),('workbook',source['rows'])]:
   for r in items:w.writerow({'group':g,**r})
 print(json.dumps({k:{x:v[x] for x in ['tags','computedCases','comparisons','maxRelativeError']}|{'failures':len(v['failures'])} for k,v in [('synthetic',syn),('workbook',source)]},indent=2))
 if syn['failures'] or source['failures']:sys.exit(1)
if __name__=='__main__':main()
