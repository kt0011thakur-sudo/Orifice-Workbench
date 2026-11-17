# Part 5 — Calculation verification and engineering readiness

**Audit date:** 3 October 2026  
**Delivered engine:** 0.2.0  
**Outcome:** Numerical verification completed for the stated test scope. **Engineering release remains HOLD.**

Part 4 retained the Part 3 calculation engine. Part 5 has now checked that engine, corrected four confirmed behaviors and produced repeatable evidence. This report distinguishes software checks, workbook agreement, external implementation comparisons and the items that require an engineering approver.

The complete ZIP includes the application and previous UI. Extract it as a new working folder. Preserve existing project backups before moving to this version.

## 1. What was completed

| Check | Result | Evidence in this package |
|---|---|---|
| Node engine/backend/import-export regression suite | **55 passed, 0 failed**, including nine new audit regressions | `docs/part5/node-tests.txt` |
| Separate implementation: synthetic inputs | **288 scenarios, 1,152 operating cases, 17,568 scalar comparisons; no mismatches** | `docs/part5/independent-comparison.json` and `.csv` |
| Separate implementation: supplied workbook | **157 computable cases, 2,397 scalar comparisons; no mismatches** | Same comparison files |
| Unit factors and offsets | **49/49 pass after correcting two factors**; legacy table passed 47/49 | `docs/part5/data-audit.json` |
| Pipe catalog internal checks | **355 records**, no OD/WT/ID arithmetic failures or duplicate standard/NPS/schedule keys | Same data audit |
| Manufacturer pipe spot checks | Eleven Schedule 40 selections: ten complete matches within declared rounding; one inconsistent reference ID | Same data audit |
| Workbook cached-output comparison | **1,694 of 1,695 comparable values match**; the remaining mismatch is the existing R7 override | `docs/part5/workbook-cache-comparison.csv` |
| Source workbook integrity | Original SHA-256 preserved | Data audit and existing import tests |

These are counts of the actual checks, not independent physical experiments. A numerical comparison passing does not establish that the entered properties, installation or plate design are suitable.

## 2. Confirmed defects corrected

| ID | Finding in engine 0.1.0 | Correction in 0.2.0 | Effect |
|---|---|---|---|
| P5-01 | `mmH2O_4C` and `inH2O_4C` used conventional-water factors despite the 4°C labels | Changed to **9.80638 Pa/mm** and **249.082 Pa/in**, using NIST SP 811 B.9 [S3] | Corrects the unit definitions; water-unit projects must be reviewed/recalculated |
| P5-02 | In Solve for DP, an unused target DP of zero or a negative number blocked a valid fixed-bore calculation | Target positivity is applied when target DP is used by the selected solve mode | Fixed-bore DP no longer depends on an inactive target; the unused-target note remains |
| P5-03 | Check Existing Bore could show complete results without explicitly saying that no target comparison occurred | A missing target now adds `EXISTING_TARGET_MISSING` with **HOLD** status | Fixed-bore values remain visible, but the requested comparison is clearly incomplete |
| P5-04 | A gas result exactly at the supported 0.75 downstream/upstream pressure ratio could be rejected because of a tiny negative endpoint residual | Apply the same mass-residual tolerance to the range check and bisection endpoint acceptance before rejecting the bracket | Exact-boundary numerical solutions are accepted; materially excessive flow is still rejected |

The gas regression uses a 250 kPa target at 1,000 kPa upstream absolute pressure. Previously its full-scale case was rejected despite a feasible solution. The corrected result meets the boundary and the solver residual criterion. A fixed-bore flow increased beyond capacity by a relative 1e-6 is still rejected; no out-of-range DP is substituted.

RHG coefficients, the expansibility equation and the permanent-loss equation were not altered. Input validation, solver boundary handling, two unit coefficients and the version identifier changed. Full file hashes and differences from Part 4 are recorded in `docs/part5/change-manifest.json`.

### Existing-project migration

