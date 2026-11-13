import { type ApplicationResponse, followupOutputSchema } from '@jobflow/shared';
import { z } from 'zod';

import { logger } from '@/shared/lib/logger';

const { subject, body } = followupOutputSchema.shape;

const draftEditSchema = followupOutputSchema.extend({
  key: z.string(),
  subject: subject.or(z.literal('')),
  body: body.or(z.literal('')),
});

export type DraftEdit = z.infer<typeof draftEditSchema>;

type ApplicationId = ApplicationResponse['id'];

function editKeyOf(applicationId: ApplicationId): string {
  return `jobflow.followup-edit.${applicationId}`;
}

export function readDraftEdit(applicationId: ApplicationId): DraftEdit | undefined {
  try {
    const stored = sessionStorage.getItem(editKeyOf(applicationId));
    if (stored === null) return undefined;
    const edit = draftEditSchema.safeParse(JSON.parse(stored));
    return edit.success ? edit.data : undefined;
  } catch (error) {
    logger.warn({ err: error }, 'follow-up draft edit unreadable');
    return undefined;
  }
}

export function rememberDraftEdit(applicationId: ApplicationId, edit: DraftEdit): void {
  try {
    sessionStorage.setItem(editKeyOf(applicationId), JSON.stringify(edit));
  } catch (error) {
    logger.warn({ err: error }, 'follow-up draft edit not stored');
  }
}

export function forgetDraftEdit(applicationId: ApplicationId): void {
  try {
    sessionStorage.removeItem(editKeyOf(applicationId));
  } catch (error) {
    logger.warn({ err: error }, 'follow-up draft edit not cleared');
  }
}
