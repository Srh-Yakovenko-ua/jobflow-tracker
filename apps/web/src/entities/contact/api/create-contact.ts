import {
  type Application,
  type Contact,
  contactSchema,
  type CreateContactInput,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type CreateContactRequest = Readonly<{
  applicationId: Application['id'];
  body: CreateContactInput;
  idempotencyKey: string;
}>;

export function createContact({
  applicationId,
  body,
  idempotencyKey,
}: CreateContactRequest): Promise<Contact> {
  return apiClient.request({
    path: `/applications/${applicationId}/contacts`,
    method: 'POST',
    body,
    schema: contactSchema,
    idempotencyKey,
  });
}
