> Historical stage document. For current setup and behavior, read PART_6_FINAL_GUIDE.md and PART_5_ENGINEERING_VERIFICATION.md. Part 5 corrected two water-column factors, mode-specific target validation, missing-target HOLD behavior and a solver endpoint tolerance. Earlier verification counts and pending-browser statements describe their original delivery.

# Orifice tool Part 2 Excel to Node calculation logic

Part 2 is complete. This guide accompanies Orifice_Part_2_Logic_Package.zip. It uses the unchanged calculation engine from the Part 1 checkpoint and adds a runnable mode walkthrough. The source workbook is Working tool 2026.09.20(4).xlsx.

## 1 Run the logic independently

Extract the ZIP and open a terminal in the orifice-part-2 folder, where package.json is located. Use Node.js 24 LTS version 24.12 or later within major 24.

```sh
node --version
npm test
npm run walkthrough
npm run demo
```

There are no runtime npm dependencies or API keys. The walkthrough runs the four solve modes, both geometry input choices for DP mode, a gas example and the invalid first source tag. The .ts files contain TypeScript executed by Node's native type stripping; this is not static type checking.

Keep the package folders together. The engine imports its unit/pipe catalogs and manifest using paths relative to its source files. Copying only engine.ts is insufficient.

## 2 Separate the input contract from the equations

One workbook tag becomes one input object. Use named fields instead of cell addresses in the calculation functions. Keep numeric inputs as numbers and blanks as null. Preserve the original entered units and notes.

| File | Responsibility |
| --- | --- |
| src/types.ts | TagInput, case names and issue types |
| data/fields.json | 79 editable fields, source columns, data types and dropdown choices |
| src/catalog.ts | Exact lookup and SI conversion helpers; constants and version information |
| src/equations.ts | Pure equations and bisection; no workbook, browser or storage dependency |
| src/engine.ts | Input validation, properties, solve modes, case results and checks |
| src/defaults.ts | Complete synthetic water example |
| scripts/walkthrough.mjs | Calls the engine in each mode and checks equivalent outcomes |

The entry points are calculateTag(input) and calculateBatch(tags). The batch function detects duplicate tag identifiers and enforces the 500-tag limit. The engine does not modify its input object.

Each case uses a suffix: Min, Normal, Max or Fs. For example, flowFs is full-scale flow and pressureNormal is normal upstream pressure. Units such as pressureUnit apply to all four values. examples/demo-project.json is a complete input example; examples/demo-result.json is the corresponding actual engine output.

## 3 Translate Excel behaviour explicitly

| Excel mechanism | Node equivalent |
| --- | --- |
| Cell references | Named object properties and function arguments |
| IF / AND / OR | Explicit branches, && and || |
| Exponent operator ^ | **; JavaScript ^ is a bitwise operator, not exponentiation |
| PI(), SQRT(), EXP() | Math.PI, Math.sqrt(), Math.exp() |
| SUMIFS used as a lookup | Match exactly one catalog record; reject missing or duplicate records |
| IFERROR returning blank | Structured issue with a code, message, field and case |
| Empty input cell | null; do not coerce it to zero |
| Repeated iteration columns | A bounded solver function with a numerical stopping test |
| Cached output | Comparison evidence only, never the runtime calculation authority |

Do not evaluate arbitrary Excel formulas at runtime. Read checked inputs into the contract and call the tested Node functions. In particular, a manually typed output such as 03_Outputs!R7 must not become a calculation rule.

Representative source traceability is retained in docs/excel-row5-formulas.json. The following addresses use row 5 in 03_Outputs; they illustrate the minimum case where case-specific.

