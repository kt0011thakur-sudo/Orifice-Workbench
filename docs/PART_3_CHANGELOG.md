# Part 3 changes

- Preserved types.ts, catalog.ts, equations.ts, engine.ts and defaults.ts byte-for-byte from Part 2.
- Preserved the XLSX importer, CSV logic, catalogs, source inputs and original workbook.
- Updated server.ts: known user-data errors return 400; unexpected I/O/program failures return generic 500 and write details to the local terminal. Project IDs and paths use tighter matching.
- Added api-client.mjs for live local requests and UTF-8 file outputs. The client refuses output-file overwrite, supports create/save distinctions, and wraps imported CSV tags in a portable project object.
- Added api-walkthrough.mjs with isolated storage, restart, import/export, conflict and client checks.
- Added three API tests covering malformed/schema inputs, persistence from another server instance, and unexpected storage failure. Total test count is 46.
- Added this part's guide, quick start, source hashes and executed verification logs.
- Existing frontend code remains the earlier prototype. Visual/interaction verification has not been claimed.

The engineVersion stays 0.1.0 because the calculation files are unchanged. The numbered package identifies this backend delivery; engineVersion is not an application-wide file hash.
