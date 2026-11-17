// Repeatable end-to-end checks against an isolated local server and temporary storage.
// No real saved projects are read or changed. Screenshots and report are overwritten.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let pw;
try { pw = await import('playwright'); }
catch (error) {
  // Optional preinstalled development runtime; ordinary installations use npm ci.
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw new Error('Run npm ci and npx playwright install chromium before this check.', {cause:error});
  pw = await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href);
}
const storage = await mkdtemp(path.join(tmpdir(),'orifice-ui-'));
process.env.ORIFICE_STORAGE_DIR = storage;
const {createServer} = await import('../src/server.ts');
const server = createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const shots = path.join(root,'screenshots/part6');
await mkdir(shots,{recursive:true});
await mkdir(path.join(root,'docs/part6'),{recursive:true});
const report = {startedAt:new Date().toISOString(),node:process.version,platform:platform(),osRelease:release(),browser:null,desktop:{width:1440,height:1050},mobile:{width:390,height:844},checks:[],pageErrors:[],consoleErrors:[],screenshots:[],limitations:['Headless Linux browser; mobile is viewport emulation, not a physical phone.','Native print dialog, Windows launcher, Firefox, Safari and Edge are not exercised.','Browser checks do not independently validate the engineering equations.']};
let browser,page;
async function check(name,fn) {
  const started=Date.now();
  try { await fn();report.checks.push({name,status:'PASS',durationMs:Date.now()-started});console.log('PASS',name); }
  catch(e) {report.checks.push({name,status:'FAIL',error:e.message});throw e;}
}
async function shot(name,fullPage=false) {
  await page.screenshot({path:path.join(shots,name),fullPage});report.screenshots.push('screenshots/part6/'+name);
}
const nav = async name=>page.locator(`[data-view="${name}"]`).click();
const fill = async (key,value)=>page.locator('#field-'+key).fill(String(value));
const select = async (key,value)=>page.locator('#field-'+key).selectOption(value);
async function demo() {await page.locator('#load-demo').click();await page.locator('#field-tag').waitFor();}
async function calculate() {
  const response=page.waitForResponse(r=>r.url().endsWith('/api/calculate')&&r.request().method()==='POST');
  await page.locator('#calculate').click();await response;
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  await page.locator('.metrics').waitFor();
}
async function noOverflow() {
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page must not overflow horizontally');
}
async function importBuffer(name,mimeType,buffer) {
  await page.locator('#file-input').setInputFiles({name,mimeType,buffer});
  await page.waitForFunction(()=>document.querySelector('#file-input').value==='');
  assert.match(await page.locator('#toast').textContent(),/^Imported /);
}
async function exported(button) {
  const event=page.waitForEvent('download');await page.locator(button).click();const d=await event;
  return {name:d.suggestedFilename(),text:await readFile(await d.path(),'utf8')};
}
function defer(){let resolve;return {promise:new Promise(r=>resolve=r),resolve:(...args)=>resolve(...args)};}
try {
  browser=await pw.chromium.launch({headless:true,...(process.env.ORIFICE_BROWSER_EXECUTABLE?{executablePath:process.env.ORIFICE_BROWSER_EXECUTABLE}:{})});
  report.browser=browser.version();
  const context=await browser.newContext({viewport:report.desktop,acceptDownloads:true});
  page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base);await page.locator('#field-tag').waitFor();
  await check('Input screen, five views and keyboard skip link',async()=>{
    assert.equal(await page.locator('#tabs button').count(),5);
    assert.equal(await page.locator('#field-tag').inputValue(),'FT-DEMO-001');
    await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to workspace');
    await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main');
    await page.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});await noOverflow();await shot('01-inputs-desktop.png');
    await page.locator('.input-matrix').scrollIntoViewIfNeeded();await shot('02-operating-cases.png');
  });
  await check('Water demo results and graphics match backend output',async()=>{
    await calculate();assert.match(await page.locator('.metric').nth(0).textContent(),/45\.497/);
    assert.match(await page.locator('.metric').nth(2).textContent(),/50kPa/);
    assert.equal(await page.locator('.diagram').count(),1);
    assert.equal(await page.locator('.bar-row').count(),4);
    assert.match(await page.locator('.traceability').textContent(),/102\.26/);
    await page.evaluate(()=>scrollTo(0,0));await shot('03-results-desktop.png');
  });
  await check('Sizing view, DP solve and existing-bore check',async()=>{
    await nav('sizing');await shot('04-sizing-desktop.png');
    await select('mode','Solve for DP');await fill('boreMm',45.49736523684261);await fill('targetDp','');await calculate();
    assert.match(await page.locator('.metric').nth(2).textContent(),/50kPa/);
    await nav('sizing');await select('mode','Check Existing Bore');await fill('targetDp',50);await calculate();
    assert.match(await page.locator('#calculation-state').textContent(),/1\/1 complete/);
    await nav('sizing');await select('mode','Solve for Beta');
    assert.equal(await page.locator('#field-boreMm').inputValue(),'');
    assert(await page.locator('#field-boreMm').isDisabled());await calculate();
    assert.match(await page.locator('.metric').nth(1).textContent(),/0\.44492/);
  });
  await check('Edits immediately invalidate calculated outputs',async()=>{
    await nav('inputs');await fill('flowFs',11);await nav('results');
    assert.equal(await page.locator('.metrics').count(),0);
    assert.match(await page.locator('#calculation-state').textContent(),/calculation required/);
    await calculate();assert.doesNotMatch(await page.locator('.metric').nth(0).textContent(),/45\.497/);
  });
  await check('Equivalent NPS/DN choice and manual ID override',async()=>{
    await demo();await select('sizeUnit','DN');assert.equal(await page.locator('#field-size').inputValue(),'100');
    await select('sizeUnit','NPS');assert.equal(await page.locator('#field-size').inputValue(),'4');
    await select('pipeIdMode','MANUAL ID');assert(await page.locator('#field-manualWtMm').isDisabled());
    await fill('manualIdMm',100);await calculate();
    assert.match(await page.locator('.traceability').textContent(),/100 mm/);
    assert.match(await page.locator('#workspace').textContent(),/Manual pipe ID is active/);
  });
  await check('Incomplete gas input has linked errors and no invented geometry',async()=>{
    await demo();await select('phase','Gas');await select('propertyBasis','MW + Z');await calculate();
    assert.match(await page.locator('.inline-actions .badge').textContent(),/FAIL/);
    assert.equal(await page.locator('.diagram').count(),0);
    assert.equal(await page.locator('.diagram-unavailable').count(),1);
    await page.locator('[data-field-link="gamma"]').first().click();
    assert.equal(await page.locator(':focus').getAttribute('id'),'field-gamma');
    assert.equal(await page.locator('#field-gamma').getAttribute('aria-invalid'),'true');
    assert(await page.locator('#error-gamma').isVisible());
  });
  await check('A delayed calculation cannot overwrite edited inputs',async()=>{
    await demo();const arrived=defer(),release=defer();
    await page.route('**/api/calculate',async route=>{const response=await route.fetch();arrived.resolve();await release.promise;await route.fulfill({response});});
    await page.locator('#calculate').click();await arrived.promise;await fill('flowFs',11);release.resolve();
    await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
    assert.match(await page.locator('#toast').textContent(),/Inputs changed during calculation/);
    await nav('results');assert.equal(await page.locator('.metrics').count(),0);await page.unroute('**/api/calculate');
  });
  await check('Save, reopen and portable JSON export',async()=>{
    await demo();await page.locator('#project-name').fill('Part 6 browser verification');
    await page.locator('#save-project').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('revision 1'));
    await page.locator('.side-bottom details').evaluate(el=>el.open=true);
    const json=JSON.parse((await exported('#download-json')).text);
    assert.equal(json.name,'Part 6 browser verification');assert(!('id' in json));assert.equal(json.tags.length,1);
    await fill('service','Unsaved temporary edit');await page.locator('#open-project').click();
    await page.locator('[data-open]').first().click();await page.locator('#projects-dialog').waitFor({state:'hidden'});assert.notEqual(await page.locator('#field-service').inputValue(),'Unsaved temporary edit');
    assert.equal(await page.locator('#projects-dialog').isVisible(),false);
    await nav('results');assert.equal(await page.locator('.metrics').count(),0);
  });
  await check('Edits made while saving remain in the draft',async()=>{
    await nav('inputs');const arrived=defer(),release=defer();
    await page.route('**/api/projects',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();arrived.resolve();await release.promise;await route.fulfill({response});});
    await page.locator('#save-project').click();await arrived.promise;await fill('service','Keep this newer edit');release.resolve();
    await page.waitForFunction(()=>!document.querySelector('#save-project').disabled);
    assert.equal(await page.locator('#field-service').inputValue(),'Keep this newer edit');
    assert.match(await page.locator('#save-state').textContent(),/Unsaved changes/);await page.unroute('**/api/projects');
    await page.locator('#save-project').click();await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('revision 3'));
  });
  await check('Stale save conflict preserves the browser draft',async()=>{
    const list=await (await fetch(base+'/api/projects')).json();const saved=await (await fetch(base+'/api/projects/'+list.projects[0].id)).json();
    const changed=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...saved,name:'Changed in another client'})});assert.equal(changed.status,200);
    await fill('service','Keep after conflict');await page.locator('#save-project').click();
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('Project changed.'));
    assert.equal(await page.locator('#field-service').inputValue(),'Keep after conflict');
    assert.match(await page.locator('#save-state').textContent(),/Unsaved changes/);
  });
  await check('JSON import and inert display of user-supplied HTML',async()=>{
    const d=JSON.parse(await readFile(path.join(root,'examples/demo-project.json'),'utf8'));
    d.tags[0].tag='<img src=x onerror="window.unwanted=1">';
    await importBuffer('browser.json','application/json',Buffer.from(JSON.stringify(d)));
    assert.equal(await page.locator('#current-tag').textContent(),d.tags[0].tag);
    assert.equal(await page.locator('#current-tag img').count(),0);assert.equal(await page.evaluate(()=>window.unwanted),undefined);
    await page.locator('#duplicate-tag').click();assert.equal(await page.locator('#tag-count').textContent(),'2');
    await page.locator('#remove-tag').click();assert.equal(await page.locator('#tag-count').textContent(),'1');
  });
  await check('Input CSV export and import retain the four flow values',async()=>{
    await demo();await page.locator('.side-bottom details').evaluate(el=>el.open=true);
    const csv=await exported('#download-inputs');assert.equal(csv.name,'orifice-inputs.csv');
    await importBuffer('browser.csv','text/csv',Buffer.from(csv.text));
    for(const [key,value] of Object.entries({flowMin:'2',flowNormal:'5',flowMax:'8',flowFs:'10'}))assert.equal(await page.locator('#field-'+key).inputValue(),value);
  });
  await check('Updated XLSX import, all 66 tags and batch status filters',async()=>{
    await importBuffer('updated.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',await readFile(path.join(root,'source/workbook.xlsx')));
    assert.equal(await page.locator('#tag-count').textContent(),'66');await calculate();await nav('batch');
    assert.match(await page.locator('.card-header').textContent(),/37 numerically complete/);
    assert.equal(await page.locator('tbody tr').count(),66);
    await page.locator('[data-filter="FAIL"]').click();assert.equal(await page.locator('tbody tr').count(),32);
    await page.locator('[data-filter="CHECK"]').click();assert.equal(await page.locator('tbody tr').count(),34);
    await page.locator('[data-filter="all"]').click();await page.evaluate(()=>scrollTo(0,0));await shot('05-project-overview.png');
    await page.locator('.batch-tag').first().click();assert.equal(await page.locator('.metrics').count(),1);
    await page.locator('#tag-search').fill('FEH3F1003');assert.equal(await page.locator('.tag-item').count(),1);await page.locator('#tag-search').fill('');
  });
  await check('Results CSV download and source/method view',async()=>{
    const csv=await exported('[data-action="results-csv"]');assert.equal(csv.name,'orifice-results.csv');
    assert.match(csv.text,/FEH3F1003/);assert(csv.text.split('\n').length>66);
    await nav('reference');assert.match(await page.locator('#workspace').textContent(),/Earlier revisions are not retained/);
  });
  await check('Mobile inputs, project panel and results without page overflow',async()=>{
    await demo();await page.setViewportSize(report.mobile);await noOverflow();
    assert.equal(await page.locator('#project-panel').isVisible(),false);
    await page.locator('#project-toggle').click();assert.equal(await page.locator('#project-panel').isVisible(),true);
    await page.locator('#project-toggle').click();await page.evaluate(()=>scrollTo(0,0));await shot('06-inputs-mobile.png');
    await calculate();await noOverflow();await page.evaluate(()=>scrollTo(0,0));await shot('07-results-mobile.png',true);
    assert(await page.locator('.table-scroll').first().evaluate(el=>el.scrollWidth>el.clientWidth));
    await page.setViewportSize(report.desktop);
  });
  await check('Print CSS and generated PDF include results and input context',async()=>{
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#project-panel').isVisible(),false);
    assert.equal(await page.locator('#tabs').isVisible(),false);
    assert(await page.locator('.report-heading').isVisible());
    assert(await page.locator('.traceability').isVisible());
    await page.pdf({path:path.join(shots,'08-demo-print.pdf'),preferCSSPageSize:true,printBackground:true});
    report.screenshots.push('screenshots/part6/08-demo-print.pdf');await page.emulateMedia({media:'screen'});
  });
  await check('No uncaught browser errors or unexpected console/CSP errors',async()=>{
    assert.deepEqual(report.pageErrors,[]);
    report.expectedConflictConsoleErrors=report.consoleErrors.filter(x=>/409/.test(x));
    assert.deepEqual(report.consoleErrors.filter(x=>!/409/.test(x)),[]);
  });
  report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);
  if(page)await page.screenshot({path:path.join(shots,'failure.png'),fullPage:true}).catch(()=>{});
} finally {
  report.finishedAt=new Date().toISOString();report.passed=report.checks.filter(x=>x.status==='PASS').length;
  await writeFile(path.join(root,'docs/part6/browser-report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(path.join(root,'docs/part6/browser-checks.txt'),report.checks.map(c=>c.status+' '+c.name).join('\n')+'\n'+`${report.status}: ${report.passed}/${report.checks.length}; browser ${report.browser}; ${report.finishedAt}\n`);
  await browser?.close();await new Promise(resolve=>server.close(resolve));await rm(storage,{recursive:true,force:true});
  console.log(`${report.status}: ${report.passed}/${report.checks.length} browser checks; browser ${report.browser}`);
}
