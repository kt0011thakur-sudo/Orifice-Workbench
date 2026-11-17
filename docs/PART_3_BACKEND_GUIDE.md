# Orifice tool Part 3 Backend APIs imports and project saving

Part 3 is complete. The accompanying Orifice_Part_3_Backend_Package.zip is self-contained: it includes the unchanged calculation engine, local server, API client, input/output handlers, original workbook, existing interface source and tests. Extract it into its own folder. You do not need to merge files from the earlier packages.

This part explains the local backend. Browser design and browser verification remain Part 4. Multi-user authentication, database migration and cloud deployment are later extensions; the delivered server listens only on this computer.

## 1 Understand the backend responsibility

The browser collects inputs and sends a request. The Node server checks the request and calls calculateBatch from Part 2. That function performs the engineering calculation and returns results and issues. The server sends that result back as JSON.

Keep the numerical equations in the calculation engine. The server should manage requests, imports, exports and project files, without implementing a second set of sizing formulas. Saving a draft should be possible before its process inputs are complete; saving does not approve its calculations.

| File or folder | Role |
| --- | --- |
| src/server.ts | Local HTTP service, routes, request validation, static files and project storage |
| src/engine.ts | Single calculation authority, unchanged from Part 2 |
| src/xlsx-import.ts | Bounded import for the supplied Excel layout |
| src/csv.ts | CSV parsing, typed inputs and CSV output |
| scripts/api-client.mjs | Terminal client for the running service |
| scripts/api-walkthrough.mjs | Temporary end-to-end demonstration and assertions |
| examples/ | Complete synthetic demo and original 66-tag input project |
| source/workbook.xlsx | Exact supplied workbook for import and provenance tests |
| storage/ | Created at runtime for locally saved project inputs |

## 2 Start the service

1. Extract the entire ZIP.
2. Install Node.js 24 LTS version 24.12 or later within major 24.
3. Open a terminal in the orifice-part-3 folder containing package.json.
4. Run the commands below. No npm install or API key is required.

```sh
node --version
npm test
npm run api:walkthrough
npm start
```

The walkthrough starts its own temporary local server and temporary project directory, then removes them. It does not need npm start running and does not write to your normal saved-project folder. The tests also use temporary storage.

npm start runs the normal application at http://127.0.0.1:3000. Keep that terminal open. Open a second terminal in the same project folder to run API client commands. On Windows, Start-Windows.bat is an alternative launcher. Stop the server with Ctrl+C.

To change port or storage, set the environment before starting the server. In PowerShell:

```powershell
$env:PORT = "3001"
$env:ORIFICE_STORAGE_DIR = "C:\OrificeProjects"
npm start
```

In the client terminal, set `$env:ORIFICE_API_URL = "http://127.0.0.1:3001"` so the client uses the same port. On Linux/macOS use `PORT=3001 ORIFICE_STORAGE_DIR=/your/folder npm start` and set ORIFICE_API_URL to the matching local URL for the client.

Use one server process per project-storage directory. The in-process write queue is not a multi-process file lock.

## 3 Use the API contract

All JSON POST requests use Content-Type application/json. XLSX upload uses raw bytes with Content-Type application/octet-stream. GET requests need no body.

| Method and route | Input | Output |
| --- | --- | --- |
| GET /api/health | None | ok, engine version, localOnly |
| GET /api/catalog | None | Field definitions, choices, pipes, units, source manifest and demo |
| GET /api/workbook | None | Extracted project containing the source's 66 tags |
| POST /api/calculate | Object containing tags array | Object containing results array |
| POST /api/import/xlsx | Raw XLSX bytes | Portable project object plus import notes |
| POST /api/import/csv | Object containing text string | Object containing tags array |
| POST /api/export/inputs | Project name and tags | Input CSV |
| POST /api/export/results | Project name and tags | Recalculated result CSV |
| GET /api/projects | None | Saved-project summaries |
| GET /api/projects/:id | Saved project UUID | Saved project inputs and revision metadata |
| POST /api/projects | Project name, tags and schemaVersion 1 | Saved project with id, revision, updatedAt and engineVersion |

An update to /api/projects also needs the saved id and current revision. A request without an id creates a new project. The project schema accepts at most 500 tag objects and a nonblank project name up to 160 characters. It supports incomplete engineering inputs as drafts. The calculation engine checks those inputs when calculating.