| Source cells | Meaning | Node implementation |
| --- | --- | --- |
| BK5, BL5, BN5 | Reference pipe ID, viscosity, target DP in SI | catalog.ts and engine.ts normalization |
| BS5, BT5 | Absolute temperature and upstream pressure | toSI |
| BU5, BV5 | Operating density and mass flow | Property and flow-basis branches |
| BW5, BX5 | Operating pipe diameter and Reynolds number | Thermal normalization and reynolds |
| BY5, BZ5 | Normalized tap distances | tapFactors |
| OC5, OD5, OE5 | Reference bore, operating bore and beta | Solve mode and thermal geometry |
| OF5 | RHG or manual Cd | rhg or manualCd |
| OG5 | Incompressible DP expression | liquidDp |
| OV5, OW5 | Expansibility and permanent loss | expansibility and permanentLoss |

## 4 Convert all internal quantities to SI

Internal units are metres, kg/s, kg/m³, Pa, K and Pa·s. Store units alongside the inputs, convert at the calculation boundary, and convert back only for display/export. Keep full numerical precision through the solve.

```js
valueSI = input * multiplier + offset;
valueDisplay = (valueSI - offset) / multiplier;
```

For example, 1 bar(g) becomes 201325 Pa absolute using the inherited atmospheric offset of 101325 Pa. Zero °C becomes 273.15 K, and 1 cP becomes 0.001 Pa·s. Reject nonpositive absolute pressure or temperature. DP is a pressure difference and does not receive the atmospheric offset.

Flow conversion depends on its basis:

| Basis | Conversion to mass flow |
| --- | --- |
| Mass | Apply the unit multiplier |
| Actual volume | Convert volume flow to m³/s and multiply by operating density for that case |
| Base volume | Convert to reference m³/s and multiply by density at the stated base conditions |
| Stock volume | Convert to stock m³/s and multiply by supplied stock reference density |

For base-volume units, require base absolute pressure, temperature and Z. The names Sm3/h or Nm3/h do not supply universal reference conditions. The engine also requires these conditions when base density is entered directly. If base density is calculated, molecular weight or gas SG is also needed. Stock-volume flow requires a supplied stock density; the selected @60F unit specifies the reference temperature.

This migration corrects the source's omission of ft3/d actual from its long flow-basis IF expression: Node follows that unit's actual-volume basis in the extracted table.

## 5 Resolve pipe and thermal geometry

Match the selected dimensional standard, size system, nominal size and schedule against one pipe record. Then apply the active ID mode:

- AUTO uses catalog ID and wall thickness.
- MANUAL WT uses ID = OD − 2 × wall thickness.
- MANUAL ID uses the entered ID and derives wall thickness = (OD − ID) / 2.

Reject impossible dimensions. Keep the reference pipe ID and bore separate from operating dimensions. The reference temperature in this workbook is 20 °C, or 293.15 K.

```js
pipeM = referencePipeM * (1 + pipeAlpha * (temperatureK - 293.15));
boreM = referenceBoreM * (1 + plateAlpha * (temperatureK - 293.15));
beta = boreM / pipeM;
```

Pipe and plate coefficients can differ. Therefore, the reference beta entered in DP mode is not generally the same as the operating full-scale beta reported after thermal expansion. Always label which ratio is being used.

## 6 Determine operating fluid properties

| Phase and basis | Required operating property inputs |
| --- | --- |
| Liquid, Direct Density or Manual Properties | Density for each case, density unit and dynamic viscosity |
| Liquid, Specific Gravity | Liquid SG and dynamic viscosity; source uses water reference density 999.016 kg/m³ |
| Gas, Direct Density or Manual Properties | Density for each case, density unit, dynamic viscosity and gamma |
| Gas, MW + Z | Molecular weight, Z for each case, dynamic viscosity and gamma |
| Gas, Gas SG + Z | Gas SG, Z for each case, dynamic viscosity and gamma |
| Steam, Direct Density or Manual Properties | Independently supplied case densities, dynamic viscosity and gamma |

Every path also needs the four operating temperatures/pressures and an identified property source. One viscosity value applies to all cases in the source contract. Automatic Steam Table mode is explicitly unavailable. Base Density is used for reference-volume flow conversion, not as an ambiguous operating-density method.

