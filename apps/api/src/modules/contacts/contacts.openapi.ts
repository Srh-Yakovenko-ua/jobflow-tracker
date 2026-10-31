import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type Contact,
  contactIdSchema,
  contactListResponseSchema,
  contactSchema,
  type CreateContactInput,
  createContactInputSchema,
  type UpdateContactInput,
  updateContactInputSchema,
} from '@jobflow/shared';

import {
  applicationIdParams,
  errorResponses,
  EXAMPLE_CHILD_ROW,
  EXAMPLE_EDITED_AT,
  jsonContent,
} from '../../openapi/route.js';

const EXAMPLE_CONTACT_ID = '0199f1e2-4c5d-7e6f-8a71-8b9c0d1e2f3a';

const CONTACT_INPUT = {
  name: 'Оксана Левченко',
  role: 'Talent Partner',
  email: 'o.levchenko@acme.io',
  telegram: '@oksana_hr',
  phone: '+380 67 123 45 67',
  note: 'Відповідає ввечері, краще писати в Telegram',
} satisfies CreateContactInput;

const CONTACT_PATCH = { role: 'Head of Talent', phone: null } satisfies UpdateContactInput;

const CONTACT = {
  ...CONTACT_INPUT,
  id: EXAMPLE_CONTACT_ID,
  ...EXAMPLE_CHILD_ROW,
} satisfies Contact;

const SUGGESTION = {
  id: '0199f1e2-4c5d-7e6f-8a71-8b9c0d1e2f3b',
  applicationId: '0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2b',
  name: 'Марта Коваль',
  role: 'Recruiter',
  email: 'm.koval@acme.io',
  telegram: null,
  phone: null,
  note: null,
  createdAt: '2026-09-30T11:20:00.000Z',
  updatedAt: '2026-10-02T08:45:00.000Z',
} satisfies Contact;

const CONTACTS_PATH = '/applications/{id}/contacts';

const CONTACT_PATH = `${CONTACTS_PATH}/{contactId}`;

const TAGS = ['applications'];

const contactParams = applicationIdParams.extend({
  contactId: contactIdSchema.meta({ example: EXAMPLE_CONTACT_ID }),
});

const FIELDS_RULE =
  'telegram is a handle (@ and 5 to 32 letters, digits or _), never a URL; phone is digits with + ( ) - and spaces.';

const ownedErrors = errorResponses([401, 403, 404, 422]);

const bodyErrors = errorResponses([400, 401, 403, 404, 422]);

export const CONTACTS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: CONTACTS_PATH,
    tags: TAGS,
    summary: 'Add a recruiter contact to an Application',
    description: `Only name is required. ${FIELDS_RULE} To link a suggested contact, post its fields here.`,
    request: {
      params: applicationIdParams,
      body: { required: true, content: jsonContent(createContactInputSchema, CONTACT_INPUT) },
    },
    responses: {
      201: { description: 'The created contact', content: jsonContent(contactSchema, CONTACT) },
      ...bodyErrors,
    },
  },
  {
    method: 'get',
    path: CONTACTS_PATH,
    tags: TAGS,
    summary: 'List the contacts of an Application',
    description:
      'Contacts oldest first. avgResponseHours is the mean reply time over every live Application of the same company holding the same email, null below 2 replies. suggestions are contacts from those other Applications whose email is not here yet, one per email, newest first.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The contacts of the Application and the ones to link',
        content: jsonContent(contactListResponseSchema, {
          items: [{ ...CONTACT, avgResponseHours: 14 }],
          suggestions: [SUGGESTION],
        }),
      },
      ...ownedErrors,
    },
  },
  {
    method: 'patch',
    path: CONTACT_PATH,
    tags: TAGS,
    summary: 'Change the fields of a contact',
    description: `Send at least one field; null clears it, name cannot be null. ${FIELDS_RULE}`,
    request: {
      params: contactParams,
      body: { required: true, content: jsonContent(updateContactInputSchema, CONTACT_PATCH) },
    },
    responses: {
      200: {
        description: 'The changed contact',
        content: jsonContent(contactSchema, {
          ...CONTACT,
          ...CONTACT_PATCH,
          updatedAt: EXAMPLE_EDITED_AT,
        }),
      },
      ...bodyErrors,
    },
  },
  {
    method: 'delete',
    path: CONTACT_PATH,
    tags: TAGS,
    summary: 'Delete a contact',
    request: { params: contactParams },
    responses: { 204: { description: 'The contact is deleted' }, ...ownedErrors },
  },
];
