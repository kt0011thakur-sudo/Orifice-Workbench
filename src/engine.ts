import type { TagInput, Issue, CaseName, Severity } from './types.ts';
import { CASES, CONSTANTS, STANDARD, VERSION, fields, findPipe, fromSI, manifest, toSI, unitEntry } from './catalog.ts';
import { area, bisect, capacity, criticalRatio, expansibility, liquidDp, permanentLoss, reynolds, rhg } from './equations.ts';

type CaseState = { name: CaseName; temperatureK: number; pressurePa: number; density: number; massKgS: number; pipeM: number; plateFactor: number; re: number; };
type CaseResult = CaseState & { boreMm: number; beta: number; cd: number | null; y: number; dpPa: number; dp: number; permanentLossPa: number; permanentLoss: number; pipeVelocity: number; boreVelocity: number; pressureRatio: number; criticalRatio: number | null; iterations: number; residualKgS: number; };
export type Result = { tag: string; engineVersion: string; sourceHash: string; engineeringVerified: false; complete: boolean; status: string; issues: Issue[]; cases: Partial<Record<CaseName, CaseResult>>; referenceBoreMm: number | null; fsBeta: number | null; dpUnit: string; geometry: null | {odMm: number; wtMm: number; idMm: number; source: string}; solver: unknown; straightRun?: {requiredUpstreamD: number | null; requiredDownstreamD: number | null; status: string}; };

const missing = (v: unknown) => v === '' || v === null || v === undefined;
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const caps = (s: string) => s[0].toUpperCase() + s.slice(1);

