import {
  type Contact,
  type ContactListResponse,
  type ContactResponse,
  contactResponseSchema,
  type CreateContactInput,
  createContactInputSchema,
  type UpdateContactInput,
  updateContactInputSchema,
} from '@jobflow/shared';

import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf } from './board-fixtures';
import { storedRoutes, type StoredRoutesSetup, type StoredRoutesSpec } from './stored-routes';

export type ContactSeed = Pick<Contact, 'name'> & {
  [Field in keyof ContactResponse]?: ContactResponse[Field] | undefined;
};

export type ContactRoutesOptions = StoredRoutesSetup<ContactResponse> & {
  suggestions?: readonly Contact[];
};

export const CONTACT_ID = fixtureIdOf(701);

export function contactOf(seed: ContactSeed): ContactResponse {
  return contactResponseSchema.parse({
    id: CONTACT_ID,
    applicationId: ACME_APPLICATION.id,
    role: null,
    email: null,
    telegram: null,
    phone: null,
    note: null,
    avgResponseHours: null,
    createdAt: ACME_APPLICATION.createdAt,
    updatedAt: ACME_APPLICATION.createdAt,
    ...seed,
  });
}

export const DESIGN_CONTACT = contactOf({
  name: 'Оксана Левченко',
  role: 'Talent Partner',
  email: 'o.levchenko@acme.io',
  telegram: 'oksana_hr',
  avgResponseHours: 14,
});

export function contactRoutes({ suggestions = [], ...options }: ContactRoutesOptions = {}) {
  const pageOf = (items: ContactResponse[]): ContactListResponse => ({
    items,
    suggestions: [...suggestions],
  });
  const spec: StoredRoutesSpec<ContactResponse, CreateContactInput, UpdateContactInput> = {
    path: '/applications/:id/contacts',
    pageOf,
    creating: {
      schema: createContactInputSchema,
      build: ({ body, ...ids }) => contactOf({ ...body, ...ids }),
    },
    updating: {
      schema: updateContactInputSchema,
      merge: ({ before, patch }) => contactResponseSchema.parse({ ...before, ...patch }),
    },
  };
  return storedRoutes(spec, options);
}
