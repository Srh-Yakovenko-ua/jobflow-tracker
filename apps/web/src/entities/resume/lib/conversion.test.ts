import { describe, expect, it } from 'vitest';

import { DESIGN_RESUME_AB } from '@/test/resume-ab-fixtures';
import { resumeVersionIdOf } from '@/test/resume-fixtures';

import { conversionLabelOf, conversionOf } from './conversion';

const { versions } = DESIGN_RESUME_AB;

describe('conversionOf', () => {
  it('a version the A/B answer rates reads its percent', () => {
    const conversion = conversionOf({ versions, versionId: resumeVersionIdOf(2) });

    expect(conversionLabelOf(conversion)).toBe('41%');
  });

  it('a version the A/B answer has too few applications for reads мало даних', () => {
    const conversion = conversionOf({ versions, versionId: resumeVersionIdOf(3) });

    expect(conversion).toMatchObject({ status: 'insufficient_data' });
    expect(conversionLabelOf(conversion)).toBe('мало даних');
  });

  it('a version missing from an answered A/B list is none and reads мало даних', () => {
    const conversion = conversionOf({ versions, versionId: resumeVersionIdOf(9) });

    expect(conversion).toBe('none');
    expect(conversionLabelOf(conversion)).toBe('мало даних');
  });

  it('an A/B read with no answer yet is unknown and reads the neutral mark', () => {
    const conversion = conversionOf({ versions: undefined, versionId: resumeVersionIdOf(2) });

    expect(conversion).toBe('unknown');
    expect(conversionLabelOf(conversion)).toBe('—');
  });
});
