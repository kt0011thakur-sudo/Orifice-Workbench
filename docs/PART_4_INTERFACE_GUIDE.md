# Part 4 — Graphics, input/result screens and browser verification

This part supplies the working browser interface on top of the Part 3 Node backend. The ZIP is a complete project: calculation engine, backend, source workbook, UI, tests, screenshots and this guide. You do not need to merge files from earlier parts.

The UI is plain HTML, CSS, JavaScript and SVG. Node remains the calculation authority. No Gemini/API key, frontend build system or paid service is needed to run it. Gemini can help develop the source code separately.

## 1. Start this package

1. Extract `Orifice_Part_4_Interface_Package.zip`.
2. Open a terminal inside the extracted `orifice-part-4` folder.
3. Use Node.js major 24, version 24.12 or newer within that major. This delivery was exercised with Node 24.19.0.
4. Run the commands below.
5. Keep the terminal running and open <http://127.0.0.1:3000>.

```sh
node --version
npm test
npm start
```

`npm install` is unnecessary for starting the application and running the 46 Node tests. Development browser testing has an optional dependency, explained in step 9. `Start-Windows.bat` is included from Part 3; its Windows execution was not tested here.

The default screen opens synthetic water demonstration data. It does not silently load or alter your workbook. Click **Open supplied workbook data** or **Import XLSX / JSON / CSV** to work with the updated Excel inputs.

## 2. Understand the five screens

| Screen | What is implemented | Where it is built |
|---|---|---|
| Inputs | Tag/service, phase, pipe selection, manual dimensions, property method, four operating cases, thermal expansion, installation and record details | `inputsView()`, `matrix()`, `field()` in `public/app.js` |
| Sizing | Four solve modes, target DP, bore/beta, taps, coefficient choice and project limits | `sizingView()` |
| Results | Bore/beta/DP/Cd cards, proportional bore section, four DP bars, case table, linked validation notes and calculation record | `resultsView()`, `schematic()`, `traceability()` |
| Project overview | All tags, numerical completion count, FAIL/CHECK/etc. filters and links to each result | `batchView()` |
| Source & method | Workbook identity, supported scope, engineering limitations and saving/import behavior | `referenceView()` |

The sidebar manages the project name, saving/opening, tag search, add/duplicate/remove, imports and exports. On a narrow screen, use **Project & tags** to expand it. Wide operating-case tables scroll inside their own container.

## 3. Enter process inputs

1. Enter the tag, service, fluid name and phase.
2. Choose the dimensional standard, NPS/DN, nominal size and schedule. Switching NPS to DN preserves the equivalent catalog size when it exists.
3. Choose AUTO, MANUAL WT or MANUAL ID. Only the corresponding manual input becomes active. The backend resolves and validates the final dimensions.
4. Choose a supported property method for the phase. Imported unsupported choices remain visible with “(check)” until corrected; the application does not silently replace them.
5. Enter viscosity and the property reference. Enter gamma for gas/steam and the other values required by the selected property method.
6. Enter minimum, normal, maximum and full-scale conditions in the operating matrix. Fill all required cases; blanks remain missing values.
7. Expand thermal, installation or record details as needed.

**Changing a unit changes how the entered number is interpreted; it does not convert the stored number.** Review the value whenever changing units. Property methods and disabled fields retain existing data, which supports reversible editing. The Node validator still evaluates the input contract and reports invalid values.

Adding a tag uses demonstration defaults and shows a reminder. Replace those values with your process data. Do not treat the sample properties as project data.

## 4. Select the sizing objective

| Mode | Required geometry/target input | Screen behavior |
|---|---|---|
| Solve for Bore | Target full-scale DP | Bore and beta inputs are disabled and cleared when entering this mode |
| Solve for Beta | Target full-scale DP | Uses the existing engine's target-DP sizing path; bore and beta inputs are disabled |
| Solve for DP | Exactly one reference bore or reference beta | Both controls are available; clear the unused one |
| Check Existing Bore | Existing reference bore; target DP for comparison when provided | Beta is cleared and disabled |

