const $ = s => document.querySelector(s);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v, digits = 3) => Number.isFinite(v) ? v.toLocaleString('en-US',{maximumFractionDigits:digits}) : '—';
const cases = ['min','normal','max','fs'];
const names = {min:'Minimum',normal:'Normal',max:'Maximum',fs:'Full scale'};
const cap = s => s[0].toUpperCase() + s.slice(1);
let catalog, project, selected = 0, view = 'inputs', results = null, dirty = true, busy = false;
let toastTimer, generation = 0, edits = 0, saving = false, calculatedAt = null, batchFilter = 'all';
function toast(message) {$('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('show'),6500);}
async function api(path, data, options = {}) {
  const response = await fetch(path, data === undefined ? options : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),...options});
  const type = response.headers.get('content-type') || '';
  const value = type.includes('json') ? await response.json() : await response.text();
  if(!response.ok) throw new Error(value.error || `Request failed (${response.status}).`);
  return value;
}
function tag() {return project.tags[selected];}
function result() {return results?.[selected];}
function badge(status = 'DRAFT') {return `<span class="badge ${escape(status)}">${escape(status)}</span>`;}
function clearToast(){clearTimeout(toastTimer);$('#toast').classList.remove('show');}
function invalidate() {clearToast();edits++; results = null; calculatedAt = null; dirty = true; renderSidebar(); renderHeading();}
function replaceProject(p) {if(!p || !Array.isArray(p.tags) || p.tags.length > 500 || p.tags.some(t=>!t || typeof t !== 'object' || Array.isArray(t))) throw new Error('Project must contain up to 500 tag objects.');if(p.schemaVersion !== undefined && p.schemaVersion !== 1) throw new Error('Unsupported project schema.');if(p.name !== undefined && (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 160)) throw new Error('Project name must contain 1 to 160 characters.');clearToast();generation++;edits++;project = {...p,schemaVersion:1,name:p.name || 'Imported project'};selected=0;results=null;calculatedAt=null;batchFilter='all';dirty=!p.id;view='inputs';$('#project-name').value=project.name;render();}
function replaceAllowed() {return !dirty || window.confirm('Replace this unsaved draft? Export JSON or save first if you want to keep it.');}
function renderHeading() {$('#current-tag').textContent=tag()?.tag || 'Untitled tag';$('#current-service').textContent=tag()?.service || 'Define process conditions, then calculate.';$('#save-state').textContent=dirty?'Unsaved changes':`Saved · revision ${project.revision || 1}`;$('#calculation-state').textContent=results?`Calculated · ${results.filter(r=>r.complete).length}/${results.length} complete`:'Inputs changed · calculation required';}
function renderSidebar() {
  $('#tag-count').textContent=project.tags.length;
  const term=$('#tag-search').value.toLowerCase();
  $('#tag-list').innerHTML=project.tags.map((t,i)=>({t,i})).filter(({t})=>`${t.tag} ${t.service}`.toLowerCase().includes(term)).map(({t,i})=>`<button class="tag-item ${i===selected?'active':''}" data-select="${i}"><span><strong>${escape(t.tag || 'Untitled tag')}</strong><small>${escape(t.service || t.fluid || 'No service entered')}</small></span>${badge(results?.[i]?.status)}</button>`).join('') || '<p class="muted tiny">No matching tags.</p>';
}
const labels = {tag:'Tag number',pipeStandard:'Pipe dimensional standard',sizeUnit:'Nominal size system',size:'Nominal size',schedule:'Schedule',pipeIdMode:'Pipe ID source',manualWtMm:'Manual wall thickness (mm)',manualIdMm:'Manual inside diameter (mm)',pipeAlpha:'Pipe expansion coefficient (1/K)',plateAlpha:'Plate expansion coefficient (1/K)',roughnessUm:'Pipe roughness (µm)',propertyBasis:'Operating property basis',specificGravity:'Specific gravity (water / air)',molecularWeight:'Molecular weight (kg/kmol)',gamma:'Isentropic exponent, κ',basePressureKpa:'Base pressure (kPa absolute)',baseTemperatureC:'Base temperature (°C)',baseZ:'Base compressibility, Z',baseDensity:'Reference density (kg/m³)',propertySource:'Property source / reference',targetDp:'Target full-scale DP',boreMm:'Input reference bore (mm)',beta:'Input reference beta',betaMin:'Minimum beta',betaMax:'Maximum beta',minDp:'Minimum full-scale DP',maxDp:'Maximum max-flow DP',pipeVelocityLimit:'Pipe velocity limit (m/s)',boreVelocityLimit:'Bore velocity limit (m/s)',existingTolerancePct:'Existing-bore tolerance (%)',requiredUpstreamD:'Required upstream run (D)',requiredDownstreamD:'Required downstream run (D)',availableUpstreamD:'Available upstream run (D)',availableDownstreamD:'Available downstream run (D)',manualCd:'Manual discharge coefficient',thermalExpansion:'Apply thermal expansion',taps:'Pressure tap arrangement',dpUnit:'Differential pressure unit'};
function choices(f) {
  if(f.key==='size')return [...new Set(catalog.pipes.filter(p=>p.standard===tag().pipeStandard).map(p=>String(p[tag().sizeUnit==='DN'?'dn':'nps'])))];
  if(f.key==='schedule')return [...new Set(catalog.pipes.filter(p=>p.standard===tag().pipeStandard && String(p[tag().sizeUnit==='DN'?'dn':'nps'])===String(tag().size)).map(p=>p.schedule))];
  if(f.key==='propertyBasis')return tag().phase==='Liquid'?['Direct Density','Manual Properties','Specific Gravity']:tag().phase==='Gas'?['Direct Density','Manual Properties','MW + Z','Gas SG + Z']:['Direct Density','Manual Properties'];
  return f.choices;
}
function inactive(key) {
  const t=tag(),target=['Solve for Bore','Solve for Beta'].includes(t.mode);
  if(key==='manualWtMm')return t.pipeIdMode!=='MANUAL WT';
  if(key==='manualIdMm')return t.pipeIdMode!=='MANUAL ID';
  if(key==='manualCd')return t.cdMode!=='Manual';
  if(['pipeAlpha','plateAlpha'].includes(key))return t.thermalExpansion!=='YES';
  if(['boreMm','beta'].includes(key))return target || (key==='beta' && t.mode==='Check Existing Bore');
  if(key==='specificGravity')return !['Specific Gravity','Gas SG + Z'].includes(t.propertyBasis);
  if(key==='gamma')return t.phase==='Liquid';
  if(/^z(Min|Normal|Max|Fs)$/.test(key))return !['MW + Z','Gas SG + Z'].includes(t.propertyBasis);
  if(/^density(Min|Normal|Max|Fs)$/.test(key))return !['Direct Density','Manual Properties'].includes(t.propertyBasis);
  if(key==='molecularWeight')return t.propertyBasis!=='MW + Z' && !['base volume'].includes(catalog.units.find(u=>u.quantity==='Flow' && u.unit===t.flowUnit)?.basis);
  return false;
}
function control(f, compact=false) {
  const value=tag()[f.key], options=choices(f), disabled=inactive(f.key), err=result()?.issues.find(i=>i.field===f.key && i.severity==='FAIL'), attrs=`id="field-${f.key}" data-field="${f.key}" ${err?'aria-invalid="true" aria-describedby="error-'+f.key+'"':''} ${disabled?'disabled':''}`;
  if(options) {
    const available=options.map(String), original=value==null?'':String(value);
    return `<select ${attrs} aria-label="${escape(labels[f.key] || f.label)}"><option value="">Select…</option>${original && !available.includes(original)?`<option selected value="${escape(original)}">${escape(original)} (check)</option>`:''}${available.map(o=>`<option value="${escape(o)}" ${original===o?'selected':''}>${escape(o)}</option>`).join('')}</select>`;
  }
  if(['note','propertySource'].includes(f.key))return `<textarea ${attrs} aria-label="${escape(labels[f.key] || f.label)}">${escape(value)}</textarea>`;
  return `<input ${attrs} aria-label="${escape(labels[f.key] || f.label)}" type="${f.type==='number'?'number':'text'}" ${f.type==='number'?'step="any"':''} value="${escape(value)}" ${compact?'':'autocomplete="off"'}>`;
}
function field(f) {const err=result()?.issues.find(i=>i.field===f.key && i.severity==='FAIL');return `<div class="field ${['note','propertySource'].includes(f.key)?'wide':''} ${err?'error':''}"><label for="field-${f.key}">${escape(labels[f.key] || f.label)}</label>${control(f)}${err?`<small class="field-error" id="error-${f.key}">${escape(err.message)}</small>`:''}</div>`;}
function guidance() {
  return `<div class="workflow-hint"><strong>1. Process inputs</strong><span>2. Sizing objective</span><span>3. Calculate & review</span></div><p class="note">Units describe the entered numbers. Changing a unit does not convert stored values. Disabled fields are retained but inactive for the selected method.</p>`;
}
function section(title,subtitle,items,number='') {return `<section class="card"><div class="card-header"><div><h2>${escape(title)}</h2><p>${escape(subtitle)}</p></div>${number?`<span class="step-dot">${number}</span>`:''}</div><div class="form-grid">${items.map(field).join('')}</div></section>`;}
function fieldsIn(sectionName) {return catalog.fields.filter(f=>f.section===sectionName);}
function matrix() {
  const rows=[['flow','Flow',tag().flowUnit],['temperature','Temperature',tag().temperatureUnit],['pressure','Upstream pressure',tag().pressureUnit],['density','Operating density',tag().densityUnit],['z','Compressibility, Z','dimensionless']];
  return `<section class="card"><div class="card-header"><div><h2>Operating envelope</h2><p>Use one unit per row. Enter each condition; blanks are not assumed to be zero.</p></div><span class="step-dot">04</span></div><div class="form-grid">${['flowUnit','temperatureUnit','pressureUnit','densityUnit'].map(k=>field(catalog.fields.find(f=>f.key===k))).join('')}</div><div class="table-scroll"><table class="case-table input-matrix"><thead><tr><th>Process variable</th>${cases.map(c=>`<th>${names[c]}</th>`).join('')}</tr></thead><tbody>${rows.map(([k,label,unit])=>`<tr><th scope="row">${label}<span class="unit">${escape(unit)}</span></th>${cases.map(c=>`<td>${control(catalog.fields.find(f=>f.key===k+cap(c)),true)}${result()?.issues.some(i=>i.field===k+cap(c)&&i.severity==='FAIL')?`<small class="field-error" id="error-${k+cap(c)}">Check ${label.toLowerCase()} for ${names[c].toLowerCase()}.</small>`:''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
function inputsView() {
  const fluid=fieldsIn('Fluid properties').filter(f=>!/^density|^z(Min|Normal|Max|Fs)$/.test(f.key));
  return guidance() + section('Tag & service','Identify the measurement and fluid phase.',fieldsIn('Identification'),'01') + section('Pipe geometry','Dimensions resolve from the supplied pipe table. Confirm the governing edition before approval.',fieldsIn('Pipe geometry'),'02') + section('Fluid property method','Properties must come from an identified source at the stated conditions.',fluid,'03') + matrix() + '<div class="stack">' + ['Thermal expansion','Installation','Record'].map(s=>`<details><summary>${s}</summary><div class="form-grid">${fieldsIn(s).map(field).join('')}</div></details>`).join('') + '</div>';
}
function sizingView() {return section('Sizing objective','Bore and beta inputs refer to 20 °C. The target DP applies at full-scale conditions.',fieldsIn('Sizing settings'),'01') + '<div class="notice">For Solve for DP, supply either bore or beta and clear the other. Changing the solve mode clears incompatible geometry inputs. Grey fields are inactive.</div>' + section('Project acceptance limits','Blank or zero DP and velocity limits disable those project checks. Beta bounds always apply.',fieldsIn('Project limits'),'02');}
function metric(label,value,unit,sub,accent=false) {return `<div class="metric ${accent?'accent':''}"><div class="label">${label}</div><div class="value">${value}<small>${unit}</small></div><div class="sub">${sub}</div></div>`;}
function issueList(r) {return r.issues.map(i=>`<div class="issue">${badge(i.severity)}<div><p>${escape(i.message)}</p><small>${escape(i.code)}${i.case?' · '+names[i.case]:''}${i.field?' · '+escape(labels[i.field] || i.field):''}</small>${i.field && catalog.fields.some(f=>f.key===i.field)?`<button class="issue-link" data-field-link="${escape(i.field)}">Review field →</button>`:''}</div></div>`).join('');}
function traceability(r) {
  const t=tag();
  const pairs=[['Project',project.name],['Tag',t.tag],['Fluid / phase',`${t.fluid || '—'} / ${t.phase || '—'}`],['Sizing mode',t.mode],['Pipe selection',`${t.pipeStandard} · ${t.sizeUnit} ${t.size} · Sch ${t.schedule}`],['Reference OD / WT / ID',r.geometry?`${fmt(r.geometry.odMm)} / ${fmt(r.geometry.wtMm)} / ${fmt(r.geometry.idMm)} mm`:'Unavailable'],['Pipe ID source',t.pipeIdMode],['Property basis',t.propertyBasis],['Property reference',t.propertySource],['Target DP',`${fmt(t.targetDp,4)} ${t.dpUnit}`],['Viscosity',`${fmt(t.viscosity,6)} ${t.viscosityUnit}`],['Thermal expansion',t.thermalExpansion],['Calculated at (UTC)',calculatedAt],['Engine / project revision',`${r.engineVersion} / ${dirty?'unsaved draft':('saved revision '+project.revision)}`]];
  return `<section class="card traceability"><h2>Calculation record</h2><p class="note">Input context for this calculation. Export project JSON to preserve all editable fields.</p><dl class="record-grid">${pairs.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v || '—')}</dd></div>`).join('')}</dl><p class="mono">Source SHA-256: ${escape(r.sourceHash)}</p><details><summary>Solver diagnostics</summary><div class="table-scroll"><table class="case-table"><thead><tr><th>Case</th><th>Iterations</th><th>Mass residual (kg/s)</th></tr></thead><tbody>${cases.map(c=>`<tr><th>${names[c]}</th><td>${fmt(r.cases[c]?.iterations,0)}</td><td>${Number.isFinite(r.cases[c]?.residualKgS)?r.cases[c].residualKgS.toExponential(3):'—'}</td></tr>`).join('')}</tbody></table></div><p class="note">${r.solver?`Sizing solver: ${escape(r.solver.method)} · ${fmt(r.solver.iterations,0)} iterations · residual ${escape(r.solver.residual)} kg/s`:'No target-bore solver record for this calculation.'}</p></details></section>`;
}
function schematic(r) {if(!Number.isFinite(r.fsBeta) || !r.cases.fs)return '<div class="diagram-unavailable">Geometry preview requires a calculated full-scale case.</div>';const b=r.fsBeta, gap=90*b, top=100-gap/2,bottom=100+gap/2;return `<svg class="diagram" viewBox="0 0 450 200" role="img" aria-label="Orifice section with full-scale bore proportional to pipe ID; axial lengths are schematic"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#087f72"/></marker></defs><path d="M35 55H415M35 145H415" stroke="#728c9a" stroke-width="9"/><path d="M221 48V${top}M221 ${bottom}V152" stroke="#087f72" stroke-width="12"/><path d="M40 100H192M250 100H375" stroke="#087f72" stroke-width="2" marker-end="url(#arrow)"/><path d="M35 100H415" stroke="#b7c9d0" stroke-dasharray="3 5"/><path d="M105 55V28H152M337 55V28H290" fill="none" stroke="#b7c9d0"/><text x="40" y="22">UPSTREAM</text><text x="309" y="22">DOWNSTREAM</text><text x="35" y="178">Operating ID ${fmt(r.cases.fs?.pipeM*1000)} mm</text><text x="252" y="178">Bore ${fmt(r.cases.fs?.boreMm)} mm</text><text x="168" y="196">Full-scale section · schematic</text></svg>`;}
function resultsView() {
  const r=result();if(!r)return '<div class="empty"><div class="empty-icon">◎</div><h2>Ready when your inputs are.</h2><p>Calculate the project to resolve geometry and inspect all four operating cases.</p><button class="primary" data-action="calculate">Calculate project ↗</button></div>';
  const fs=r.cases.fs,max=Math.max(...cases.map(c=>r.cases[c]?.dp||0),1);
  const rows=[['dp','Differential pressure',r.dpUnit,4],['permanentLoss','Permanent pressure loss',r.dpUnit,4],['massKgS','Mass flow','kg/s',6],['density','Density','kg/m³',4],['boreMm','Operating bore','mm',4],['beta','Operating beta','—',6],['cd','Discharge coefficient','—',6],['y','Expansibility','—',6],['re','Reynolds number','—',0],['pipeVelocity','Pipe velocity','m/s',4],['boreVelocity','Bore velocity','m/s',4],['pressureRatio','Downstream / upstream','—',6]];
  return `<div class="inline-actions"><button data-action="print">Print / save as PDF</button><button data-action="results-csv">Download all result rows</button>${badge(r.status)}</div><div class="report-heading">${escape(project.name)} · ${escape(calculatedAt)} · engine ${escape(r.engineVersion)} · ENGINEERING REVIEW PENDING</div>${r.complete?'':'<div class="notice">Calculation incomplete. Review the issues below; unavailable outputs are shown as dashes.</div>'}<div class="metrics">${metric('Reference bore',fmt(r.referenceBoreMm),'mm','At 20 °C',true)}${metric('Full-scale beta',fmt(r.fsBeta,5),'','Operating diameter ratio')}${metric('Full-scale DP',fmt(fs?.dp,4),escape(r.dpUnit),'Computed from mass flow')}${metric('Full-scale Cd',fmt(fs?.cd,6),'',escape(tag().cdMode || ''))}</div><div class="result-grid"><section class="card"><h2>Orifice geometry</h2><p class="note">${escape(tag().taps)} · ${escape(tag().boreConfiguration)}</p>${schematic(r)}</section><section class="card"><h2>DP across the operating range</h2><p class="note">${escape(r.dpUnit)} · four discrete operating cases</p>${cases.map(c=>`<div class="bar-row"><span>${names[c]}</span><svg viewBox="0 0 100 9" preserveAspectRatio="none" height="9" width="100%" aria-hidden="true"><rect width="100" height="9" rx="4" fill="#ebf0f2"/><rect width="${(r.cases[c]?.dp||0)/max*100}" height="9" rx="4" fill="#087f72"/></svg><strong>${fmt(r.cases[c]?.dp,3)}</strong></div>`).join('')}</section></div><section class="card"><div class="card-header"><div><h2>Calculated operating cases</h2><p>Values use unrounded calculations; display precision does not change the result.</p></div></div><div class="table-scroll"><table class="case-table results"><thead><tr><th>Result</th>${cases.map(c=>`<th>${names[c]}</th>`).join('')}</tr></thead><tbody>${rows.map(([k,label,u,d])=>`<tr><th scope="row">${label}<span class="unit">${escape(u)}</span></th>${cases.map(c=>`<td>${fmt(r.cases[c]?.[k],d)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section><section class="card"><h2>Validation & review notes</h2><p class="note">${r.complete?'All four cases computed.':'Some or all cases could not be computed.'} CHECK requires review; numerical completion is separate from approval.</p>${issueList(r)}</section>${traceability(r)}`;
}
function batchView() {
 const counts={all:project.tags.length,DRAFT:0,CHECK:0,FAIL:0,HOLD:0,PASS:0};
 project.tags.forEach((_,i)=>counts[results?.[i]?.status || 'DRAFT']++);
 return `<section class="card"><div class="card-header"><div><h2>Project overview</h2><p>${project.tags.length} tags · ${results?results.filter(r=>r.complete).length+' numerically complete':'Calculation pending'}</p></div><button data-action="results-csv">Results CSV</button></div><div class="filters" role="group" aria-label="Filter tags by status">${['all','FAIL','CHECK','HOLD','PASS','DRAFT'].filter(k=>k==='all'||counts[k]).map(k=>`<button data-filter="${k}" aria-pressed="${k===batchFilter}" class="${k===batchFilter?'selected':''}">${k==='all'?'All tags':k} <b>${counts[k]}</b></button>`).join('')}</div><div class="table-scroll"><table class="case-table results"><thead><tr><th>Tag</th><th>Phase / mode</th><th>Bore (mm)</th><th>FS DP</th><th>Cases</th><th>Status</th></tr></thead><tbody>${project.tags.map((t,i)=>{const r=results?.[i];if(batchFilter!=='all' && (r?.status || 'DRAFT')!==batchFilter)return '';return `<tr><td><button class="batch-tag" data-result-index="${i}">${escape(t.tag || 'Untitled tag')}</button></td><td>${escape(t.phase)}<span class="unit">${escape(t.mode)}</span></td><td>${fmt(r?.referenceBoreMm)}</td><td>${fmt(r?.cases.fs?.dp,4)} ${escape(t.dpUnit)}</td><td>${r?Object.keys(r.cases).length+'/4':'—'}</td><td>${badge(r?.status)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function referenceView() {return `<section class="card"><h2>Source workbook</h2><p class="note">Working tool 2026.09.20(4).xlsx · 66 populated tags · 79 editable fields · 355 pipe records · 49 unit conversions.</p><p class="mono">SHA-256: ${escape(catalog.manifest.sha256)}</p><h3>Calculation method</h3><p class="note">SI normalization → pipe lookup → fluid properties → mass flow → operating dimensions → bore / DP solver → project checks. The server is the only calculation authority. See the supplied development guide, source manifest and field mapping for traceability.</p><h3>Supported scope</h3><p class="note">Concentric square-edged plates, flange / corner / D and D/2 taps, four solve modes, liquid and single-phase gas or steam with supplied properties. Automatic steam tables, two-phase flow, uncertainty calculation and full standards applicability are not implemented.</p><h3>Review boundary</h3><p class="note">This release is an executable workbook migration. Every calculated result remains marked for engineering review. The inherited Reynolds threshold and straight-run screening are not a complete ISO applicability assessment. CONVAL and Emerson comparisons have not been performed. Property and dimensional references must be checked for each project.</p><h3>Import and saving</h3><p class="note">XLSX import accepts the supplied workbook layout and literal editable values; it rejects formulas in editable input cells. Pipe and unit catalogs remain versioned with the app. JSON preserves inputs and notes. CSV is a tabular exchange; spreadsheet formula-like text is escaped on export. Save project keeps the latest input snapshot on this computer and increments its revision. Earlier revisions are not retained; results are recalculated when opened. Export JSON for a portable backup.</p><p><a href="https://www.iso.org/standard/79180.html" target="_blank" rel="noopener">ISO 5167-2 scope</a> · <a href="https://nodejs.org/api/typescript.html" target="_blank" rel="noopener">Node.js TypeScript execution</a></p></section>`;}
function renderWorkspace() {$('#workspace').innerHTML=project.tags.length?({inputs:inputsView,sizing:sizingView,results:resultsView,batch:batchView,reference:referenceView}[view]()) : '<div class="empty"><h2>No tags yet.</h2><p>Add a tag from the sidebar to start a calculation.</p></div>';$('#tabs').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});}
function render() {renderHeading();renderSidebar();renderWorkspace();}
async function calculate() {
  if(busy)return;busy=true;$('#calculate').disabled=true;$('#calculate').textContent='Calculating…';
  const g=generation,v=edits;
  try {
    const response=await api('/api/calculate',{tags:structuredClone(project.tags)});
    if(g!==generation || v!==edits){toast('Inputs changed during calculation. Calculate again for the current draft.');return;}
    results=response.results;calculatedAt=new Date().toISOString();view='results';render();
    toast(`${results.filter(r=>r.complete).length} of ${results.length} tags numerically complete. Review validation notes.`);
  }catch(e){toast(e.message);}finally{busy=false;$('#calculate').disabled=false;$('#calculate').textContent='Calculate project ↗';}
}
async function saveProject() {
  if(saving)return;saving=true;$('#save-project').disabled=true;
  const g=generation,v=edits;
  try {
    const p=await api('/api/projects',structuredClone(project));
    if(g!==generation){toast('Previous project snapshot saved. Your current project is unchanged.');return;}
    if(v!==edits){Object.assign(project,{id:p.id,revision:p.revision,updatedAt:p.updatedAt});dirty=true;toast('Snapshot saved. Newer edits are still unsaved.');}
    else {project=p;dirty=false;$('#project-name').value=project.name;toast('Project saved.');}
    renderHeading();if(view==='results')renderWorkspace();
  }catch(e){toast(e.message);}finally{saving=false;$('#save-project').disabled=false;}
}
function replacementStamp(){return `${generation}:${edits}`;}
function applyLoaded(p,stamp){if(stamp!==replacementStamp())throw new Error('The draft changed while loading. Import or open again when ready.');replaceProject(p);}
function focusField(key) {
  const f=catalog.fields.find(f=>f.key===key);if(!f)return;
  view=['Sizing settings','Project limits'].includes(f.section)?'sizing':'inputs';renderWorkspace();
  const el=$('#field-'+key);if(!el)return;
  let parent=el.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
  el.scrollIntoView({block:'center'});el.focus();
}
function download(content,name,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportCSV(kind) {try{const content=await api('/api/export/'+kind,{schemaVersion:1,name:project.name,tags:project.tags});download(content,`orifice-${kind}.csv`,'text/csv');}catch(e){toast(e.message);}}
function uniqueName(base) {let name=base,n=2;while(project.tags.some(t=>String(t.tag ?? '').toLowerCase()===name.toLowerCase()))name=base+'-'+n++;return name;}
function wire() {
  $('#tag-list').addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b){selected=Number(b.dataset.select);render();}});
  $('#tag-search').addEventListener('input',renderSidebar);
  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){view=b.dataset.view;renderWorkspace();}});
  function updateField(e) {
    const key=e.target.dataset.field;if(!key)return;
    if(e.type==='input' && e.target.tagName==='SELECT')return;
    if(e.type==='change' && e.target.tagName!=='SELECT')return;
    const f=catalog.fields.find(f=>f.key===key),raw=e.target.value;
    const t=tag(),oldPipe=catalog.pipes.find(p=>p.standard===t.pipeStandard && String(p[t.sizeUnit==='DN'?'dn':'nps'])===String(t.size) && p.schedule===t.schedule);
    t[key]=raw===''?null:f.type==='number'?Number(raw):raw;
    if(key==='mode') {if(['Solve for Bore','Solve for Beta'].includes(raw)){t.boreMm=null;t.beta=null;}if(raw==='Check Existing Bore')t.beta=null;}
    if(key==='sizeUnit' && oldPipe)t.size=String(oldPipe[raw==='DN'?'dn':'nps']);
    if(['pipeStandard','sizeUnit','size'].includes(key)){
      const sizes=choices(catalog.fields.find(f=>f.key==='size'));
      if(!sizes.includes(String(t.size)))t.size=sizes[0]||null;
      const schedules=choices(catalog.fields.find(f=>f.key==='schedule'));
      if(!schedules.includes(t.schedule))t.schedule=schedules[0]||null;
    }
    invalidate();
    if(e.target.tagName==='SELECT')renderWorkspace();
    else {$('#workspace').querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});$('#workspace').querySelectorAll('.field-error').forEach(el=>el.remove());$('#workspace').querySelectorAll('.field.error').forEach(el=>el.classList.remove('error'));}
  }
  $('#workspace').addEventListener('input',updateField);
  $('#workspace').addEventListener('change',updateField);
  $('#workspace').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.filter){batchFilter=b.dataset.filter;renderWorkspace();}if(b.dataset.fieldLink)focusField(b.dataset.fieldLink);if(b.dataset.action==='calculate')calculate();if(b.dataset.action==='print')window.print();if(b.dataset.action==='results-csv')exportCSV('results');if(b.dataset.resultIndex!==undefined){selected=Number(b.dataset.resultIndex);view='results';render();}});
  $('#calculate').onclick=calculate;
  $('#project-name').oninput=e=>{project.name=e.target.value;edits++;dirty=true;renderHeading();if(view==='results')renderWorkspace();};
  $('#add-tag').onclick=()=>{if(project.tags.length>=500)return toast('This release supports 500 tags per project.');const t=structuredClone(catalog.demo);t.tag=uniqueName('FT-NEW');project.tags.push(t);selected=project.tags.length-1;invalidate();view='inputs';render();toast('Added a demo-based tag. Replace the sample process values.');};
  $('#duplicate-tag').onclick=()=>{if(!tag() || project.tags.length>=500)return;const t=structuredClone(tag());t.tag=uniqueName((t.tag||'TAG')+'-COPY');project.tags.push(t);selected=project.tags.length-1;invalidate();render();};
  $('#remove-tag').onclick=()=>{if(tag() && window.confirm(`Remove ${tag().tag || 'this tag'} from the draft?`)){project.tags.splice(selected,1);selected=Math.max(0,selected-1);invalidate();render();}};
  $('#save-project').onclick=saveProject;
  $('#load-demo').onclick=()=>{if(replaceAllowed())replaceProject({schemaVersion:1,name:'Water flow demonstration',tags:[structuredClone(catalog.demo)]});};
  $('#load-workbook').onclick=async()=>{if(!replaceAllowed())return;const stamp=replacementStamp();try{applyLoaded(await api('/api/workbook'),stamp);toast('Loaded 66 tags from the updated workbook. Source inputs are preserved.');}catch(e){toast(e.message);}};
  $('#download-json').onclick=()=>{const {id,revision,updatedAt,...portable}=project;download(JSON.stringify(portable,null,2),'orifice-project.json','application/json');};
  $('#download-inputs').onclick=()=>exportCSV('inputs');$('#download-results').onclick=()=>exportCSV('results');
  $('#import-project').onclick=()=>$('#file-input').click();
  $('#file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(!replaceAllowed())return;const stamp=replacementStamp();if(file.size>32*1024*1024)throw new Error('File exceeds 32 MB.');const ext=file.name.split('.').pop().toLowerCase();let p;
    if(ext==='xlsx')p=await api('/api/import/xlsx',undefined,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:await file.arrayBuffer()});
    else if(ext==='csv')p={schemaVersion:1,name:file.name,tags:(await api('/api/import/csv',{text:await file.text()})).tags};
    else if(ext==='json'){p=JSON.parse(await file.text());delete p.id;delete p.revision;delete p.updatedAt;}else throw new Error('Choose XLSX, JSON or CSV.');applyLoaded(p,stamp);toast(`Imported ${p.tags.length} tags. Review conditions before calculating.`);
  }catch(error){toast(error.message);}finally{e.target.value='';}};
  $('#open-project').onclick=async()=>{try{const list=(await api('/api/projects')).projects;$('#saved-projects').innerHTML=list.length?list.map(p=>`<div class="saved-project"><div><strong>${escape(p.name)}</strong><small>${p.tagCount} tags · revision ${p.revision} · ${escape(p.updatedAt.slice(0,10))}</small></div><button data-open="${escape(p.id)}">Open</button></div>`).join(''):'<p class="muted">No saved projects yet.</p>';$('#projects-dialog').showModal();}catch(e){toast(e.message);}};
  $('#saved-projects').onclick=async e=>{const b=e.target.closest('[data-open]');if(b && replaceAllowed()){const stamp=replacementStamp();try{applyLoaded(await api('/api/projects/'+b.dataset.open),stamp);$('#projects-dialog').close();}catch(error){toast(error.message);}}};
  $('#project-toggle').onclick=()=>{const expanded=$('#project-toggle').getAttribute('aria-expanded')!=='true';$('#project-toggle').setAttribute('aria-expanded',String(expanded));document.body.classList.toggle('project-expanded',expanded);};
  $('#close-dialog').onclick=()=>$('#projects-dialog').close();
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
}
try {catalog=await api('/api/catalog');project={schemaVersion:1,name:'Water flow demonstration',tags:[structuredClone(catalog.demo)]};$('#project-name').value=project.name;wire();render();}catch(e){$('#current-tag').textContent='Could not load workspace';$('#workspace').textContent=e.message;}
