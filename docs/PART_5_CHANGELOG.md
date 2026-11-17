# Part 5 changes

Engine 0.2.0 replaces 0.1.0 for this package.

- data/units.json: corrected mmH2O_4C and inH2O_4C to NIST factors; retained keys and documented legacy values.
- src/engine.ts: target DP validation respects solve mode; missing existing-bore target is HOLD; water-unit correction note added; gas endpoint range check uses solver mass tolerance.
- src/equations.ts: endpoint residual acceptance precedes bracket-sign rejection. RHG, expansibility and permanent-loss expressions are unchanged.
- src/catalog.ts and package files: version 0.2.0.
- public/index.html: edition text updated; interface behavior is unchanged.
- tests/audit-regressions.test.mjs: nine new regression tests.
- audit/: repeatable independent numerical and catalog checks, pinned Python requirements, legacy unit table and external-benchmark template.
- docs/part5/: current evidence, readiness list, source reconciliation and change hashes.

Original workbook and pipe catalog preserved. All 66 original tags retain their case values, reference bores and statuses. Prior Part 3/4 evidence is historical; the Part 5 report is authoritative for this version.
