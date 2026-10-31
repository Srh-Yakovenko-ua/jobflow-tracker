import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { CONTACT_LIMITS, createContactInputSchema, updateContactInputSchema } from './contact.js';

describe('createContactInputSchema', () => {
  it('accepts a recruiter with only a name and leaves the other fields out', () => {
    expect(createContactInputSchema.parse({ name: '  Оксана Левченко ' })).toStrictEqual({
      name: 'Оксана Левченко',
    });
  });

  it('keeps the contact limits at the column bounds', () => {
    expect(CONTACT_LIMITS).toEqual({
      nameMaxLength: 200,
      roleMaxLength: 200,
      emailMaxLength: 254,
      noteMaxLength: 2000,
    });
  });

  it.for([
    { label: 'a blank name', input: { name: '  \t' }, path: 'name' },
    { label: 'a 201-character name', input: { name: 'о'.repeat(201) }, path: 'name' },
    { label: 'a NUL character', input: { name: 'Оксана', note: 'a\u0000b' }, path: 'note' },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(createContactInputSchema.safeParse(input))).toEqual([path]);
  });

  it.for([
    { field: 'telegram', value: '@oksana_hr', paths: [] },
    { field: 'telegram', value: 'abc', paths: ['telegram'] },
    { field: 'telegram', value: 'https://t.me/x', paths: ['telegram'] },
    { field: 'phone', value: '+380 (67) 123-45-67', paths: [] },
    { field: 'phone', value: 'call me', paths: ['phone'] },
  ])('answers $field $value with issues at $paths', ({ field, value, paths }) => {
    const input = { name: 'Оксана', [field]: value };
    expect(issuePathsOf(createContactInputSchema.safeParse(input))).toEqual(paths);
  });
});

describe('updateContactInputSchema', () => {
  it('refuses an empty patch with the hint to send a field', () => {
    expect(updateContactInputSchema.safeParse({}).error?.issues).toMatchObject([
      { path: [], message: 'Send at least one field to change' },
    ]);
  });

  it('refuses clearing the name with null', () => {
    expect(issuePathsOf(updateContactInputSchema.safeParse({ name: null }))).toEqual(['name']);
  });

  it('clears the email with null and leaves the other fields out', () => {
    expect(updateContactInputSchema.parse({ email: null })).toStrictEqual({ email: null });
  });
});
