/** Pure SI equations transcribed from the source workbook. No Excel, UI, or I/O dependencies. */
export function area(d: number): number { return Math.PI * d * d / 4; }
export function reynolds(mass: number, viscosity: number, diameter: number): number {
  return 4 * mass / (Math.PI * viscosity * diameter);
}
export function tapFactors(taps: string, diameter: number): [number, number] {
  if (taps === 'Corner taps') return [0, 0];
  if (taps === 'D and D/2 taps') return [1, 0.47];
  if (taps === 'Flange taps') return [0.0254 / diameter, 0.0254 / diameter];
  throw new Error('Unsupported tap type.');
}
export function rhg(beta: number, re: number, diameter: number, taps: string): number {
  if (!(beta > 0 && beta < 1 && re > 0 && diameter > 0)) throw new Error('Invalid RHG input.');
  const [l1, l2] = tapFactors(taps, diameter);
  const a = (19000 * beta / re) ** 0.8;
  const m2 = 2 * l2 / (1 - beta);
  return 0.5961 + 0.0261 * beta ** 2 - 0.216 * beta ** 8
    + 0.000521 * (1e6 * beta / re) ** 0.7
    + (0.0188 + 0.0063 * a) * beta ** 3.5 * (1e6 / re) ** 0.3
    + (0.043 + 0.08 * Math.exp(-10 * l1) - 0.123 * Math.exp(-7 * l1))
      * (1 - 0.11 * a) * beta ** 4 / (1 - beta ** 4)
    - 0.031 * (m2 - 0.8 * m2 ** 1.1) * beta ** 1.3
    + (diameter * 1000 < 71.12 ? 0.011 * (0.75 - beta) * (2.8 - diameter * 1000 / 25.4) : 0);
}
export function expansibility(beta: number, dp: number, pressure: number, gamma: number): number {
  if (!(pressure > 0 && gamma > 1 && dp >= 0 && dp < pressure)) throw new Error('Invalid expansibility pressure or gamma.');
  return 1 - (0.351 + 0.256 * beta ** 4 + 0.93 * beta ** 8) * (1 - (1 - dp / pressure) ** (1 / gamma));
}
export function capacity(cd: number, y: number, bore: number, beta: number, density: number, dp: number): number {
  return cd * y * area(bore) * Math.sqrt(2 * density * dp / (1 - beta ** 4));
}
export function liquidDp(mass: number, cd: number, bore: number, beta: number, density: number): number {
  return (mass / (cd * area(bore))) ** 2 * (1 - beta ** 4) / (2 * density);
}
export function permanentLoss(dp: number, beta: number, cd: number): number {
  const a = Math.sqrt(1 - beta ** 4 * (1 - cd ** 2));
  return dp * (a - cd * beta ** 2) / (a + cd * beta ** 2);
}
export function criticalRatio(gamma: number): number {
  return (2 / (gamma + 1)) ** (gamma / (gamma - 1));
}
export function bisect(fn: (x: number) => number, low: number, high: number, scale = 1) {
  let fLow = fn(low), fHigh = fn(high);
  if (![fLow, fHigh].every(Number.isFinite) || low > high) throw new Error('Root is not bracketed within the supported range.');
  const target = Math.max(1e-12, Math.abs(scale) * 1e-11);
  if (Math.abs(fLow) <= target) return { value: low, iterations: 0, residual: fLow, converged: true };
  if (Math.abs(fHigh) <= target) return { value: high, iterations: 0, residual: fHigh, converged: true };
  // A root within the documented residual tolerance can lie at an endpoint
  // despite floating-point signs putting the exact root just beyond it.
  if (fLow * fHigh > 0) throw new Error('Root is not bracketed within the supported range.');
  for (let i = 1; i <= 100; i++) {
    const mid = (low + high) / 2, residual = fn(mid);
    if (!Number.isFinite(residual)) throw new Error('Nonfinite solver residual.');
    if (Math.abs(residual) <= target) return { value: mid, iterations: i, residual, converged: true };
    if (residual * fLow > 0) { low = mid; fLow = residual; } else { high = mid; fHigh = residual; }
  }
  throw new Error('Solver failed to converge after 100 iterations.');
}
