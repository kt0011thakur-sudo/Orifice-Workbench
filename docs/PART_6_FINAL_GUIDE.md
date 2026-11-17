# Part 6 - Final assembly and Gemini handoff

**Orifice Workbench | Engine 0.2.0 | 3 October 2026**

This completes the six software delivery parts. The ZIP contains all runnable source, the original workbook and the guides. You do not need to copy code from chat or merge earlier packages. Engineering release remains **HOLD**, with **engineeringVerified: false**.

## 1. What is included

| Requirement | Implementation |
| --- | --- |
| Excel calculation logic in Node | src/engine.ts, src/equations.ts and JSON catalogs |
| Graphics and workflow | Five views, responsive inputs/results, SVG section, DP bars and print layout |
| Backend | Local HTTP APIs, imports, exports and project snapshots |
| Data exchange | Matching-layout XLSX, CSV and portable project JSON |
| Verification | Node tests, browser checks and retained separate numerical-audit evidence |
| Continuation | Six-part guides, field map, original workbook and Gemini prompts |

The source has 66 tags, 79 editable fields, 355 pipe records and 49 unit records. The API accepts up to 500 tags; 500-tag performance and concurrency have not been load-tested.

Part 6 adds startup diagnostics, package integrity checking, six startup tests, final instructions and a calculation-record CSS wrapping fix. The engine, HTTP API implementation, importers, catalogs and example inputs are unchanged from Part 5. Their preservation is recorded in **docs/part6/release-manifest.json**.

## 2. Install and start

### Windows