The server limits JSON requests to 6 MB and XLSX uploads to 32 MB. Imports are constrained to the documented schema. There is no database, account system, project-delete route or version-history endpoint in this release.

## 4 Calculate using the terminal client

With npm start running in the first terminal, use the second terminal:

```sh
npm run api -- health
npm run api -- calculate examples/demo-project.json --out demo-results.json
```

The client reads the full demo project, sends its tags to /api/calculate and writes the returned JSON as UTF-8. The water example should have a reference bore of approximately 45.497365 mm and FS DP of 50 kPa. --out refuses to overwrite an existing file; choose a fresh output name for another run. Without --out, the response is printed.

The calculation response can be HTTP 200 and still contain a tag with status FAIL. HTTP status describes whether the API request was processed. The result's status, complete flag and issues describe the engineering calculation. Always inspect both levels.

For JavaScript integration, the same request looks like this:

```js
import { readFile } from 'node:fs/promises';

const project = JSON.parse(
  await readFile('examples/demo-project.json', 'utf8')
);
const response = await fetch('http://127.0.0.1:3000/api/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tags: project.tags })
});
const payload = await response.json();
if (!response.ok) throw new Error(payload.error);
console.log(payload.results[0]);
```

## 5 Import the updated Excel workbook

```sh
npm run api -- import-xlsx source/workbook.xlsx --out imported-workbook.json
```

The import reads the two input/settings worksheets, verifies the expected row-4 headers and maps the editable values from tag rows 5 through 504. The delivered workbook produces 66 tags. The parser supports ordinary unencrypted XLSX ZIP files with stored or deflated entries, shared/inline strings and numeric cells. It does not implement a general Excel calculation engine.

Computed geometry helpers and output formulas are not authoritative inputs. Formulas in editable input cells are rejected: convert those inputs to checked literal values in a reviewed workbook copy before importing. No formulas or macros are executed, and external relationships do not supply data.

The selected layout and range are fixed. Do not append tags beyond row 504 or assume another worksheet layout will be detected. Layout changes require a reviewed importer change. Encrypted, ZIP64 and otherwise unsupported archives are outside this importer's contract. Selected decompressed XML entries have a 100 MB limit and archive entry count is bounded.

Import does not recalculate or approve a project and does not save it automatically. The current first source tag retains its missing Z/gamma and conflicting geometry inputs. Import also does not replace the app's versioned pipe or unit catalogs; reference-table changes require a separate migration.

## 6 Import CSV and portable JSON

For CSV, begin by exporting an input template from the application:

```sh
npm run api -- export-inputs examples/demo-project.json --out input-template.csv
npm run api -- import-csv input-template.csv --out imported-csv-project.json
```

Headers can use the field keys or exact known field labels. Unknown or duplicate columns, incorrect row widths, malformed quotes and nonnumeric values in numeric fields are rejected. Blank cells become null. Quote cells containing commas, quotes or newlines. Use plain numbers without thousands separators in numeric fields.

The CSV API returns tags. The terminal client wraps these in a portable project with schemaVersion 1 and a name derived from the CSV filename. The resulting JSON can be calculated or saved directly.

Portable JSON preserves input fields and text more faithfully than CSV. CSV import trims surrounding whitespace, and CSV export prefixes formula-like text with an apostrophe for spreadsheet safety. Use JSON for exact project backups. There is no separate /api/import/json route: the client reads JSON locally and sends its tags for calculation or its project object for saving.

## 7 Create and save a project

```sh
npm run api -- create examples/demo-project.json --out saved-project.json
npm run api -- list
```

The create command sends name, tags and schemaVersion, omitting any old saved id/revision. The backend generates a UUID and starts revision 1. The returned saved-project.json contains the current id and revision as well as the inputs.

To update it, edit a copy of the returned JSON, preserving id and revision, then submit that file:

```sh
npm run api -- save saved-project.json --out saved-project-v2.json
```

The response is the authoritative next revision. Use its revision for the next update; repeatedly sending revision 1 after revision 2 exists produces a conflict. To load a saved project, replace YOUR_PROJECT_ID with the actual id from the response:

```sh
npm run api -- load YOUR_PROJECT_ID --out reloaded-project.json
```

The server stores one file named by UUID inside storage/ or ORIFICE_STORAGE_DIR. It validates the filename ID and does not use project names as file paths. Only the latest saved inputs and metadata are retained. Results are recalculated when requested; saving does not create an approved calculation record.

