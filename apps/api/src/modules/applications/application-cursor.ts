import { applicationListQuerySchema } from '@jobflow/shared';
import { z } from 'zod';

export type ApplicationCursor = { lastEventAt: Date; id: string };

const CURSOR_MAX_LENGTH = 200;

const TIMESTAMPTZ_FIRST_YEAR = 1;

const cursorTupleSchema = z.tuple([
  z.iso
    .datetime()
    .refine((instant) => new Date(instant).getUTCFullYear() >= TIMESTAMPTZ_FIRST_YEAR),
  z.uuid(),
]);

export function encodeApplicationCursor({ lastEventAt, id }: ApplicationCursor): string {
  return Buffer.from(JSON.stringify([lastEventAt.toISOString(), id])).toString('base64url');
}

function decodedJson(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

export const applicationCursorSchema = z
  .string()
  .max(CURSOR_MAX_LENGTH)
  .transform((cursor, context): ApplicationCursor => {
    const tuple = cursorTupleSchema.safeParse(decodedJson(cursor));
    if (!tuple.success) {
      context.addIssue({ code: 'custom', message: 'invalid cursor' });
      return z.NEVER;
    }
    const [lastEventAt, id] = tuple.data;
    return { lastEventAt: new Date(lastEventAt), id };
  });

export const applicationListRequestSchema = applicationListQuerySchema.extend({
  cursor: applicationCursorSchema.optional(),
});

export type ApplicationListRequest = z.infer<typeof applicationListRequestSchema>;
