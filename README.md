# Orifice Workbench - Part 6 complete package

**Engine 0.2.0 | Project schema 1 | 3 October 2026**

**Windows test correction P6-WIN-TEST-1:** the restart test now accepts Node's documented Windows SIGTERM result and still verifies saved data after restarting. The corrected suite has 62 tests. Read [the correction and installation steps](docs/PART_6_WINDOWS_TEST_FIX.md). Earlier Part 6 counts describe the original delivery.

Complete local Node application, original Excel workbook, interface, APIs, imports/exports, project saving, tests and six-part documentation. Extract into a new folder; no merging of older ZIPs is required.

**Engineering release remains HOLD.** Part 6 preserves the Part 5 engine, APIs, importers, catalogs and example inputs.

## Start

Install Node **24.12 or newer within major 24** from [nodejs.org](https://nodejs.org/en/download). Open a terminal in the extracted **orifice-part-6** folder:

~~~sh
node --version
npm run verify:package
npm run doctor
npm test
npm start
~~~

Keep the terminal open and visit <http://127.0.0.1:3000>. Calculate the demo: bore **45.497365 mm**, full-scale DP **50 kPa**.

Windows: use **Start-Windows.bat** for subsequent launches. If PowerShell blocks npm.ps1, use npm.cmd or **node scripts/start.mjs**. Native Windows execution has not been tested here.

Normal use and Node tests need **no npm install, Excel installation, Python or API key**. Optional browser testing needs Playwright. Gemini is a development assistant, not a runtime dependency.

## Documentation

- [Complete setup, operation and development guide](docs/PART_6_FINAL_GUIDE.md)
- [Gemini handoff and bounded follow-up tasks](docs/GEMINI_HANDOVER.md)
- [Engineering verification and remaining requirements](docs/PART_5_ENGINEERING_VERIFICATION.md)
- [Current verification record](docs/part6/VERIFICATION.md)
- [Part 6 changes](docs/PART_6_CHANGELOG.md)

Projects default to **storage/**; ORIFICE_STORAGE_DIR overrides it. Save retains the latest input snapshot, not revision history. Export dated project JSON backups. Use one server process per storage directory.

The supplied inputs remain unchanged: 37 numerically complete tags, 34 CHECK and 32 FAIL overall. Resolve missing properties and issues using verified process data.

The server binds to 127.0.0.1. Authentication, shared hosting, automatic steam properties, complete standards applicability and engineering approval are outside this delivery.
