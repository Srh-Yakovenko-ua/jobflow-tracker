import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { capturePasteInputSchema } from './capture.js';

const text = 'Senior Frontend Engineer у Grammarly\nReact, TypeScript\n';

describe('capturePasteInputSchema', () => {
  it.each([
    { label: 'the pasted text alone', input: { text } },
    {
      label: 'the pasted text with an https url',
      input: { text, url: 'https://djinni.co/jobs/1' },
    },
    { label: 'the pasted text with a null url', input: { text, url: null } },
    { label: 'a text of exactly 20 000 characters', input: { text: 'н'.repeat(20_000) } },
  ])('accepts $label unchanged', ({ input }) => {
    expect(capturePasteInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    { label: 'a missing text', input: {}, path: 'text' },
    { label: 'a blank text', input: { text: '  \n\t' }, path: 'text' },
    { label: 'a text of 20 001 characters', input: { text: 'н'.repeat(20_001) }, path: 'text' },
    { label: 'a javascript: url', input: { text, url: 'javascript:alert(1)' }, path: 'url' },
    { label: 'an ftp url', input: { text, url: 'ftp://djinni.co/jobs/1' }, path: 'url' },
    {
      label: 'a url longer than 2048 characters',
      input: { text, url: `https://djinni.co/${'a'.repeat(2048)}` },
      path: 'url',
    },
  ])('refuses $label at $path', ({ input, path }) => {
    expect(issuePathsOf(capturePasteInputSchema.safeParse(input))).toEqual([path]);
  });
});
