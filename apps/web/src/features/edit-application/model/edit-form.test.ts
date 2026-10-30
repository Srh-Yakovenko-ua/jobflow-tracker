import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';

import { type EditFormValues, formValuesOf, patchOf } from './edit-form';

function patchAfter(change: Partial<EditFormValues>) {
  return patchOf({
    application: ACME_APPLICATION,
    values: { ...formValuesOf(ACME_APPLICATION), ...change },
  });
}

describe('patchOf', () => {
  it('an untouched form changes nothing', () => {
    expect(patchAfter({})).toEqual({});
  });

  it('keeps only the changed field, trimmed', () => {
    expect(patchAfter({ position: '  Staff React Developer ' })).toEqual({
      position: 'Staff React Developer',
    });
  });

  it('a value typed again the way it was saved is no change', () => {
    expect(patchAfter({ salaryMin: ' 4500 ', company: 'Acme Technologies ' })).toEqual({});
  });

  it('a change to one salary bound sends both bounds as numbers', () => {
    expect(patchAfter({ salaryMax: '6500' })).toEqual({ salaryMin: 4500, salaryMax: 6500 });
  });

  it('a cleared field is sent as null', () => {
    expect(patchAfter({ location: '  ', url: '', workMode: '' })).toEqual({
      location: null,
      url: null,
      workMode: null,
    });
  });

  it('a cleared salary clears both bounds', () => {
    expect(patchAfter({ salaryMin: '', salaryMax: '' })).toEqual({
      salaryMin: null,
      salaryMax: null,
    });
  });

  it('the currency is sent in upper case', () => {
    expect(patchAfter({ currency: ' eur' })).toEqual({ currency: 'EUR' });
  });

  it('a removed technology sends the stack that is left', () => {
    expect(patchAfter({ stack: ['React', 'TypeScript'] })).toEqual({
      stack: ['React', 'TypeScript'],
    });
  });
});