All 66 supplied tags use **psi** for DP, so the water-factor correction does not change their computed values. The audit confirms that their case values, reference bores and statuses remain unchanged from Part 4.

For other saved projects using water-column units, the difference is about **0.00275–0.00277%**. Review the intended unit basis before recalculating. If a legacy numerical pressure was intended to preserve its old physical value in Pa, its equivalent corrected 4°C value is:

`new numeric pressure = old numeric pressure × old factor / new factor`

Apply that review to target and acceptance-limit pressures as applicable. The application does not silently rewrite saved inputs. The water-unit calculation note identifies the correction, and result metadata reports engine 0.2.0.

## 3. Independent numerical comparison method

`audit/independent-check.py` uses **Fluids 1.3.1** and **SciPy 1.17.0**, with its own normalization and a Brent root solver. It imports no hydraulic function or conversion coefficient from the Node application. The external library provides separately maintained RHG, expansibility and permanent-loss implementations [S4].

The synthetic matrix covers:

- Three phases: liquid, gas using supplied MW/Z, and steam using supplied manual properties.
- Flange, corner and D/D2 taps.
- Reference pipe IDs of 60 and 100 mm, including the small-diameter RHG correction branch.
- Thermal expansion on/off, separate pipe/plate coefficients and changing case temperatures.
- RHG and manual Cd; all four solve modes; four operating cases per scenario.

Expected target DP is generated independently for a known reference bore before Node solves the case. The comparison then checks bore, normalized conditions, density/mass flow, Reynolds number, Cd, expansibility, DP, permanent loss, velocities and pressure ratio.

Tolerance is **max(1e-8 absolute, 1e-7 relative)** for most quantities. Pressure quantities use a **1e-5 Pa absolute floor** to accommodate subtraction in the independent implementation. The largest observed relative differences were approximately **8.23e-11** for the synthetic matrix and **6.85e-11** for workbook cases.

Fluids includes extra low-Re terms and references earlier standard editions. The comparison is restricted to computed cases at Re ≥ 5,000, where those extensions are inactive. Its documentation displays a small-diameter coefficient differently from its installed code; the installed implementation uses 0.011, matching this application's equation. The installed version and actual executed functions, rather than a copied documentation expression, were used.

This verifies agreement between implementations under the declared assumptions. Supplied densities, viscosity, gamma, Z, the inherited SG reference and pipe catalog values are not independently validated physical properties by this comparison. It does not replace a check against the complete 2022 standards.

## 4. Workbook reconciliation and tag readiness

The source remains `Working tool 2026.09.20(4).xlsx`, included as `source/workbook.xlsx`.

SHA-256:

`87f8b7621d38a8826b357cb447d26e1fff48e4acd6bc1bc1b332ae1ac40a9092`

| Workbook result | Count |
|---|---:|
| Populated tags | 66 |
| All four cases numerically computed | 37 |
| Partial calculations | 5 |
| No case computed | 24 |
| CHECK status | 34 |
| FAIL status | 32 |
| Numerically complete tags that still FAIL acceptance checks | 3 |

Use `docs/part5/tag-readiness.csv` to see each tag's status and issue codes. Missing fluid properties, out-of-scope dimensions, infeasible beta/DP combinations and Reynolds limits are examples of conditions requiring attention. Correct source inputs using verified process data; do not fill blanks with guesses merely to obtain a result.

The cached comparison covers geometry and calculated quantities mapped from visible output columns I–AX: five tag-level values and nine quantities across four cases. It compares 1,695 numeric pairs; 1,011 mapped pairs cannot be compared because one side is missing, nonnumeric or unavailable. The comparable count exceeds the earlier reported 1,497 because this audit also includes the three pipe-dimension columns for all 66 tags (198 additional values).

**R7 finding:** `03_Outputs!R7`, belonging to **FEH3F1006 -FE**, contains literal **1**, not a formula. Its hidden `RO7` cache is approximately **12,410.563128 Pa**, equivalent to **1.8 psi**. Node computes **1.8000000000045697 psi**. The audit reports this as a source override; it has not overwritten the original workbook. Excel itself was not recalculated during this audit.