The gas-density calculation is:

```js
rho = pressurePa * molecularWeight / (Z * 8314.46261815324 * temperatureK);
```

Molecular weight is in kg/kmol. For Gas SG + Z, molecularWeight = specificGravity × 28.9625. These constants and SG conventions come from the workbook and require an applicable property reference. A fluid name never causes the engine to guess density, Z, gamma or viscosity.

## 7 Calculate Reynolds number and discharge coefficient

Using case mass flow and operating pipe diameter:

```js
Re = 4 * massKgS / (Math.PI * viscosityPaS * pipeM);
```

For RHG, Cd depends on beta, Reynolds number, pipe diameter and tap arrangement. equations.ts contains the complete source-transcribed expression, including the small-pipe correction below 71.12 mm. Do not replace it with a fixed Cd of 0.61; that value is only suitable when explicitly selected and justified as a manual coefficient.

| Tap arrangement | L1 | L2 |
| --- | --- | --- |
| Corner | 0 | 0 |
| D and D/2 | 1 | 0.47 |
| Flange | 0.0254 / operating pipe diameter in m | Same |

At fixed mass flow, viscosity and pipe diameter, Reynolds number is already known. During bore sizing, changing trial bore changes beta and therefore Cd. During a fixed-geometry DP solve, beta and Cd stay fixed for that case; expansibility changes with trial DP.

## 8 Apply the orifice equations

Use m for mass flow, rho for upstream operating density, d for operating bore, D for operating pipe diameter, beta = d/D, C for Cd, and Y for expansibility. The workbook relationship is:

```js
area = Math.PI * d ** 2 / 4;
m = C * Y * area * Math.sqrt(2 * rho * dpPa / (1 - beta ** 4));
```

For liquid, Y = 1 and fixed-geometry DP is direct:

```js
dpPa = (m / (C * area)) ** 2 * (1 - beta ** 4) / (2 * rho);
```

For gas or supplied-property steam, Y depends on DP and the supplied isentropic exponent gamma:

```js
Y = 1 - (0.351 + 0.256 * beta ** 4 + 0.93 * beta ** 8)
  * (1 - (1 - dpPa / pressurePa) ** (1 / gamma));
```

These expressions describe the implemented workbook migration. They are not a substitute for a full governing-standard applicability review.

## 9 Apply the selected solve mode

| Mode | Active input | Output procedure |
| --- | --- | --- |
| Solve for Bore | Target full-scale DP | Solve reference bore at FS conditions, then compute all cases |
| Solve for Beta | Target full-scale DP | Same physical bore solution, reporting operating FS beta |
| Solve for DP | Exactly one reference bore OR reference beta | Keep reference geometry fixed; compute all case DPs |
| Check Existing Bore | Existing reference bore, beta blank | Compute case DPs; compare FS DP with target if supplied |

Stored bore/beta values in target-DP sizing are ignored with a review note, as in the workbook. In DP mode, clear the unused geometry field; also clear targetDp if it is not needed. Existing-bore mode's requirement to clear beta is an explicit input-hygiene rule in this implementation.

For target-DP sizing:

1. Use full-scale pressure, temperature, density, mass flow and Reynolds number.
2. Transform the operating beta bounds into a reference-bore interval using the pipe and plate expansion factors. Also enforce the implemented minimum bore.
3. At each trial reference bore, calculate operating bore, beta, Cd and Y at the fixed target DP.
4. Calculate residual = predicted mass − required mass.
5. Verify opposite residual signs at the interval ends. Report an infeasible bound if the solution lies outside the interval.
6. Bisect until the absolute mass residual is within max(1e-12 kg/s, required mass × 1e-11). Stop with an error after 100 iterations.
7. Keep the solved reference bore and compute the other cases with their own properties and operating dimensions.

