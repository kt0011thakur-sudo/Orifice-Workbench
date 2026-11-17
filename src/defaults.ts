import type { TagInput } from './types.ts';
export function demoTag(tag = 'FT-DEMO-001'): TagInput {
  return {
    tag, fluid: 'Water', service: 'Demonstration calculation', phase: 'Liquid',
    pipeStandard: 'ASME B36.10M', sizeUnit: 'NPS', size: '4', schedule: '40', pipeIdMode: 'AUTO',
    pipeMaterial: 'Carbon steel', pipeAlpha: 0.000012, roughnessUm: 45,
    flowUnit: 'kg/s', flowMin: 2, flowNormal: 5, flowMax: 8, flowFs: 10,
    temperatureUnit: 'degC', temperatureMin: 20, temperatureNormal: 20, temperatureMax: 20, temperatureFs: 20,
    pressureUnit: 'bar(a)', pressureMin: 10, pressureNormal: 10, pressureMax: 10, pressureFs: 10,
    propertyBasis: 'Direct Density', densityUnit: 'kg/m3', densityMin: 998.2, densityNormal: 998.2, densityMax: 998.2, densityFs: 998.2,
    viscosityUnit: 'cP', viscosity: 1.002, propertySource: 'Synthetic software test data, not project process data',
    straightRunBasis: 'Project-entered requirement', straightRunCase: 'Other / project-defined',
    requiredUpstreamD: 30, requiredDownstreamD: 10, availableUpstreamD: 40, availableDownstreamD: 12,
    thermalExpansion: 'NO', plateAlpha: 0.000017,
    mode: 'Solve for Bore', targetDp: 50, dpUnit: 'kPa', boreMm: null, beta: null,
    boreConfiguration: 'Concentric square-edged', taps: 'Flange taps', standard: 'ISO 5167-1/-2:2022', cdMode: 'RHG',
    betaMin: 0.2, betaMax: 0.75, existingTolerancePct: 5, revision: '0', note: 'Sample data for learning the workflow.'
  };
}