Bore/beta inputs refer to the engine's reference dimensions at 20 °C. Results distinguish the reference bore from operating dimensions. Project acceptance limits are separate from numerical convergence.

Click **Calculate project** to calculate all tags, not just the selected tag. A malformed/missing field produces a validation issue. Selecting **Review field →** opens the correct screen, expands the relevant details section and focuses that field.

## 5. Read results and graphics

The first four cards show reference bore, full-scale beta, full-scale DP and full-scale Cd. The section drawing scales the bore opening to the calculated full-scale diameter ratio. Axial lengths and tap positions are schematic, not manufacturing dimensions. If a full-scale result is unavailable, the screen displays an unavailable-geometry message rather than drawing a guessed opening.

The DP bars represent four discrete operating cases; they are not a continuous performance curve. Their values and the results table come from the Node response. The browser does not reproduce the hydraulic formulas.

The results table includes DP, permanent pressure loss, mass flow, density, operating bore/beta, Cd, expansibility, Reynolds number, velocities and pressure ratio. Dashes mean unavailable values, not zero. Display rounding does not alter backend calculations or exports.

The calculation record includes selected input context, resolved dimensions, property reference, calculation timestamp, engine identity, draft/saved state and workbook SHA-256. Solver diagnostics are available in an expandable table.

A numerically complete calculation can still be FAIL or CHECK. In this migration, independent engineering approval is pending and `engineeringVerified` remains false. The UI preserves this distinction.

## 6. Save, reopen, import and export

1. Give the project a meaningful name and click **Save project**.
2. Use **Open** to list and reopen saved snapshots. Reopening loads inputs; calculate again to produce results.
3. Use **Export & backup → Project JSON** for a portable input backup. It excludes the server's project ID/revision so that importing it creates an independent draft.
4. Use **Input CSV** for tabular input exchange and **Results CSV** for all calculated result rows. Results CSV is calculated by Node from the submitted inputs.
5. Use **Import XLSX / JSON / CSV** to load another input file. Replacing an unsaved draft prompts before replacement. The XLSX importer uses the supplied workbook layout and rejects formulas in editable input cells.

Save stores the **latest snapshot only** and increments its revision; it is not a historical version archive. Existing files remain in `storage/` by default. Use one server process per storage directory. Export JSON backups if previous revisions must be retained.

Part 4 adds safeguards for asynchronous UI operations:

- Input edits immediately invalidate calculated outputs.
- A calculation response for an older draft is discarded.
- If the user edits while saving, the saved ID/revision are retained but the newer draft values stay in the editor and remain marked unsaved.
- A server revision conflict keeps the browser draft and asks the user to export/reload.
- An import/open response cannot replace a draft edited while that request was running.
- Changing projects or inputs clears a stale toast message from the previous calculation.

## 7. Change the graphics and layout

1. Edit `public/styles.css` for colors, typography, spacing and responsive behavior. Theme colors are CSS variables at the beginning of the file.
2. Edit `public/index.html` for the application shell, sidebar, navigation and dialogs.
3. Edit the rendering functions in `public/app.js` for field grouping, result cards and tables.
4. Edit `schematic()` for the SVG section drawing. Keep its dimensional relationship tied to returned engine values, and keep the schematic label.
5. Edit `public/favicon.svg` for the small application mark.
6. Refresh the browser after saving source changes. No bundler is involved.

The interface includes visible keyboard focus, a skip link, associated field labels, validation associations, a native saved-project dialog and live status messages. These were checked in the workflows described below; this is not a formal accessibility certification.

The CSP allows local scripts/styles only. Keep JavaScript in `app.js`, CSS in `styles.css` and avoid inline scripts or style attributes. New frontend assets require adding their paths to the static-file whitelist in `src/server.ts`.

## 8. Inspect the printed report

1. Calculate the current project and select the required tag.
2. Open Results and click **Print / save as PDF**.
3. Review the preview before printing. The supplied CSS uses A4 landscape.
4. Keep the project JSON alongside the report when a complete editable input record is required.

