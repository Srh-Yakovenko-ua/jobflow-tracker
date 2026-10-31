import { type ApplicationListQuery, applicationListQuerySchema } from '@jobflow/shared';
import { z } from 'zod';

import type { SearchMatch } from './application-search.js';

export type DateCursor = { lastEventAt: Date; id: string };

export type ApplicationCursor = DateCursor | SearchMatch;

const CURSOR_MAX_LENGTH = 200;

const TIMESTAMPTZ_FIRST_YEAR = 1;

const INVALID_CURSOR = 'invalid cursor';

const cursorTupleSchema = z.union([
  z.tuple([
    z.iso
      .datetime()
      .refine((instant) => new Date(instant).getUTCFullYear() >= TIMESTAMPTZ_FIRST_YEAR),
    z.uuid(),
  ]),
  z.tuple([z.number().min(0), z.uuid()]),
]);

function encoded(tuple: readonly [string | number, string]): string {
  return Buffer.from(JSON.stringify(tuple)).toString('base64url');
}

export function encodeApplicationCursor({ lastEventAt, id }: DateCursor): string {
  return encoded([lastEventAt.toISOString(), id]);
}

export function encodeRankCursor({ rank, id }: SearchMatch): string {
  return encoded([rank, id]);
}

export function rankCursorOf(cursor: ApplicationCursor | undefined): SearchMatch | undefined {
  return cursor !== undefined && 'rank' in cursor ? cursor : undefined;
}

export function dateCursorOf(cursor: ApplicationCursor | undefined): DateCursor | undefined {
  return cursor !== undefined && 'lastEventAt' in cursor ? cursor : undefined;
}

function decodedJson(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

export const cursorTextSchema = z.string().max(CURSOR_MAX_LENGTH);

export const applicationCursorSchema = cursorTextSchema.transform(
  (cursor, context): ApplicationCursor => {
    const tuple = cursorTupleSchema.safeParse(decodedJson(cursor));
    if (!tuple.success) {
      context.addIssue({ code: 'custom', message: INVALID_CURSOR });
      return z.NEVER;
    }
    const [position, id] = tuple.data;
    return typeof position === 'number'
      ? { rank: position, id }
      : { lastEventAt: new Date(position), id };
  },
);

export type ApplicationListRequest = Omit<ApplicationListQuery, 'cursor'> & {
  cursor?: ApplicationCursor | undefined;
};

function refusedCursor(context: z.RefinementCtx, message: string): never {
  context.addIssue({ code: 'custom', message, path: ['cursor'] });
  return z.NEVER;
}

export const applicationListRequestSchema = applicationListQuerySchema.transform(
  ({ cursor, ...query }, context): ApplicationListRequest => {
    if (cursor === undefined) {
      return query;
    }
    const decoded = applicationCursorSchema.safeParse(cursor);
    if (!decoded.success) {
      return refusedCursor(context, decoded.error.issues[0]?.message ?? INVALID_CURSOR);
    }
    const ranked = 'rank' in decoded.data;
    if (ranked !== (query.sort === 'relevance')) {
      return refusedCursor(context, 'The cursor belongs to another sort');
    }
    return { ...query, cursor: decoded.data };
  },
);
