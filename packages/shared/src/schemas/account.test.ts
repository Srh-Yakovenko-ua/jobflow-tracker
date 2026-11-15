import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  deleteAccountInputSchema,
  EXPORT_LIMITS,
  exportAcceptedSchema,
  exportLinkSchema,
  exportRequestSchema,
} from './account.js';

const EXPORT_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e24';

describe('exportRequestSchema', () => {
  it.each(['json', 'csv'])('accepts the %s format', (format) => {
    expect(exportRequestSchema.parse({ format })).toEqual({ format });
  });

  it.each([{ format: 'xlsx' }, {}])('refuses %j', (body) => {
    expect(issuePathsOf(exportRequestSchema.safeParse(body))).toEqual(['format']);
  });
});

describe('export answers', () => {
  it('keeps an accepted export id as sent and refuses one that is not a uuid', () => {
    expect(exportAcceptedSchema.parse({ exportId: EXPORT_ID })).toEqual({ exportId: EXPORT_ID });
    expect(issuePathsOf(exportAcceptedSchema.safeParse({ exportId: 'abc' }))).toEqual(['exportId']);
  });

  it('keeps a ready signed link with its expiry and refuses a link that is not a url', () => {
    const link = {
      status: 'ready',
      url: 'http://localhost:9000/jobflow/users/u/exports/e.zip?X-Amz-Signature=abc',
      expiresAt: '2026-11-15T11:00:00.000Z',
    };
    expect(exportLinkSchema.parse(link)).toEqual(link);
    expect(issuePathsOf(exportLinkSchema.safeParse({ ...link, url: 'zip' }))).toEqual(['url']);
  });

  it('keeps a pending export without a link and refuses a ready one without its url', () => {
    expect(exportLinkSchema.parse({ status: 'pending' })).toEqual({ status: 'pending' });
    expect(
      issuePathsOf(
        exportLinkSchema.safeParse({ status: 'ready', expiresAt: '2026-11-15T11:00:00.000Z' }),
      ),
    ).toEqual(['url']);
  });

  it('keeps the link for one hour', () => {
    expect(EXPORT_LIMITS.linkTtlSeconds).toBe(3600);
  });
});

describe('deleteAccountInputSchema', () => {
  it('accepts a password, or the email an account without one types instead', () => {
    expect(deleteAccountInputSchema.parse({ password: 'correct horse' })).toEqual({
      password: 'correct horse',
    });
    expect(deleteAccountInputSchema.parse({ password: 'ann@example.com' })).toEqual({
      password: 'ann@example.com',
    });
  });

  it.each([{ password: '' }, { password: 'x'.repeat(129) }, {}])('refuses %j', (body) => {
    expect(issuePathsOf(deleteAccountInputSchema.safeParse(body))).toEqual(['password']);
  });
});
