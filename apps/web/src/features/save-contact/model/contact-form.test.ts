import { describe, expect, it } from 'vitest';

import { contactOf, DESIGN_CONTACT } from '@/test/contact-fixtures';

import {
  type ContactFormValues,
  contactPatchSchema,
  formValuesOf,
  newContactSchema,
  suggestionInputOf,
} from './contact-form';

function patchAfter(change: Partial<ContactFormValues>) {
  return contactPatchSchema.safeParse({ ...formValuesOf(DESIGN_CONTACT), ...change });
}

function refusedPathsOf(result: ReturnType<typeof patchAfter>) {
  return result.error?.issues.map((issue) => issue.path.join('.'));
}

describe('formValuesOf', () => {
  it('shows a field the contact has no value for as an empty text', () => {
    expect(formValuesOf(contactOf({ name: 'Оксана Левченко' }))).toEqual({
      name: 'Оксана Левченко',
      role: '',
      email: '',
      telegram: '',
    });
  });
});

describe('contactPatchSchema', () => {
  it('sends the four edited fields trimmed, and a cleared role as null', () => {
    expect(patchAfter({ name: ' Оксана Левченко-Ткач ', role: '  ' }).data).toEqual({
      name: 'Оксана Левченко-Ткач',
      role: null,
      email: 'o.levchenko@acme.io',
      telegram: 'oksana_hr',
    });
  });

  it.each([
    { change: { telegram: 'https://t.me/oksana_hr' }, path: 'telegram' },
    { change: { email: 'oksana' }, path: 'email' },
    { change: { name: '   ' }, path: 'name' },
  ])('refuses $change at $path before anything is sent', ({ change, path }) => {
    expect(refusedPathsOf(patchAfter(change))).toEqual([path]);
  });
});

describe('newContactSchema', () => {
  it('starts a contact from a trimmed name alone', () => {
    expect(newContactSchema.parse({ name: '  Оксана ' })).toEqual({ name: 'Оксана' });
  });

  it('refuses a blank name', () => {
    expect(newContactSchema.safeParse({ name: ' ' }).success).toBe(false);
  });
});

describe('suggestionInputOf', () => {
  it('posts only the fields the suggested contact has', () => {
    const suggestion = contactOf({
      id: '0b6f3c1e-5d2a-4c8e-9f10-000000000702',
      applicationId: '0b6f3c1e-5d2a-4c8e-9f10-000000000202',
      name: 'Ігор Савчук',
      role: 'Engineering Manager',
      phone: '+380 67 123 45 67',
    });

    expect(suggestionInputOf(suggestion)).toEqual({
      name: 'Ігор Савчук',
      role: 'Engineering Manager',
      phone: '+380 67 123 45 67',
    });
  });
});