The report removes navigation and editing controls, and retains results, validation notes and calculation context. `screenshots/08-demo-print.pdf` is a browser-generated sample. Its rendered pages were visually reviewed. The operating system's native print dialog and physical printer output were not exercised.

## 9. Repeat browser verification

The browser suite starts an isolated local server on a free port, creates temporary storage, exercises the UI, writes evidence and removes its temporary saved projects. It does not use your normal `storage/` directory.

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

`playwright` is pinned to 1.62.1 in the package and lockfile. It is a development dependency only. The script normally uses the installed Playwright browser. An optional `ORIFICE_BROWSER_EXECUTABLE` environment variable selects an existing compatible browser binary.

For this delivery, the bundled-browser download failed, so the suite used an official Chrome for Testing headless-shell download through that override. The exact tested browser was **154.0.8037.57 on Linux**, with desktop **1440 × 1050** and mobile viewport **390 × 844**. This records the actual test environment; it is not a claim of coverage across all browser releases.

### Verification evidence

| Evidence | Observed result | File |
|---|---|---|
| Engine/backend/import-export tests | 46 passed, 0 failed | `docs/part-4-node-test-results.txt` |
| Browser workflow checks | 17 passed, 0 failed | `docs/part-4-browser-report.json` and `docs/part-4-browser-checks.txt` |
| Updated workbook import | 66 tags; 37 numerically complete; 34 CHECK and 32 FAIL | Browser report and overview screenshot |
| Demo result | Bore 45.497365 mm; full-scale DP 50 kPa | Results screenshot and existing engine tests |
| Browser script/runtime errors | No uncaught page errors or unexpected console/CSP errors | Browser report; one intentional HTTP 409 conflict is recorded |
| Visual evidence | Seven screen captures and a printed demo report | `screenshots/` |

The 17 browser checks cover navigation/keyboard entry, numerical result display, sizing modes, invalidation, pipe unit/manual-ID changes, missing gas properties, delayed calculations, save/reopen/JSON export, edits during saving, stale-save conflicts, JSON import/HTML escaping, CSV round trip, actual XLSX import/batch filters, result export/source view, mobile layout and print output.

The core engine, backend and catalogs are unchanged from Part 3. `docs/part-4-source-hashes.json` records this comparison and the current frontend hashes. No independent recalculation against ISO, CONVAL or Emerson was added in Part 4.

Not tested here: Firefox, Safari, Edge, physical phones, Windows execution, operating-system print dialogs, screen-reader behavior or multi-user hosting. The app remains a local engineering prototype, with no login or authenticated cloud deployment.

## 10. Files to hand to Gemini

Use this entire extracted folder as the working project. Start Gemini with the instruction below:

> Continue from the Part 4 Orifice Workbench package. Read README.md, docs/PART_3_BACKEND_GUIDE.md and docs/PART_4_INTERFACE_GUIDE.md first. The Node engine and backend are already implemented. Do not invent missing Excel formulas, property data or engineering approvals. Keep calculations in src/engine.ts and src/equations.ts; the browser consumes the API. Preserve the workbook, field mappings, unit/catalog data, review flags, input invalidation and save-revision safeguards. Treat docs/part-4-browser-report.json as evidence for the stated browser only. Run npm test after meaningful logic changes, and the browser checks after changes affecting UI behavior. Report actual checks and unresolved limitations. Work only on the next requested part.

Part 5 remains the engineering verification and reference-comparison stage. It should address the documented workbook discrepancy (`03_Outputs!R7` stores 1 psi while the corresponding calculation/target is 1.8 psi), missing source properties and independent applicability checks. Numerical completion and UI verification must not be presented as engineering approval.

## Technical references

- Playwright library usage: <https://playwright.dev/docs/library>
- Playwright browser installation: <https://playwright.dev/docs/browsers>
- Chrome for Testing download metadata: <https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json>

These references support the development/test tooling. The migrated source workbook and project mapping files remain the provenance for the calculation implementation.
