# Part 6 verification record

**Update P6-WIN-TEST-1:** the user reported 60/61 passing on Windows 10.0.26200.9457 with Node 24.20.0; the failed assertion expected a POSIX exit code after SIGTERM. The corrected suite passes 62/62 on Linux, including explicit Windows termination-outcome regression cases. A native Windows rerun of the correction remains pending. See ../PART_6_WINDOWS_TEST_FIX.md and windows-test-fix/node-tests.txt. The original evidence below is retained as history.

Date: 3 October 2026. Node 24.19.0, Linux kernel 6.18.44. Engine 0.2.0; schema 1.

## Completed software checks

| Check | Result | Evidence |
| --- | --- | --- |
| Node regression suite | 61/61 passed; no skipped or failed tests | node-tests.txt |
| API walkthrough | 10/10 passed, including XLSX, exports, revision conflicts and restart persistence | api-walkthrough.json |
| Browser workflows | 17/17 passed | browser-report.json; browser-checks.txt |
| Browser errors | No uncaught page errors or unexpected console/CSP errors; deliberate 409 conflict retained | browser-report.json |
| Source workbook | Original SHA-256 preserved | release-manifest.json and import test |
| Engine/API/catalog preservation | All Part 5 src, data, examples, source and audit files unchanged | release-manifest.json |
| Extracted package check | Recorded after packaging in archive-check.json | archive-check.json |

The six added startup tests exercise unsupported-runtime rejection, external working directories and spaces in storage paths, malformed ports, unusable storage, real process restart/persistence, and a busy port without disturbing its existing listener.

The package has no runtime node_modules dependency. Playwright 1.62.1 was used only for development verification; browser binary: official Chrome for Testing headless shell 154.0.8037.57. Viewports: 1440 x 1050 desktop, 390 x 844 mobile emulation.

## Visual review

Fresh captures are in screenshots/part6. The desktop results and mobile inputs were visually inspected. All three pages of the generated A4 landscape demo PDF were rendered and inspected. The first review found a property-reference value extending beyond its calculation-record column. Adding a minimum-width constraint and explicit wrapping bounds corrected it; all 17 browser checks passed again, and the latest PDF pages were reviewed.

The printed sample includes numerical results, validation notes, engine identity, source hash and input context. It is a demonstration report, not an approved engineering datasheet. The native print dialog was not exercised.

## Historical numerical evidence

Part 5's separate Python/Fluids/SciPy comparison is retained: 288 synthetic scenarios and 157 computable workbook cases, 19,965 scalar comparisons without mismatches in its stated scope/tolerances. It was not rerun in Part 6 because the numerical engine/catalogs and audit code are unchanged. Refer to PART_5_ENGINEERING_VERIFICATION.md for assumptions and gaps.

The original input outcome remains 37 complete, 5 partial, 24 tags with no cases; 34 CHECK / 32 FAIL overall. Missing process values were not inferred.

## Limits

Native Windows/macOS, the Windows batch file, physical mobile devices, Edge/Firefox/Safari, screen readers, native print dialogs and multi-user/load testing were not executed. Windows instructions and batch syntax were reviewed; automated launcher tests executed the JavaScript entry point on Linux.

Full controlled standards applicability, external commercial benchmarks, properties, uncertainty, instrument/mechanical selection and authorized engineering release remain pending. engineeringVerified stays false. No external deployment occurred.
