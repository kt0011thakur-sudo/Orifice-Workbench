> Historical stage document. For current setup and behavior, read PART_6_FINAL_GUIDE.md and PART_5_ENGINEERING_VERIFICATION.md. Part 5 corrected two water-column factors, mode-specific target validation, missing-target HOLD behavior and a solver endpoint tolerance. Earlier verification counts and pending-browser statements describe their original delivery.

# Orifice tool Part 1 Requirements and delivery plan

Status: Part 1 complete. Source: Working tool 2026.09.20(4).xlsx. Date: 27 September 2026.

## Delivery method

Use six numbered replies. Each reply delivers one finished subject, the relevant source files and clear verification status. Reuse the code already created. Do not restart workbook extraction or paste the entire application into a single response. Give Gemini the source archive and docs/GEMINI_HANDOVER.md to continue from the same baseline.

Token estimates are planning ranges, not a reading of account quota. The complete source plus detailed guide would require roughly 30,000–45,000 output tokens if pasted into chat. Delivering code as files reduces repeated chat output. Aim for approximately 1,000–2,000 explanatory tokens per part; extra debugging/tool context varies. Splitting replies does not reset the account's usage limits.

| Part | Finished subject | Main deliverable | Approximate explanation tokens |
| --- | --- | --- | --- |
| 1 | Workbook analysis and requirements | This plan, source findings, scope and acceptance criteria | 1,000–1,500 |
| 2 | Excel to Node calculation logic | Unit/property rules, equations, mode selection and solver walkthrough | 1,500–2,000 |
| 3 | Node backend and data | API, project saving, imports, exports and runnable commands | 1,000–1,500 |
| 4 | Graphics and workflow | Inputs, sizing, results, schematic, project overview and browser checks | 1,000–1,500 |
| 5 | Testing and engineering review | Automated tests, workbook comparison and discrepancy resolution | 1,000–1,500 |
| 6 | Final assembly and Gemini continuation | Reviewed guide, package instructions and next-development prompts | 1,000–1,500 |

## What has already been created

The source checkpoint contains the Node calculation engine, local API, HTML/CSS/JavaScript interface, imports/exports, project storage, original workbook, 43 passing automated tests, comparison reports, development guide in Markdown and Gemini prompts. It is an engineering prototype with browser and independent engineering verification still pending. These files are preserved so later parts can explain or improve them without repeating the work.

## Authoritative workbook inventory

| Item | Finding |
| --- | --- |
| Workbook | Working tool 2026.09.20(4).xlsx |
| Populated tags | 66 |
| Editable input fields | 79, after removing computed helpers and repeated identifiers |
| Pipe records | 355 |
| Unit records | 49 |
| Cases | Minimum, Normal, Maximum, Full scale |
| Modes | Solve for Bore, Solve for Beta, Solve for DP, Check Existing Bore |
| Source copy | source/workbook.xlsx in the archive, unchanged |
| Full field map | docs/FIELD_MAPPING.md and data/fields.json |

SHA-256: 87f8b7621d38a8826b357cb447d26e1fff48e4acd6bc1bc1b332ae1ac40a9092.

## Required behaviour

1. Keep raw inputs and units separate from calculated results. Treat a blank as missing, not zero.
2. Select pipe dimensions from standard, NPS/DN, nominal size and schedule. Recompute manual WT/ID overrides and record review notes.
3. Convert calculations to SI, including gauge-to-absolute pressure and temperature offsets. Distinguish actual, base and stock volume flow.
4. Obtain operating density from the selected property route. Require gamma and the applicable Z values for gas calculations. Record property provenance.
5. Use the workbook RHG/manual coefficient path, tap arrangement, expansibility, thermal dimensions and numerical solve mode.
6. Calculate DP, permanent loss, Reynolds, velocities, beta, bore, density and mass flow for all four cases.
7. Report errors and review notes beside the affected field/case. Distinguish numerical completeness from engineering acceptance.
8. Provide a browser interface with tagged projects, dropdowns, a four-case input matrix, result tables, diagrams, project overview and print layout.
9. Support matching-layout XLSX input, CSV exchange, portable project JSON and local saved projects.
10. Keep independent standards and benchmark review open until actual reference evidence is available.

## Mode requirements

| Mode | Required sizing input | Geometry treatment |
| --- | --- | --- |
| Solve for Bore | Target full-scale DP | Solve reference bore and report operating beta |
| Solve for Beta | Target full-scale DP | Same physical solution; emphasize operating FS beta |
| Solve for DP | Reference bore OR reference beta | Exactly one geometry input; compute case DPs |
| Check Existing Bore | Existing reference bore | Calculate case DPs; compare FS DP to target when supplied |

Stored geometry in target-DP sizing is ignored with a visible note, matching the workbook. Reference dimensions are at 20 °C. If pipe and plate expand differently, operating FS beta differs from reference input beta.

## Source findings requiring attention

- First tag FEH3F1003 -FE is currently Gas with MW + Z and molecular weight 4.5. Its required Z values and gamma are missing. Both bore and beta are entered in DP mode. The application preserves these inputs and reports the problems.
- Output cell 03_Outputs!R7 contains the literal value 1 psi. Its target and hidden calculation correspond to 1.8 psi. The Node result is approximately 1.8000000000045697 psi. This is documented rather than silently copied or corrected.
- The output sheet has 280 cached Excel error cells. Cached values have not been freshly recalculated in Excel.
- Steam Table mode has no implemented property engine. Steam requires supplied, verified properties in this release.
- Pipe-edition checks, complete ISO applicability, uncertainty and independent commercial/reference benchmarking remain open.

## Existing verification evidence

43 automated tests passed on Node 24.19.0 on Linux. Of 1,497 comparable numeric pairs against saved workbook values, 1,496 match the recorded tolerance; the remaining pair is the R7 literal override. Another 1,011 pairs are unavailable and are not counted as passes.

37 of the 66 source tags have all four cases computed. Overall status is 34 CHECK and 32 FAIL; three numerically complete tags fail a project limit. Five additional tags have partial results. The source data has not been repaired by guessing missing values.

Browser visual/interaction verification could not run because Chromium could not be downloaded in this environment. The delivered interface source therefore still needs the browser checklist in docs/DEVELOPMENT_GUIDE.md. Full ISO, CONVAL and Emerson verification has not been performed.

## First action on your computer

Extract the source archive, install Node.js 24 LTS version 24.12 or later within major 24, and open a terminal in the orifice-node folder. Run npm test, then npm start. Open http://127.0.0.1:3000. Windows users can use Start-Windows.bat. There are no runtime npm dependencies or API keys.

For the next reply, request Part 2. Continue from these files; do not repeat Part 1 extraction.
