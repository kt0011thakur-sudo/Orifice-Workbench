# Part 6 changes

Date: 3 October 2026. Engine/application semantic version remains 0.2.0; delivery stage is Part 6. Project schema is 1.

- Added scripts/start.mjs: runtime check before TypeScript import, required-file checks, writable storage check, clear invalid/occupied-port errors, loopback startup and stop handling.
- Updated npm start and Start-Windows.bat to use that entry point. Added doctor and verify:package commands.
- Added six startup tests, including actual process restart/persistence, paths containing spaces, invalid configuration and occupied-port handling. Full suite: 61 tests.
- Added source hash verification and a Part 5 preservation comparison.
- Fixed calculation-record CSS wrapping identified during print review.
- Reran all 17 browser checks; moved their output to docs/part6 and screenshots/part6 to retain older evidence.
- Added final setup/operation/backup/upgrade/troubleshooting guide and Gemini handoff.
- Included historical Part 1/2 guides with a current-version note; retained Part 3/4/5 guides and evidence.

No calculation, API, persistence, import, catalog, example-input or original-workbook changes from Part 5. The separate numerical audit was retained rather than rerun. No cloud deployment, native Windows run, commercial comparison or engineering approval was performed.