1. Use the [official Node download page](https://nodejs.org/en/download). Select **major 24, at least 24.12.0**, and the installer matching your Windows architecture. A newer major is not automatically supported.
2. Complete installation, then reopen your terminal so Node is on PATH.
3. Right-click **Orifice_Part_6_Complete_Package.zip > Extract All**. Choose a writable user folder such as Documents.
4. Open Command Prompt inside the inner **orifice-part-6** folder containing package.json. Do not run from inside the ZIP.
5. Run these commands one at a time:

~~~bat
node --version
npm run verify:package
npm run doctor
npm test
npm start
~~~

6. Open <http://127.0.0.1:3000>. Keep the terminal open.
7. On later visits, double-click **Start-Windows.bat** and open the printed address.
8. Save/export drafts, then press **Ctrl+C** in the terminal to stop. Closing the browser alone does not stop the server.

If PowerShell blocks npm.ps1, use **npm.cmd** instead of npm, or Command Prompt. Direct startup also works with **node scripts/start.mjs**.

**doctor** checks Node, loads modules/catalogs and checks writable storage using a temporary probe that it removes. It does not bind a port or validate engineering. **start** repeats those checks and reports port conflicts.

### macOS / Linux

Install the same supported Node major, extract the ZIP and use the same commands from the project folder. The batch file is Windows-specific. This delivery was tested on Linux; native Windows/macOS execution remains a target-computer check.

Normal use and Node tests need no runtime npm installation, Excel, Python, external calculation service, frontend build or API key. The app can work offline after installation. Optional browser and Python audits need their development dependencies.

The .ts source runs using Node's built-in type stripping [R2]. Starting Node does not perform static type checking. Keep the project outside node_modules.

## 3. First successful calculation

1. The initial screen loads **Water flow demonstration**.
2. Click **Calculate project**, then **Results**.
3. Compare the baseline below; displayed values are rounded.

| Quantity | Expected value |
| --- | ---: |
| Reference pipe ID | 102.26 mm |
| Reference bore | 45.49736523684261 mm |
| Full-scale operating beta | 0.4449184943950969 |
| Full-scale DP | 50 kPa |
| Full-scale Cd | approximately 0.60346028 |
| Full-scale permanent loss | approximately 39.2082148 kPa |
| Status | CHECK |

4. Confirm four operating cases and the section schematic. The drawing is not a manufacturing drawing; bars show four discrete DPs, not a continuous curve.
5. Name the project, click **Save project**, then **Open** and reopen it. Recalculate.
6. Export **Project JSON** from **Export & backup**.

Demo properties are synthetic test data. Replace them for real process tags. CHECK is expected because dimensional/engineering review is pending.

## 4. Use the supplied Excel and enter project data

1. Click **Open supplied workbook data** for the extracted 66-tag baseline, or **Import XLSX / JSON / CSV** for another supported file.
2. The original is **source/workbook.xlsx**, originally **Working tool 2026.09.20(4).xlsx**.
3. XLSX import accepts that layout and literal editable values. It rejects formulas in editable input cells. It does not execute Excel formulas/macros or recalculate caches.
4. Save a named project and export a JSON baseline before editing.
5. Calculate, then open **Project overview**. Use filters/search and **Review field** links.
6. Obtain missing properties from verified process sources.

Unchanged source results: **37 complete tags, 5 partial, 24 with no computed cases; 34 CHECK and 32 FAIL overall.** Three complete tags still fail a project limit. Missing values are not zero.

The first tag **FEH3F1003 -FE** has missing gas inputs and conflicting bore/beta. The separate **03_Outputs!R7** discrepancy belongs to **FEH3F1006 -FE**: Excel stores literal 1 psi, while target/hidden calculation corresponds to 1.8 psi. Node returns approximately 1.8 psi. The workbook was not rewritten or freshly recalculated in Excel.

For a new tag, enter identification/phase, pipe selection, property basis, four flow/temperature/pressure cases, densities or MW/Z, viscosity, gamma where required and property source. Review thermal expansion, installation and project limits before sizing.

| Mode | Required input | Behavior |
| --- | --- | --- |
| Solve for Bore | Positive target FS DP | Solve reference bore and case DPs |
| Solve for Beta | Positive target FS DP | Same physical solution, emphasizing FS beta |
| Solve for DP | Exactly one reference bore or beta | Compute DP from fixed geometry |
| Check Existing Bore | Existing bore; positive target for comparison | Fixed-bore DP and target deviation |

Missing target in Check Existing Bore adds **HOLD**, retaining fixed-bore values. Solve for DP does not use an inactive target. Reference dimensions are at 20 degrees C; thermal expansion may change operating beta.

**Changing a unit reinterprets the entered number; it does not convert that number.** Review values after unit changes. Disabled fields may retain older entries. Read mode-specific issues.

Calculate all tags, review notes, save inputs, export results CSV or print the selected result. Complete calculations can still have FAIL/CHECK/HOLD status.

## 5. Save, back up and restore

Save writes the latest input snapshot to a UUID-named JSON file, using temporary write/rename and revision conflict checks. Earlier revisions and unsaved drafts are not automatically retained. Reopened results are recalculated.

Storage defaults to **storage/** beside package.json; the terminal prints its actual location. The distributed ZIP has no saved-project folder; it is created on use. Use **one process per storage directory**. Its write queue does not coordinate multiple servers.

### One-project backup

1. Save the draft.
2. Select **Export & backup > Project JSON**.
3. Rename the download with project, revision and date.
4. Keep JSON with the corresponding CSV/PDF and engine package.

Restore by importing JSON, verifying name/tags, calculating and saving. Portable exports omit server ID/revision, so restoration creates an independent project. PDF is a presentation; JSON is the editable input record.

### All-project backup

Save drafts, stop the server and copy its whole storage directory to a dated backup. Restore into an empty/new directory while stopped. Preserve UUID filenames and JSON contents. Keep the original until restored files open successfully.

### Separate project data from the application

Set these in the launch terminal. Prefer an absolute storage path.

Windows Command Prompt:

~~~bat
set "ORIFICE_STORAGE_DIR=%USERPROFILE%\Documents\OrificeData"
set "PORT=3001"
node scripts/start.mjs
~~~

PowerShell:

~~~powershell
$env:ORIFICE_STORAGE_DIR = "$env:USERPROFILE\Documents\OrificeData"
$env:PORT = "3001"
node scripts/start.mjs
~~~

macOS / Linux, substituting your writable directory:

~~~sh
ORIFICE_STORAGE_DIR="/absolute/path/OrificeData" PORT=3001 node scripts/start.mjs
~~~

Settings apply to that terminal. A .env file is not loaded automatically. The server stays on 127.0.0.1 when PORT changes.

## 6. Upgrade from an earlier part

1. Export important JSON backups; stop the older server and copy its storage directory.
2. Extract Part 6 into a new folder. Keep the older installation. Do not mix old source files into the new package.
3. Run the verification/startup commands.
4. Import portable JSON and save. To retain project IDs/revisions, point the new server to a **copy** of old storage.
5. Recalculate and compare critical tags.
6. If upgrading from engine 0.1.0, review **mmH2O_4C** and **inH2O_4C** pressures. Part 5 corrected factors to **9.80638** and **249.082 Pa/unit**. Inputs are not silently migrated. Read the Part 5 migration rule. The supplied psi tags are unaffected.

## 7. How Excel logic became Node

| Step | Responsibility | Files |
| --- | --- | --- |
| 1 | Preserve original and SHA-256 | source/workbook.xlsx; docs/source-manifest.json |
| 2 | Map editable cells/headers to keys | docs/FIELD_MAPPING.md; data/fields.json; src/types.ts |
| 3 | Store lookups and input snapshot | data/pipes.json; data/units.json; examples/workbook-project.json |
| 4 | Validate inputs, preserving missing/zero distinction | calculateTag() in src/engine.ts |
| 5 | Resolve geometry; normalize to SI | src/catalog.ts; src/engine.ts |
| 6 | Determine density and mass flow | src/engine.ts |
| 7 | Thermal dimensions, Reynolds, Cd, expansibility | src/engine.ts; src/equations.ts |
| 8 | Solve bore/DP; calculate loss and velocity | Equations and bisection orchestrated by calculateTag() |
| 9 | Apply screens and provenance | src/engine.ts |
| 10 | Display/export server results | public/app.js; src/csv.ts |

Read **PART_2_CALCULATION_LOGIC.md** with the **Part 5 corrections** for formula-level details. Historical guides retain earlier counts/pending statements. Current status is in this guide and docs/part6/VERIFICATION.md.

To add an engineering rule: identify its controlled source, map inputs/units, add a failing reference/boundary test, implement the minimum change, run affected comparisons and document the version/migration effect. Do not infer a formula from one output or reproduce the known literal override.

## 8. Where to develop graphics and backend

| Change | File | Check |
| --- | --- | --- |
| Colors/responsive/print layout | public/styles.css | Browser and visual review |
| Shell/navigation/dialogs | public/index.html | Navigation/keyboard |
| Inputs/messages/results | public/app.js | Workflow and stale-state handling |
| Section drawing | schematic() in public/app.js | Geometry comes from server; retain schematic label |
| API/persistence | src/server.ts | API/save/conflict tests |
| CSV/XLSX | src/csv.ts; src/xlsx-import.ts | Round trips, malformed inputs |
| Calculations/units/modes | Engine/equations/catalogs | Regressions and separate numerical audit |
| Startup | scripts/start.mjs; Start-Windows.bat | Startup tests and native OS |

The UI reads **GET /api/catalog** and submits **POST /api/calculate**. Save uses **POST /api/projects**; list/open use **GET /api/projects** and **GET /api/projects/:id**. Imports: **/api/import/xlsx**, **/api/import/csv**. Exports: **/api/export/inputs**, **/api/export/results**. Contracts and CLI examples are in PART_3_BACKEND_GUIDE.md.

Keep schema 1, revision conflicts, stale-result invalidation and draft preservation unless deliberately migrating them. Add new static assets to the server whitelist. Keep scripts/styles in local files for the current Content Security Policy.

## 9. Verification

| Evidence | Current result |
| --- | --- |
| Node engine/API/import/export/startup suite | 61 passed, 0 failed |
| Browser workflows | 17 passed, 0 failed |
| Browser/OS | Chrome for Testing 154.0.8037.57, headless Linux |
| Viewports | 1440 x 1050 desktop; 390 x 844 mobile emulation |
| Printed demo | Three A4 landscape pages, rendered and reviewed |
| Separate numerical comparison | Retained Part 5: 19,965 comparisons without mismatches in its stated scope |
| Engineering release | HOLD |

Fresh evidence is in **docs/part6/** and **screenshots/part6/**. Earlier files are historical. The independent Python audit was not repeated because engine/catalog inputs are unchanged; hashes record preservation.

~~~sh
npm run verify:package
npm test
npm run api:walkthrough
~~~

Package verification compares source, catalogs, workbook, examples, tests, scripts and selected guides to a local SHA-256 manifest. It detects missing/changed files, not extra files, authenticity or engineering validity. Generated evidence and projects are excluded. Intentional edits should show differences; create a new reviewed release rather than hiding them.

Optional browser checks [R3]:

~~~sh
npm ci
npx playwright install chromium
npm run test:browser
~~~

Playwright is a pinned development dependency. The suite uses temporary server/storage and writes fresh evidence. ORIFICE_BROWSER_EXECUTABLE may select a compatible installed binary; this delivery used the stated official Chrome test binary.

Optional numerical audit, preferably in an isolated Python environment:

~~~sh
python -m pip install -r audit/requirements.txt
python audit/independent-check.py
python audit/data-audit.py
~~~

Those scripts regenerate docs/part5 evidence. Read its methodology/tolerances first.

## 10. Troubleshooting

| Symptom | Action |
| --- | --- |
| Node not recognized | Install supported Node and reopen terminal |
| Unsupported Node | Use major 24, at least 24.12 |
| Missing package file | Extract the entire ZIP into a new folder |
| Storage not writable | Use a writable folder or ORIFICE_STORAGE_DIR |
| Port occupied | Stop older Workbench terminal or choose another PORT |
| Error opening HTML | Use the running server's HTTP address |
| Saved projects missing | Check printed storage path and installation |
| Project list server error | Read terminal log; stop/back up storage; preserve damaged JSON before moving it out of the active folder |
| Project changed / 409 | Export current draft, reopen saved version and reconcile |
| Results disappear after edits | Expected invalidation; calculate again |
| XLSX rejected | Matching layout/literal inputs, or exported Input CSV format |
| Steam Table unavailable | Supply verified single-phase properties using supported manual/direct-density mode |
| Test browser missing | Run optional Playwright install; normal app use does not need it |

## 11. Local acceptance and engineering release

On the target computer:

- [ ] Demo matches baseline.
- [ ] Save, stop/restart, reopen and recalculate.
- [ ] Export/import JSON backup; check inputs.
- [ ] Import supplied workbook; confirm source status counts.
- [ ] Review layout/print preview and native Windows launcher if applicable.
- [ ] Record OS, Node and browser versions.

Native Windows/macOS, Edge/Firefox/Safari, physical phones, native print dialogs, screen readers, large-load behavior and multi-user hosting were not tested here.

Before engineering issue, close the Part 5 requirements: full controlled standards applicability including tap/beta/Re, roughness and installation; verified properties/dimensions; phase/cavitation/subsonic suitability; uncertainty; transmitter/mechanical selection; matched commercial benchmarks; authorized approval. A reviewer-name input is not an approval workflow.

## 12. Gemini continuation

Give Gemini the whole source folder/ZIP plus **docs/GEMINI_HANDOVER.md**. Use its bootstrap prompt and select one bounded task. Request changed files, actual checks and a short checkpoint rather than a full code dump. Continue from this package.

## Installation/testing references

- **R1:** [Official Node download selection](https://nodejs.org/en/download), checked 3 October 2026.
- **R2:** [Node TypeScript execution](https://nodejs.org/api/typescript.html), checked 3 October 2026.
- **R3:** [Playwright browser installation](https://playwright.dev/docs/browsers), checked 3 October 2026.

Application findings are supported by included source/tests and the Part 5 report, which lists its engineering references and remaining requirements.
