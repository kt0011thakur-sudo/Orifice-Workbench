# Gemini handoff - Orifice Workbench Part 6

## Files to supply

Use the complete **Orifice_Part_6_Complete_Package.zip** or extracted **orifice-part-6** folder. If only a few files can be supplied, start with README.md, PART_6_FINAL_GUIDE.md, this file and the source/tests needed for one task. The original workbook is included; do not repeat extraction without a new workbook revision.

Gemini develops code. The running tool does not call Gemini or require its API key.

## Bootstrap prompt - copy once

~~~text
Continue from the supplied Orifice Workbench Part 6 package. Do not rebuild from scratch or paste the whole application into chat.

Read README.md, docs/PART_6_FINAL_GUIDE.md, docs/PART_5_ENGINEERING_VERIFICATION.md, docs/part6/VERIFICATION.md and docs/GEMINI_HANDOVER.md. Then read only the source needed for the selected task.

Baseline: engine 0.2.0, project schema 1, Node >=24.12.0 <25. Plain HTML/CSS/JavaScript/SVG frontend, native Node HTTP backend, zero runtime npm dependencies. src/engine.ts handles inputs, properties and solve modes; src/equations.ts has pure equations. The browser renders server results and does not duplicate hydraulic calculations.

The original source/workbook.xlsx has SHA-256 87f8b7621d38a8826b357cb447d26e1fff48e4acd6bc1bc1b332ae1ac40a9092. Preserve it, its field mapping and the source discrepancy record.

Part 6 has 61 passing Node tests and 17 passing browser workflows in the stated Linux environment. Retain Part 5 independent-comparison evidence, distinguishing historical checks from checks you actually run. Engineering release remains HOLD, with engineeringVerified:false. Passing tests and reviewer-name fields cannot grant approval.

Preserve blank-versus-zero handling, units/property bases, reference/operating geometry, all four Part 5 corrections, no clipped gas DP, unavailable results, validation notes, stale-calculation rejection, draft-preserving saves and revision conflicts. Do not invent missing properties, standards clauses or vendor benchmarks.

Work on one bounded task per response. State acceptance criteria, implement the minimum change, run meaningful checks and report actual results. Keep explanation under about 800 words unless the task needs more. Deliver changed files or a patch plus a checkpoint, not unchanged source. If controlled evidence is missing, name it and preserve existing behavior. Do useful independent work before asking questions.

First confirm the runnable baseline and identify at most three next tasks. Then complete the one selected by the user. Do not deploy publicly, send project files externally or introduce a paid/runtime AI service without an explicit request.
~~~

## Baseline facts to retain

| Subject | Fact |
| --- | --- |
| Source | 66 tags, 79 fields, 355 pipes, 49 units |
| Source outcome | 37 complete, 5 partial, 24 without cases; 34 CHECK / 32 FAIL |
| Discrepancy | 03_Outputs!R7, FEH3F1006 -FE, literal 1 psi; target/hidden output and Node approximately 1.8 psi |
| Part 5 fixes | Corrected 4 C water factors; inactive-target validation; absent existing-target HOLD; gas solver boundary tolerance |
| Part 6 boundary | Startup/docs/evidence and record-wrapping CSS; engine/API/importers/catalogs unchanged from Part 5 |
| Storage | Latest snapshot with revisions, no history store; one process per directory |
| Hosting | Local loopback, no login or multi-user architecture |
| Open engineering scope | Full applicability, validated properties, uncertainty, mechanical/transmitter/installation review, commercial benchmarks and sign-off |

## Bounded follow-up prompts

These are future tasks, not features claimed in Part 6.

### A. Target Windows acceptance

~~~text
Verify Part 6 on my Windows computer: Node version, full extraction, startup preflight, Start-Windows.bat, demo baseline, save/reopen after restart, JSON backup/restore and print preview. Use a temporary test project and record actual OS/Node/browser versions. Fix only observed platform defects, preserving calculations. If you cannot run Windows, give a checklist and clearly mark it unexecuted.
~~~

### B. Matched commercial benchmark intake

~~~text
Use audit/external-benchmark-template.json and the exports I provide. Match units, phase, property basis, taps, dimensions/reference temperature, process conditions, coefficient method and software version. Compare only equivalent cases with declared tolerances. Add a repeatable comparator and report incomparable/missing values separately. Do not fabricate Emerson/CONVAL outputs or count missing values as passes. Keep engineeringVerified:false.
~~~

### C. One standards applicability rule

~~~text
Using the controlled excerpt I provide, implement exactly one agreed applicability rule. Map clause/edition, inputs, allowed range and boundary cases. Add meaningful failing tests, implement the rule and its UI message, run relevant regressions and independent comparisons. Record engine-version and migration effects. Do not claim complete ISO compliance from this one rule.
~~~

### D. One interface improvement

~~~text
Improve only [describe the screen behavior]. Preserve calculation authority on the server, field names, API contracts, validation notes, explicit unit behavior, stale-result invalidation and engineering-review status. Verify affected desktop/mobile/print flows. Return changed files and actual verification results.
~~~

## Verification policy

Baseline commands: **npm run verify:package**, **npm run doctor**, **npm test**, **npm start**.

Backend walkthrough: **npm run api:walkthrough**.

Browser development: **npm ci**, **npx playwright install chromium**, **npm run test:browser**.

For engineering changes, read Part 5 methodology before running optional Python audits. Node type stripping is not static type checking. Browser/Python scripts overwrite their documented evidence outputs; preserve a baseline copy or commit before rerunning.

After intentional changes, the original manifest should identify modified files. Create a new reviewed release manifest only for a new release, recording the changes. Do not refresh hashes to disguise a failed integrity check.

## Save this checkpoint after each task

~~~text
TASK:
ACCEPTANCE CRITERIA:
FILES CHANGED:
BEHAVIOR BEFORE / AFTER:
CHECKS ACTUALLY RUN AND RESULTS:
CHECKS NOT RUN / LIMITATIONS:
ENGINE VERSION AND PROJECT-SCHEMA EFFECT:
ENGINEERING RELEASE STATUS:
NEXT SINGLE TASK:
~~~

Keep checkpoints with the source so another session resumes without repeating workbook analysis or filling its response with unchanged code.