## 5. Pipe and unit evidence

All 355 pipe records satisfy positive geometry and `ID = OD − 2 × WT` within the check tolerance. This establishes internal consistency only.

Eleven carbon-steel Schedule 40 selections were compared with Wheatland's WFS-121824 manufacturer sheet [S5]. OD and WT match in all eleven. Ten IDs agree within 0.08 mm, allowing for that sheet's one-decimal metric rounding. The NPS 5 row in the manufacturer sheet prints **158.2 mm ID**, despite listing **141.3 mm OD** and **6.55 mm WT**. The resulting 128.2 mm ID and its 5.047-inch figure agree with the tool. This reference inconsistency was retained as evidence; the catalog was not changed to copy it.

Full ASME table/edition verification, stainless schedules, tolerances, actual measured pipe ID and project material selection remain open. ASME's product pages identify B36.10-2022 and B36.19-2022, with the latter listing May 2023 errata [S6–S7]. A catalog label alone does not establish conformity to those editions.

The 49 numeric conversion factors/offsets were checked using independently expressed SI/customary relationships and NIST water-column values. Important assumptions remain:

- Gauge pressures use a fixed **101.325 kPa atmospheric reference**. Site atmospheric pressure is not an editable engine input.
- Base/standard volume depends on supplied base pressure, temperature, Z or density; S/N labels alone do not establish the project's reference conditions.
- Stock volume depends on density at the stated stock condition. “SUS kbbl/d @60F” is an inherited label whose naming is not independently standardized by this audit.
- The liquid SG multiplier **999.016 kg/m³** and gas reference molecular weight **28.9625 kg/kmol** are inherited assumptions requiring an agreed property basis.

## 6. Engineering release requirements still open

ISO's public pages confirm ISO 5167-1:2022 and ISO 5167-2:2022 and the broad single-phase, subsonic, nonpulsating-flow scope. Part 2 covers the three supported tap arrangements and states broad pipe-size/Re limits [S1–S2]. Full clauses and installation tables were not available for a complete clause audit.

| Release requirement | Present behavior / gap | Evidence required to close it |
|---|---|---|
| Full 2022 applicability | Engine uses a global Re minimum of 5,000 and beta range 0.20–0.75; detailed tap/beta/Re and dimensional applicability is incomplete | Controlled clause matrix from licensed ISO 5167-1/-2:2022, reviewed by a competent engineer |
| Pipe roughness and plate geometry | Roughness presence is screened; complete relative-roughness, edge, bevel, thickness and installation geometry checks are absent | Governing limits, plate drawing and measured dimensions |
| Straight runs | “Published guidance” is inherited screening data; project-entered distances can be compared but are not automatically validated against ISO | Exact disturbance configurations, beta-dependent requirements and installation evidence |
| Fluid properties | Density, viscosity, gamma and Z depend on user-supplied data or simple supplied-property calculations | Traceable property calculation/report at every operating case |
| Steam | Supplied single-phase steam properties are supported; automatic steam tables and wet-steam behavior are absent | Verified steam state/quality and properties, with applicable method |
| Compressibility and phase limits | Pressure-ratio screening does not establish local Mach number or absence of phase change | Subsonic/single-phase applicability review; liquid cavitation/flashing assessment where relevant |
| DP transmitter | Generic project limits do not verify a selected transmitter | Model/range, calibrated span, static pressure, temperature, overpressure and required performance |
| Uncertainty | Complete measurement uncertainty calculation is absent | Traceable uncertainty budget under the governing method and project requirement |
| Mechanical suitability | Hydraulic sizing does not establish plate structural adequacy, material or pressure class | Applicable mechanical design/material review |
| Emerson/CONVAL benchmarks | **NOT RUN** in Part 5 | Matched input/output exports, software version and method settings |
| Formal approval | `engineeringVerified` remains **false** | Recorded review and release authorization after the applicable requirements close |

