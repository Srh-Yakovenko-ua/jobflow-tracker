import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { NOTE_LIMITS, noteInputSchema, noteSchema } from './note.js';

describe('noteInputSchema', () => {
  it('keeps a markdown body byte for byte, indentation and raw HTML included', () => {
    expect(noteInputSchema.parse({ body: '  - пункт\n<script>x</script>\n' })).toEqual({
      body: '  - пункт\n<script>x</script>\n',
    });
  });

  it('accepts a body of exactly 20 000 characters', () => {
    const body = 'н'.repeat(20_000);
    expect(noteInputSchema.parse({ body }).body).toBe(body);
  });

  it('keeps the body limit at 20 000 characters', () => {
    expect(NOTE_LIMITS).toEqual({ bodyMaxLength: 20_000 });
  });

  it.for([
    { label: 'a missing body', input: {} },
    { label: 'a blank body', input: { body: '  \n\t' } },
    { label: 'a 20 001-character body', input: { body: 'н'.repeat(20_001) } },
    { label: 'a body with a NUL character', input: { body: 'a\u0000b' } },
  ])('refuses $label at body', ({ input }) => {
    expect(issuePathsOf(noteInputSchema.safeParse(input))).toEqual(['body']);
  });
});

describe('noteSchema', () => {
  it('refuses a stored body of 20 001 characters', () => {
    const note = {
      id: '01920000-0000-7000-8000-000000000031',
      applicationId: '01920000-0000-7000-8000-000000000001',
      body: 'н'.repeat(20_001),
      createdAt: '2026-10-29T09:00:00.000Z',
      updatedAt: '2026-10-29T09:00:00.000Z',
    };
    expect(issuePathsOf(noteSchema.safeParse(note))).toEqual(['body']);
  });
});