export function calculateTag(input: TagInput): Result {
  const t = input as Record<string, unknown>;
  const result: Result = {tag: typeof input?.tag === 'string' ? input.tag : '', engineVersion: VERSION, sourceHash: manifest.sha256,
    engineeringVerified: false, complete: false, status: 'FAIL', issues: [], cases: {}, referenceBoreMm: null, fsBeta: null,
    dpUnit: typeof input?.dpUnit === 'string' ? input.dpUnit : '', geometry: null, solver: null};
  const issue = (code: string, message: string, field?: string, caseName?: CaseName, severity: Severity = 'FAIL') => {
    result.issues.push({code, severity, message, ...(field ? {field} : {}), ...(caseName ? {case: caseName} : {})});
  };
  const finish = () => {
    result.status = result.issues.some(x => x.severity === 'FAIL') ? 'FAIL' : result.issues.some(x => x.severity === 'HOLD') ? 'HOLD' : result.issues.length ? 'CHECK' : 'PASS';
    return result;
  };
  const hasFailure = () => result.issues.some(x => x.severity === 'FAIL');
  if (!input || typeof input !== 'object' || Array.isArray(input)) { issue('INPUT_OBJECT', 'A tag input object is required.'); return finish(); }
  const need = (key: string, positive = true, c?: CaseName): number => {
    const value = t[key];
    if (missing(value)) { issue('MISSING_INPUT', `Enter ${key}.`, key, c); return NaN; }
    if (!numeric(value) || (positive && value <= 0)) { issue('INVALID_NUMBER', `${key} must be ${positive ? 'positive and ' : ''}finite.`, key, c); return NaN; }
    return value;
  };
  for (const f of fields) {
    const value = t[f.key];
    if (missing(value)) continue;
    if (f.type === 'number' && !numeric(value)) issue('INVALID_NUMBER', `${f.label} must be a finite number, not text.`, f.key);
    if (f.type === 'text' && typeof value !== 'string') issue('INVALID_TEXT', `${f.label} must be text.`, f.key);
    if (typeof value === 'string' && value.length > 8000) issue('TEXT_TOO_LONG', `${f.label} is too long.`, f.key);
    if (f.choices && !f.choices.includes(value)) issue('INVALID_SELECTION', `Select a supported ${f.label}.`, f.key);
  }
  if (typeof input.tag !== 'string' || !input.tag.trim()) issue('TAG_REQUIRED', 'Enter a tag number.', 'tag');
  if (typeof input.propertySource !== 'string' || !input.propertySource.trim()) issue('PROPERTY_SOURCE', 'Record the source of the fluid properties.', 'propertySource');
  if (input.standard !== STANDARD) issue('STANDARD_NOT_SUPPORTED', `Select ${STANDARD}.`, 'standard');
  if (input.boreConfiguration !== 'Concentric square-edged') issue('CONFIG_NOT_SUPPORTED', 'Only concentric square-edged plates are implemented.', 'boreConfiguration');
  if (!['Liquid','Gas','Steam'].includes(input.phase ?? '')) issue('PHASE_NOT_SUPPORTED', 'Select Liquid, Gas or Steam.', 'phase');
  if (!['Flange taps','Corner taps','D and D/2 taps'].includes(input.taps ?? '')) issue('TAP_NOT_SUPPORTED', 'Select a supported tap type.', 'taps');
  if (!['AUTO','MANUAL WT','MANUAL ID'].includes(input.pipeIdMode ?? '')) issue('PIPE_ID_MODE', 'Select an explicit pipe ID mode.', 'pipeIdMode');
  if (!['NPS','DN'].includes(input.sizeUnit ?? '')) issue('SIZE_UNIT', 'Select NPS or DN.', 'sizeUnit');
  if (!['YES','NO'].includes(input.thermalExpansion ?? '')) issue('THERMAL_SELECTION', 'Select YES or NO for thermal expansion.', 'thermalExpansion');
  const validModes = ['Solve for DP','Solve for Beta','Solve for Bore','Check Existing Bore'];
  if (!validModes.includes(input.mode ?? '')) issue('MODE_NOT_SUPPORTED', 'Select one of the four solve modes.', 'mode');
  const targetMode = input.mode === 'Solve for Bore' || input.mode === 'Solve for Beta';
  const borePresent = !missing(input.boreMm), betaPresent = !missing(input.beta);
  if (targetMode && (borePresent || betaPresent)) issue('INACTIVE_GEOMETRY', 'Stored bore and beta inputs are ignored in target-DP sizing mode, as in the workbook.', 'mode', undefined, 'CHECK');
  if (input.mode === 'Solve for DP' && borePresent === betaPresent) issue('MODE_INPUT_DP', 'Provide exactly one of input bore or input beta.', 'mode');
  if (input.mode === 'Check Existing Bore' && (!borePresent || betaPresent)) issue('MODE_INPUT_CHECK', 'Provide an existing bore and clear input beta.', 'boreMm');
  if (borePresent && !targetMode) need('boreMm');
  if (betaPresent && !targetMode) need('beta');
  const bmin = missing(input.betaMin) ? 0.2 : need('betaMin');
  const bmax = missing(input.betaMax) ? 0.75 : need('betaMax');
  if (!(bmin >= 0.2 && bmax <= 0.75 && bmin < bmax)) issue('BETA_LIMITS', 'This workbook migration supports 0.20 <= beta min < beta max <= 0.75.', 'betaMin');
  for (const key of ['minDp','maxDp','pipeVelocityLimit','boreVelocityLimit','existingTolerancePct','roughnessUm','requiredUpstreamD','requiredDownstreamD','availableUpstreamD','availableDownstreamD']) {
    if (!missing(t[key]) && numeric(t[key]) && t[key] < 0) issue('NEGATIVE_LIMIT', `${key} cannot be negative.`, key);
  }
  if (numeric(input.minDp) && numeric(input.maxDp) && input.minDp > input.maxDp) issue('DP_LIMIT_ORDER','Minimum DP exceeds maximum DP.', 'minDp');
  let pipe;
  try {
    pipe = findPipe(input.pipeStandard, input.sizeUnit, input.size, input.schedule);
    let wt = pipe.wtMm, id = pipe.idMm;
    if (input.pipeIdMode === 'MANUAL WT') { wt = need('manualWtMm'); id = pipe.odMm - 2 * wt; issue('MANUAL_WT_OVERRIDE', 'Manual wall thickness is active.', 'manualWtMm', undefined, 'CHECK'); }
    if (input.pipeIdMode === 'MANUAL ID') { id = need('manualIdMm'); wt = (pipe.odMm - id) / 2; issue('MANUAL_ID_OVERRIDE', 'Manual pipe ID is active.', 'manualIdMm', undefined, 'CHECK'); }
    if (!(id > 0 && id < pipe.odMm && wt > 0)) issue('PIPE_GEOMETRY', 'Resolved pipe dimensions are invalid.', 'pipeIdMode');
    if (id < 50 || id > 1000) issue('PIPE_SCOPE', 'Supported reference pipe ID is 50 to 1000 mm.', 'size');
    if (numeric(input.manualWtMm) && numeric(input.manualIdMm) && Math.abs(pipe.odMm - 2 * input.manualWtMm - input.manualIdMm) > 0.01)
      issue('MANUAL_GEOMETRY_MISMATCH', 'Manual WT and ID disagree by more than 0.01 mm.', 'manualIdMm', undefined, 'CHECK');
    result.geometry = { odMm: pipe.odMm, wtMm: wt, idMm: id, source: pipe.source };
    // Imported verification labels cannot certify this new engine or its data provenance.
    issue('PIPE_DB_UNVERIFIED', 'Confirm the governing edition and dimensions before project approval.', 'pipeStandard', undefined, 'CHECK');
  } catch (error) { issue('PIPE_LOOKUP', (error as Error).message, 'schedule'); }
  const compressed = input.phase !== 'Liquid';
  const gamma = compressed ? need('gamma') : 1;
  if (compressed && !(gamma > 1)) issue('GAMMA', 'Gas or steam requires gamma greater than 1.', 'gamma');
  if (!['RHG', 'Manual'].includes(input.cdMode ?? '')) issue('CD_MODE', 'Select RHG or Manual Cd.', 'cdMode');
  if (input.cdMode === 'Manual') {
    const cd = need('manualCd');
    if (!(cd > 0 && cd < 1)) issue('MANUAL_CD', 'Manual Cd must lie between 0 and 1.', 'manualCd');
    issue('MANUAL_CD_OVERRIDE', 'Document the applicable coefficient and calibration basis.', 'manualCd', undefined, 'CHECK');
  }
  let mu = NaN, targetDp = NaN;
  try { mu = toSI('Viscosity', need('viscosity'), input.viscosityUnit); } catch (error) { issue('VISCOSITY', (error as Error).message, 'viscosity'); }
  try {
    unitEntry('DP', input.dpUnit);
    if (targetMode || (input.mode === 'Check Existing Bore' && !missing(input.targetDp))) targetDp = toSI('DP', need('targetDp'), input.dpUnit);
  } catch (error) { issue('TARGET_DP', (error as Error).message, 'targetDp'); }
  if (input.mode === 'Check Existing Bore' && missing(input.targetDp)) issue('EXISTING_TARGET_MISSING', 'Target DP is missing; existing-bore comparison was not performed. The displayed values are fixed-bore calculations only.', 'targetDp', undefined, 'HOLD');
  if (['mmH2O_4C','inH2O_4C'].includes(input.dpUnit ?? '')) issue('WATER_DP_CONVERSION', '4 C water conversion uses NIST reference factors corrected in engine 0.2.0. Review projects created with the legacy conventional-water factors.', 'dpUnit', undefined, 'CHECK');
  const thermal = input.thermalExpansion === 'YES';
  const pipeAlpha = thermal ? need('pipeAlpha', false) : 0;
  const plateAlpha = thermal ? need('plateAlpha', false) : 0;
  const allowedBases = input.phase === 'Liquid' ? ['Direct Density','Manual Properties','Specific Gravity'] : input.phase === 'Gas' ? ['Direct Density','Manual Properties','MW + Z','Gas SG + Z'] : ['Direct Density','Manual Properties'];
  if (input.propertyBasis === 'Steam Table') issue('STEAM_TABLE_NOT_IMPLEMENTED', 'Supply independently verified steam density, viscosity and gamma. An automatic steam-property engine is not included.', 'propertyBasis');
  else if (!allowedBases.includes(input.propertyBasis ?? '')) issue('PROPERTY_BASIS_NOT_SUPPORTED', `Choose a supported property basis for ${input.phase}. Base density is used for reference-volume conversion only.`, 'propertyBasis');
  let flowEntry;
  try { flowEntry = unitEntry('Flow', input.flowUnit); } catch (error) { issue('FLOW_UNIT', (error as Error).message, 'flowUnit'); }
  let baseDensity = NaN;
  if (flowEntry && ['base volume', 'stock volume'].includes(flowEntry.basis)) {
    if (!missing(input.baseDensity)) baseDensity = need('baseDensity');
    else if (flowEntry.basis === 'stock volume') issue('STOCK_DENSITY', 'Enter density at the stated stock reference temperature.', 'baseDensity');
    else {
      const mw = input.propertyBasis === 'Gas SG + Z' ? need('specificGravity') * CONSTANTS.airMw : need('molecularWeight');
      const pb = need('basePressureKpa') * 1000, tb = need('baseTemperatureC', false) + 273.15, zb = need('baseZ');
      if (tb <= 0) issue('BASE_TEMPERATURE', 'Base absolute temperature must be positive.', 'baseTemperatureC');
      baseDensity = pb * mw / (zb * CONSTANTS.gas * tb);
    }
    if (flowEntry.basis === 'base volume') {
      // Even a supplied base density must carry its reference conditions.
      need('basePressureKpa'); const tb = need('baseTemperatureC', false) + 273.15;
      if (!(tb > 0)) issue('BASE_TEMPERATURE', 'Enter a physical base temperature.', 'baseTemperatureC');
      need('baseZ');
    }
  }
  const states: Partial<Record<CaseName, CaseState>> = {};
  for (const c of CASES) {
    const suffix = caps(c);
    try {
      const temperature = toSI('Temperature', need('temperature' + suffix, false, c), input.temperatureUnit);
      const pressure = toSI('Pressure', need('pressure' + suffix, false, c), input.pressureUnit);
      if (temperature <= 0) issue('TEMPERATURE', 'Absolute temperature must be positive.', 'temperature' + suffix, c);
      if (pressure <= 0) issue('PRESSURE', 'Absolute pressure must be positive.', 'pressure' + suffix, c);
      let density = NaN;
      if (['Direct Density','Manual Properties'].includes(input.propertyBasis ?? '')) density = toSI('Density', need('density' + suffix, true, c), input.densityUnit);
      else if (input.phase === 'Liquid' && input.propertyBasis === 'Specific Gravity') density = need('specificGravity') * CONSTANTS.water;
      else if (input.phase === 'Gas' && ['MW + Z','Gas SG + Z'].includes(input.propertyBasis ?? '')) {
        const mw = input.propertyBasis === 'Gas SG + Z' ? need('specificGravity') * CONSTANTS.airMw : need('molecularWeight');
        density = pressure * mw / (need('z' + suffix, true, c) * CONSTANTS.gas * temperature);
      }
      const flow = need('flow' + suffix, false, c);
      if (flow < 0) issue('FLOW', 'Reverse flow is not supported.', 'flow' + suffix, c);
      const flowSI = flow * (flowEntry?.multiplier ?? NaN);
      const mass = flowEntry?.basis === 'mass' ? flowSI : flowSI * (flowEntry?.basis === 'actual volume' ? density : baseDensity);
      if (!(density > 0) || !Number.isFinite(density)) issue('DENSITY', 'A valid operating density could not be calculated.', 'propertyBasis', c);
      if (!Number.isFinite(mass)) issue('FLOW', 'Mass flow could not be calculated from the selected units and properties.', 'flow' + suffix, c);
      const pipeFactor = 1 + pipeAlpha * (temperature - CONSTANTS.referenceK), plateFactor = 1 + plateAlpha * (temperature - CONSTANTS.referenceK);
      if (!(pipeFactor > 0 && plateFactor > 0)) issue('THERMAL_GEOMETRY', 'Expansion coefficients produce invalid dimensions.', 'pipeAlpha', c);
      const pipeM = (result.geometry?.idMm ?? NaN) / 1000 * pipeFactor;
      if (pipeM < 0.05 || pipeM > 1) issue('PIPE_SCOPE', 'Operating pipe ID is outside 50 to 1000 mm.', 'size', c);
      states[c] = {name:c, temperatureK:temperature, pressurePa:pressure, density, massKgS:mass, pipeM, plateFactor, re:reynolds(mass, mu, pipeM)};
    } catch (error) { issue('CASE_INPUT', (error as Error).message, undefined, c); }
  }
  if (hasFailure()) return finish();
  const fs = states.fs!;
  if (targetMode && fs.massKgS <= 0) { issue('FS_FLOW', 'Sizing needs a positive full-scale flow.', 'flowFs'); return finish(); }
  const rawFlows = CASES.map(c => t['flow' + caps(c)] as number);
  if (rawFlows.some((v, i) => i > 0 && v < rawFlows[i - 1])) issue('FLOW_ORDER', 'Check that Min <= Normal <= Max <= Full scale.', 'flowMin', undefined, 'CHECK');
  if (!missing(input.targetDp) && !targetMode && input.mode === 'Solve for DP') issue('TARGET_DP_UNUSED', 'Solve for DP uses the fixed geometry. Target DP is used only for sizing or existing-bore comparison.', 'targetDp', undefined, 'CHECK');
  const coefficient = (s: CaseState, b: number) => input.cdMode === 'Manual' ? input.manualCd! : rhg(b, s.re, s.pipeM, input.taps!);
  let referenceM = NaN;
  try {
    if (targetMode) {
      if (compressed && targetDp / fs.pressurePa > 0.25) throw new Error('Target DP exceeds the supported expansibility range: downstream/upstream pressure ratio must be at least 0.75.');
      if (targetDp >= fs.pressurePa) throw new Error('Target DP must be below upstream absolute pressure.');
      const low = Math.max(0.0125, bmin * fs.pipeM / fs.plateFactor), high = bmax * fs.pipeM / fs.plateFactor;
      const f = (ref: number) => {
        const d = ref * fs.plateFactor, b = d / fs.pipeM, cd = coefficient(fs, b);
        const y = compressed ? expansibility(b, targetDp, fs.pressurePa, gamma) : 1;
        return capacity(cd, y, d, b, fs.density, targetDp) - fs.massKgS;
      };
      if (low > high) throw new Error('Minimum bore and beta limits leave no feasible bore interval.');
      if (f(low) > Math.max(1e-12, fs.massKgS * 1e-11)) { issue('BETA_BELOW_MIN', 'Target DP requires a bore below the minimum permitted bore or beta.', 'targetDp'); return finish(); }
      if (f(high) < -Math.max(1e-12, fs.massKgS * 1e-11)) { issue('BETA_ABOVE_MAX', 'Target DP requires beta above the selected maximum.', 'targetDp'); return finish(); }
      const solve = bisect(f, low, high, fs.massKgS); referenceM = solve.value; result.solver = {method:'bisection', ...solve, units:'m', residualUnits:'kg/s'};
    } else referenceM = borePresent ? input.boreMm! / 1000 : input.beta! * result.geometry!.idMm / 1000;
    if (!Number.isFinite(referenceM) || referenceM < 0.0125) { issue('BORE_SCOPE', 'Reference bore must be at least 12.5 mm.', 'boreMm'); return finish(); }
    result.referenceBoreMm = referenceM * 1000;
  } catch (error) { issue('BORE_SOLVER', (error as Error).message, 'targetDp'); return finish(); }
  for (const c of CASES) {
    const s = states[c]!;
    const d = referenceM * s.plateFactor, b = d / s.pipeM;
    if (b < bmin - 1e-10 || b > bmax + 1e-10 || b >= 1 || d < 0.0125) { issue('BETA_RANGE', 'Operating beta or bore is outside the supported limits.', 'boreMm', c); continue; }
    if (s.re < 5000 && s.massKgS > 0) { issue('REYNOLDS', 'Reynolds number is below the workbook minimum of 5000.', undefined, c); continue; }
    try {
      let cd: number | null = s.massKgS === 0 ? null : coefficient(s, b), y = 1, dp = 0, iterations = 0, residual = 0;
      if (cd !== null) {
        if (!(cd > 0 && cd < 1)) throw new Error('Calculated discharge coefficient is outside the supported range.');
        if (compressed) {
          const f = (dpPa: number) => capacity(cd!, expansibility(b, dpPa, s.pressurePa, gamma), d, b, s.density, dpPa) - s.massKgS;
          if (f(0.25 * s.pressurePa) < -Math.max(1e-12, Math.abs(s.massKgS) * 1e-11)) { issue('EXPANSIBILITY_RANGE', 'Required DP exceeds the pressure-ratio limit of 0.75. No clipped DP is reported.', undefined, c); continue; }
          const solve = bisect(f, 0, 0.25 * s.pressurePa, s.massKgS); dp = solve.value; iterations = solve.iterations; residual = solve.residual;
          y = expansibility(b, dp, s.pressurePa, gamma);
        } else dp = liquidDp(s.massKgS, cd, d, b, s.density);
      } else issue('ZERO_FLOW', 'DP and velocities are zero. Cd is unavailable and the flow is outside the calibrated measurement range.', undefined, c, 'CHECK');
      if (dp >= s.pressurePa) { issue('PRESSURE_RATIO', 'Calculated DP leaves nonpositive downstream absolute pressure.', undefined, c); continue; }
      const ppl = cd === null ? 0 : permanentLoss(dp, b, cd);
      const values = [d,b,dp,y,ppl,s.massKgS / (s.density * area(s.pipeM)),s.massKgS / (s.density * area(d))];
      if (!values.every(Number.isFinite)) throw new Error('Nonfinite calculation result.');
      result.cases[c] = {...s,boreMm:d * 1000,beta:b,cd,y,dpPa:dp,dp:fromSI('DP',dp,input.dpUnit),permanentLossPa:ppl,
        permanentLoss:fromSI('DP',ppl,input.dpUnit),pipeVelocity:values[5],boreVelocity:values[6],pressureRatio:1 - dp / s.pressurePa,
        criticalRatio:compressed ? criticalRatio(gamma) : null,iterations,residualKgS:residual};
      if (compressed && 1 - dp / s.pressurePa <= criticalRatio(gamma)) issue('CHOKED_SCREEN', 'Critical pressure-ratio screening failed.', undefined, c);
      // Limits are evaluated for every case. Max-flow DP keeps the workbook's original meaning.
      if (numeric(input.pipeVelocityLimit) && input.pipeVelocityLimit > 0 && values[5] > input.pipeVelocityLimit) issue('PIPE_VELOCITY', 'Pipe velocity exceeds the project limit.', 'pipeVelocityLimit', c, 'CHECK');
      if (numeric(input.boreVelocityLimit) && input.boreVelocityLimit > 0 && values[6] > input.boreVelocityLimit) issue('BORE_VELOCITY', 'Bore velocity exceeds the project limit.', 'boreVelocityLimit', c, 'CHECK');
    } catch (error) { issue('CASE_CALCULATION', (error as Error).message, undefined, c); }
  }
  const fsResult = result.cases.fs;
  result.fsBeta = fsResult?.beta ?? null;
  if (fsResult && numeric(input.minDp) && input.minDp > 0 && fsResult.dp < input.minDp) issue('DP_BELOW_PROJECT_MIN','FS DP is below the project minimum.','minDp', 'fs', 'CHECK');
  if (result.cases.max && numeric(input.maxDp) && input.maxDp > 0 && result.cases.max.dp > input.maxDp) issue('DP_ABOVE_PROJECT_MAX','Max-flow DP exceeds the project maximum.','maxDp', 'max');
  if (input.mode === 'Check Existing Bore' && fsResult && Number.isFinite(targetDp)) {
    const deviation = Math.abs(fsResult.dpPa - targetDp) / targetDp * 100;
    if (deviation > (input.existingTolerancePct ?? 5)) issue('EXISTING_BORE_DP', `Existing bore differs from target FS DP by ${deviation.toFixed(3)}%.`, 'targetDp', 'fs', 'CHECK');
  }
  if (!(numeric(input.roughnessUm) && input.roughnessUm > 0)) issue('ROUGHNESS', 'Enter pipe roughness and verify its applicability.', 'roughnessUm', undefined, 'CHECK');
  let upstream: number | null = null, downstream: number | null = null;
  if (input.straightRunBasis === 'Project-entered requirement') { upstream = input.requiredUpstreamD ?? null; downstream = input.requiredDownstreamD ?? null; }
  else if (input.straightRunBasis === 'Published guidance' && fsResult) {
    const bands: Record<string, number[]> = {'Reducer':[5,8,12], 'Single 90° bend or tee':[16,22,44], 'Two 90° bends same plane':[10,18,44], 'Two 90° bends different planes':[50,75,60], 'Expander':[12,20,28], 'Fully open ball/gate valve':[12,12,18]};
    upstream = bands[input.straightRunCase ?? '']?.[fsResult.beta <= 0.4 ? 0 : fsResult.beta <= 0.5 ? 1 : 2] ?? null; downstream = 7;
    issue('STRAIGHT_RUN_GUIDANCE', 'These are inherited workbook screening values. Verify exact installation requirements from the governing standard.', 'straightRunCase', undefined, 'CHECK');
  }
  let straightStatus = 'CHECK';
  if (numeric(upstream) && numeric(downstream) && numeric(input.availableUpstreamD) && numeric(input.availableDownstreamD)) {
    straightStatus = input.availableUpstreamD < upstream || input.availableDownstreamD < downstream ? 'FAIL' : input.straightRunBasis === 'Published guidance' ? 'CHECK' : 'PASS';
    if (straightStatus === 'FAIL') issue('STRAIGHT_RUN', 'Available straight run is below the stated requirement.', 'availableUpstreamD');
  } else issue('STRAIGHT_RUN', 'Complete required and available straight-run distances.', 'straightRunBasis', undefined, 'CHECK');
  result.straightRun = {requiredUpstreamD: upstream, requiredDownstreamD: downstream, status: straightStatus};
  issue('ENGINEERING_REVIEW', 'Full standards applicability, uncertainty and independent benchmark review are pending. This result is not approved for engineering issue.', undefined, undefined, 'CHECK');
  result.complete = CASES.every(c => result.cases[c] !== undefined);
  return finish();
}

export function calculateBatch(tags: TagInput[]): Result[] {
  if (!Array.isArray(tags) || tags.length > 500) throw new Error('Provide an array containing at most 500 tags.');
  const counts = new Map<string,number>();
  for (const t of tags) { const key = typeof t?.tag === 'string' ? t.tag.trim().toUpperCase() : ''; if (key) counts.set(key,(counts.get(key) ?? 0)+1); }
  return tags.map(t => {
    const r = calculateTag(t);
    if ((counts.get(r.tag.trim().toUpperCase()) ?? 0) > 1) { r.issues.push({code:'DUPLICATE_TAG',severity:'FAIL',message:'Tag numbers must be unique within the project.',field:'tag'}); r.status='FAIL'; }
    return r;
  });
}