## 8 Handle competing saves correctly

Suppose two browser tabs load revision 3. Tab A saves successfully and receives revision 4. When Tab B submits its old revision 3, the server returns HTTP 409. The existing revision 4 remains unchanged.

The UI or client should preserve Tab B's unsaved draft, reload the current project, compare changes and submit a reconciled update using the current revision. Do not silently replace the revision number and retry, because that would discard the protection against overwriting another save.

Inside one process, saves are serialized through a queue. Each update checks the existing revision, writes a temporary JSON file, then renames it over the project file. A successful response is sent after the rename. This avoids serving a partially written JSON file during an ordinary save.

A revision number is an overwrite check, not a revision-history database. Previous contents are replaced. There is no durable approval history, distributed locking or explicit power-loss durability guarantee. Keep portable JSON backups of meaningful revisions and use one process for this local release.

## 9 Export results and back up inputs

```sh
npm run api -- export-inputs examples/demo-project.json --out project-inputs.csv
npm run api -- export-results examples/demo-project.json --out project-results.csv
```

Result export calls the calculation engine again from the submitted inputs. It does not trust an old browser result. It emits four case rows per tag, including status, completion, engineeringVerified, engine/source identifiers, DP, permanent loss, geometry, flow and issues. Unavailable values remain blank with their issues recorded.

The result CSV is an output report, not an input template. Reimport input CSV or portable project JSON instead. To back up a saved project, load it to a new JSON filename and keep that file separately. To restore it as a new project, use create; to update its existing saved identity, use save with a current revision.

Backing up the whole storage folder also preserves current local projects. Stop the server before manually copying or restoring that directory. Test reopening a restored copy. An exported CSV does not replace the JSON backup of all project fields and metadata.

## 10 Interpret errors and local access controls

| HTTP status | Meaning |
| --- | --- |
| 200 | Request processed; inspect calculation status separately |
| 400 | Invalid JSON/request, unsupported input format or schema, malformed ID or other known input error |
| 403 | Host or Origin is not an allowed local address |
| 404 | Route or saved project does not exist |
| 409 | Saved project revision changed |
| 413 | Request body exceeds the configured limit |
| 415 | Wrong Content-Type |
| 500 | Unexpected server/storage failure; details are written to the local terminal log |

Part 3 corrects the earlier backend's fallback that labelled unexpected internal failures as HTTP 400. Known calculation/import request errors remain 400; unexpected filesystem failures now return a generic 500 response with details in the local log. It also tightens project ID and route matching. Numerical engine files are unchanged.

The default process binds to 127.0.0.1. Host/Origin checks restrict browser requests to the expected local addresses, and a content security policy restricts served scripts/content. These are local-use controls, not authentication. Any multi-user or public deployment needs explicit account, authorization, TLS and storage requirements before exposing a network listener.

If connection fails, check that the server is running and client/server ports agree. If a save returns 500, inspect the server terminal, storage-path type and directory permissions. If an import fails, use the delivered layout or exported input template and read the error before changing data. If --out reports an existing file, choose a new name.

## 11 Confirm Part 3 verification

46 automated tests passed: the 30 unchanged calculation tests, 8 API tests and 8 import/export tests. The API walkthrough also passed ten checks, including the 66-tag XLSX import, calculation, save/update/read, stale-revision rejection, CSV exchange, restart persistence and terminal-client UTF-8 export.

Evidence is included in docs/part-3-test-results.txt and docs/api-walkthrough-output.json. Tests use isolated temporary folders. Core engine file hashes are recorded in docs/part-3-source-hashes.json and match Part 2.

Browser interaction/visual checks, Windows execution, independent engineering benchmarks and full standards applicability are still pending. The existing interface is included so the backend can serve it, but this part does not claim browser verification.

## 12 Continue with Gemini and Part 4

Give Gemini this complete package and ask it to read the guide, run npm test and npm run api:walkthrough, and preserve calculateTag/calculateBatch. For Part 4, connect the screens to these endpoints; render returned issues; invalidate stale results after input changes; preserve the current project id/revision; and handle 409 conflicts without losing drafts.

If a hosted multi-user backend is later required, first agree user roles, ownership, project sharing and deployment requirements. Then introduce a storage interface, a transactional database, authentication and immutable calculation/approval records. Do not put AI-generated values or a second equation implementation into the runtime sizing path.

Part 3 is complete. Next is Part 4: graphics, input/result screens and browser verification.
