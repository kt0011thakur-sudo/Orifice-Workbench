import { readFileSync } from 'node:fs';

export const readJSON = (relative: string) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
export const fields = readJSON('../data/fields.json');
export const pipes = readJSON('../data/pipes.json');
export const units = readJSON('../data/units.json');
export const manifest = readJSON('../docs/source-manifest.json');
export const CASES = ['min', 'normal', 'max', 'fs'] as const;
export const VERSION = '0.2.0';
export const STANDARD = 'ISO 5167-1/-2:2022';
export const CONSTANTS = Object.freeze({ gas: 8314.46261815324, atmosphere: 101325, water: 999.016, airMw: 28.9625, referenceK: 293.15 });

export function unitEntry(quantity: string, name: unknown) {
  const matches = units.filter((x: {quantity: string, unit: string}) => x.quantity === quantity && x.unit === name);
  if (matches.length !== 1) throw new Error(`Unknown or ambiguous ${quantity} unit: ${String(name)}`);
  return matches[0];
}

export function toSI(quantity: string, value: number, name: unknown): number {
  if (!Number.isFinite(value)) throw new Error(`${quantity} must be a finite number.`);
  const u = unitEntry(quantity, name);
  return value * u.multiplier + u.offset;
}

export function fromSI(quantity: string, value: number, name: unknown): number {
  const u = unitEntry(quantity, name);
  return (value - u.offset) / u.multiplier;
}

export function findPipe(standard: unknown, sizeUnit: unknown, size: unknown, schedule: unknown) {
  const matches = pipes.filter((p: {standard: string, nps: string, dn: string, schedule: string}) =>
    p.standard === standard && String(sizeUnit === 'NPS' ? p.nps : p.dn) === String(size) && String(p.schedule) === String(schedule));
  if (matches.length !== 1) throw new Error(`Pipe selection has ${matches.length} matches. Select a valid standard, size and schedule.`);
  return matches[0];
}
