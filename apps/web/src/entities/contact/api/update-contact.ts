import {
  type Application,
  type Contact,
  contactSchema,
  type UpdateContactInput,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type UpdateContactRequest = Readonly<{
  applicationId: Application['id'];
  contactId: Contact['id'];
  body: UpdateContactInput;
}>;

export function updateContact({
  applicationId,
  contactId,
  body,
}: UpdateContactRequest): Promise<Contact> {
  return apiClient.request({
    path: `/applications/${applicationId}/contacts/${contactId}`,
    method: 'PATCH',
    body,
    schema: contactSchema,
  });
}