For fixed-geometry gas DP, bisect on DP instead of bore. The supported interval is 0 to 0.25 × upstream absolute pressure, corresponding to downstream/upstream pressure ratio at least 0.75. Never clip an excessive required DP and report it as a solution. This release does not calculate choked-flow capacity.

## 10 Calculate permanent loss and velocities

Measured DP and permanent pressure loss are different quantities. The source loss expression is:

```js
s = Math.sqrt(1 - beta ** 4 * (1 - C ** 2));
permanentLossPa = dpPa * (s - C * beta ** 2) / (s + C * beta ** 2);
pipeVelocity = m / (rho * Math.PI * D ** 2 / 4);
boreVelocity = m / (rho * Math.PI * d ** 2 / 4);
```

Return all four case records with bore, beta, Cd, Y, DP, permanent loss, Reynolds, density, mass flow, velocities and pressure ratio. Compressed-flow DP roots also carry iteration count and mass residual. Convert DP/loss to the selected output unit; retain their Pa values as well.

## 11 Apply validation and preserve unavailable results

The implementation currently enforces pipe ID 50–1000 mm, bore at least 12.5 mm and beta within the configured bounds inside 0.20–0.75. Blank beta bounds default to 0.20 and 0.75; explicit zero is invalid. Positive-flow cases below Reynolds 5000 are unavailable. This inherited threshold does not implement every tap/beta-dependent ISO requirement.

Zero flow returns zero DP/loss/velocity and Cd = null, with a review issue. A missing active input fails validation before sizing. A later case-specific calculation/domain failure can leave other cases available. Missing values must not be filled by reusing a different case without an explicit user decision.

Project minimum DP checks FS; project maximum DP checks the Maximum case, preserving the workbook's meaning. Positive velocity limits check every case. Existing-bore comparison uses the supplied tolerance or a 5% default. Straight-run and roughness review remain distinct from numerical convergence.

Return structured issues, complete and engineeringVerified. complete means all four cases have outputs. It does not mean all project limits pass. engineeringVerified remains false. The full standards, dimensional catalog edition, uncertainty and independent benchmark review remain pending.

## 12 Check the delivered results

The 30 focused calculation tests passed in this standalone package. The separate walkthrough assertions also passed for mode consistency, fixed bore/beta inputs, gas target DP and rejection of the incomplete first source tag. Logs are in docs/part-2-test-results.txt and docs/walkthrough-output.txt.

The synthetic water demo has a 4 NPS Schedule 40 pipe with reference ID 102.26 mm, FS mass flow 10 kg/s, density 998.2 kg/m³, dynamic viscosity 1.002 cP, temperature 20 °C, pressure 10 bar(a), target DP 50 kPa, flange taps and RHG Cd.

| Full-scale result | Actual calculated value |
| --- | --- |
| Reference bore | 45.4973652368 mm |
| Operating beta | 0.4449184944 |
| DP | Approximately 50 kPa |
| Cd | 0.6034602774 |
| Reynolds number | 124261.5048 |
| Permanent loss | 39.2082148265 kPa |
| Pipe velocity | 1.2197785061 m/s |
| Bore velocity | 6.1619767953 m/s |
| Status | CHECK, with engineering review pending |

The existing Part 1 project has 43 total tests across engine, API and exchange. This Part 2 run deliberately tests the 30 calculation tests; it does not claim a new browser or commercial-software benchmark pass.

## Gemini continuation instruction

Continue from the attached orifice-part-2 source. Read this guide and run npm test and npm run walkthrough before editing. Preserve calculateTag/calculateBatch and the field contract. For Part 3, wrap those functions in the backend API; do not duplicate or alter numerical equations to fit UI behaviour. Treat missing gas properties and source output overrides as review issues, not values to guess. Preserve engine/catalog provenance, raw input units, issue codes and engineeringVerified:false. Return changed files and checks actually executed.

Part 2 is complete. The next deliverable is Part 3: Node backend, APIs, imports and project storage.
