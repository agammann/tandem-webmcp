import { z } from 'zod';
import { EQ_BANDS, type EqProfile } from './types';

export const FLAT_PROFILE: EqProfile = {
  low: 0,
  warmth: 0,
  presence: 0,
  clarity: 0,
  air: 0,
};

const bandValue = z
  .number()
  .min(-6)
  .max(6)
  .refine((value) => Number.isInteger(value * 2), 'Use 0.5 dB increments');

export const eqProfileSchema = z
  .object({
    low: bandValue,
    warmth: bandValue,
    presence: bandValue,
    clarity: bandValue,
    air: bandValue,
  })
  .strict();

export function validateProfile(input: unknown): EqProfile {
  return eqProfileSchema.parse(input);
}

export function profilePeak(profile: EqProfile): number {
  return Math.max(0, ...EQ_BANDS.map(({ key }) => profile[key]));
}

export function compensatedGain(profile: EqProfile): number {
  const peak = profilePeak(profile);
  return Math.pow(10, -(peak + 1.5) / 20);
}

export function profileSummary(profile: EqProfile): string {
  return EQ_BANDS.map(({ key, label }) => {
    const value = profile[key];
    return `${label} ${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;
  }).join(' · ');
}