A concrete coverage probe is included in `docs/part5/reynolds-coverage-probe.json`: a corner-tapped, beta 0.70 calculation at Re approximately 5,500 is numerically complete with CHECK status. This demonstrates the limited present screening and why numerical completion cannot close standards applicability.

## 7. Complete the remaining work, one step at a time

1. **Run this delivered version.** Use Node 24.12 or newer within major 24. Run `npm test`, then `npm start` and open `http://127.0.0.1:3000`.
2. **Review tag inputs.** Start with `tag-readiness.csv`. Resolve each FAIL using verified source data. Keep intentional project limitations visible.
3. **Close the source discrepancy.** Decide, under your workbook revision process, whether R7 should be restored to its calculated output. The supplied original is unchanged.
4. **Verify the standards matrix.** Review the licensed editions and list each applicable clause, implemented rule, boundary test and remaining limitation.
5. **Confirm dimensions and properties.** Record the controlled pipe references, actual dimensions where required and property source at all four conditions.
6. **Obtain matched vendor benchmarks.** Use `audit/external-benchmark-template.json`; record version, tap type, bore/pipe reference temperatures, fluid basis, pressures, units and rounded/unrounded outputs. Record differing methods rather than forcing agreement.
7. **Review uncertainty and instrument/mechanical selection.** Resolve these before issuing an engineering datasheet or plate specification.
8. **Record approval.** A named authorized reviewer should approve the stated scope and remaining exclusions. Do not infer approval from passing software tests or an “Approved by” text field.

### Repeat the numerical audit

Python is required only for the extra audit scripts, not for running the Node application. The dependency file records the versions used in this run. A separate virtual environment is recommended.

```sh
python -m pip install -r audit/requirements.txt
python audit/independent-check.py
python audit/data-audit.py
```

Both scripts write their evidence under `docs/part5/`. The source-cache audit uses the retained Part 4 baseline snapshot for numeric-change detection. No external engineering system is contacted by these scripts.

The prior Part 4 browser evidence and screenshots remain in the package as historical evidence for that version. The browser suite was not rerun in Part 5; the current 55-test run covers the engine, HTTP APIs, imports and persistence. No deployment was performed.

## 8. Gemini continuation instruction

> Continue from the Orifice Part 5 package, engine 0.2.0. Read this report, README.md and docs/part5/change-manifest.json. Preserve the four audited corrections, the review flags and original source workbook. Use the pinned independent-comparison scripts and regression tests when changing calculations. Do not replace missing properties with guessed values. Close the explicit engineering release requirements using controlled references and matched benchmark exports. Record the evidence and actual tested scope. Do not mark engineeringVerified true automatically. Work on the next requested part only.

## Sources checked on 3 October 2026

- **S1 — ISO 5167-1:2022, official scope and edition:** <https://www.iso.org/standard/79179.html>
- **S2 — ISO 5167-2:2022, official scope and edition:** <https://www.iso.org/standard/79180.html>
- **S3 — NIST SP 811, Appendix B.9, pressure conversion factors:** <https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9>
- **S4 — Fluids 1.3.1, author-maintained flow-meter documentation and linked source:** <https://fluids.readthedocs.io/fluids.flow_meter.html>
- **S5 — Wheatland Schedule 40 sheet, WFS-121824, page 2:** <https://www.wheatland.com/wp-content/uploads/2017/12/Schedule-40-Submittal-Sheet.pdf>
- **S6 — ASME B36.10-2022, official product listing:** <https://www.asme.org/codes-standards/find-codes-standards/welded-and-seamless-wrought-steel-pipe-%281%29/2022/print-book>
- **S7 — ASME B36.19-2022 with May 2023 errata, official product listing:** <https://www.asme.org/codes-standards/find-codes-standards/welded-and-seamless-wrought-stainless-steel-pipe-%28w-5-23-errata%29/2022/pdf>

The source workbook, retained Part 4 snapshot, executed tests and generated comparison files are the direct evidence for findings specific to this application.
