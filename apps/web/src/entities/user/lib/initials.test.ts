import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letters of the first two words of the name', () => {
    expect(initialsOf({ displayName: 'андрій  ковальчук молодший', email: 'a@example.com' })).toBe(
      'АК',
    );
  });

  it('keeps one letter for a one-word name', () => {
    expect(initialsOf({ displayName: 'Ірина', email: 'i@example.com' })).toBe('І');
  });

  it('falls back to the first letter of the email without a name', () => {
    expect(initialsOf({ displayName: null, email: 'olena@example.com' })).toBe('O');
  });

  it('falls back to the email when the name is blank', () => {
    expect(initialsOf({ displayName: '   ', email: 'max@example.com' })).toBe('M');
  });
});
