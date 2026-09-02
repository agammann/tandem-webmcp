import { describe, expect, it } from 'vitest';
import { compensatedGain, eqProfileSchema, FLAT_PROFILE, validateProfile } from '@/lib/eq';

describe('EQ safety', () => {
  it('accepts all five bands at 0.5 dB increments', () => {
    expect(validateProfile({ ...FLAT_PROFILE, low: -6, air: 6, clarity: 1.5 })).toEqual({
      low: -6,
      warmth: 0,
      presence: 0,
      clarity: 1.5,
      air: 6,
    });
  });

  it('rejects out-of-range, off-step, and unknown values', () => {
    expect(() => eqProfileSchema.parse({ ...FLAT_PROFILE, low: 6.5 })).toThrow();
    expect(() => eqProfileSchema.parse({ ...FLAT_PROFILE, low: 0.25 })).toThrow();
    expect(() => eqProfileSchema.parse({ ...FLAT_PROFILE, secret: 1 })).toThrow();
  });

  it('adds more headroom when a profile boosts a band', () => {
    expect(compensatedGain({ ...FLAT_PROFILE, clarity: 4 })).toBeLessThan(compensatedGain(FLAT_PROFILE));
  });
});
