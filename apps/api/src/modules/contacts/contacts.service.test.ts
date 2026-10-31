import type { CreateContactInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { APPLIED_AT_NOW, moved, responseHistory } from '../../test/response-history.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  CONTACT_ID,
  MISSING_ID,
  MISSING_TARGETS,
  OLENA_ID,
  type Target,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import {
  type ApplicationHistory,
  type ContactOfApplication,
  type ContactRow,
  type ContactsOfApplication,
  ContactsRepository,
  type FindContact,
  type HistoryOfApplications,
  type InsertContact,
  type UpdateContact,
} from './contacts.repository.js';
import { ContactsService } from './contacts.service.js';

type OwnedHistory = ApplicationHistory & { userId: string };

type ContactFields = Pick<ContactRow, 'id' | 'applicationId' | 'name'> & Partial<ContactRow>;

const OTHER_APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c3';
const THIRD_APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c4';
const IHOR_ID = '0199f0a0-0000-7000-8000-0000000000e3';
const MARTA_NEWER_ID = '0199f0a0-0000-7000-8000-0000000000e4';
const PETRO_ID = '0199f0a0-0000-7000-8000-0000000000e5';

const CONTACT_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Contact not found' },
};

const INPUT: CreateContactInput = { name: 'Оксана Левченко' };

const MISSING_CONTACT: ContactOfApplication = {
  applicationId: APPLICATION_ID,
  contactId: MISSING_ID,
};

const contactRow = (fields: ContactFields): ContactRow => ({
  role: null,
  email: null,
  telegram: null,
  phone: null,
  note: null,
  createdAt: daysBefore(5),
  updatedAt: daysBefore(5),
  ...fields,
});

const OKSANA = contactRow({
  id: CONTACT_ID,
  applicationId: APPLICATION_ID,
  name: 'Оксана Левченко',
  email: 'O.Levchenko@Acme.io',
});

const HISTORIES: OwnedHistory[] = [
  {
    userId: OLENA_ID,
    id: APPLICATION_ID,
    contacts: [OKSANA, contactRow({ id: IHOR_ID, applicationId: APPLICATION_ID, name: 'Ігор' })],
    ...responseHistory([
      APPLIED_AT_NOW,
      moved({ from: 'applied', to: 'screening', hours: 10 }),
      moved({ from: 'screening', to: 'tech_interview', hours: 28 }),
    ]),
  },
  {
    userId: OLENA_ID,
    id: OTHER_APPLICATION_ID,
    contacts: [
      contactRow({
        id: '0199f0a0-0000-7000-8000-0000000000e6',
        applicationId: OTHER_APPLICATION_ID,
        name: 'Оксана',
        email: 'o.levchenko@acme.io',
        updatedAt: daysBefore(1),
      }),
      contactRow({
        id: '0199f0a0-0000-7000-8000-0000000000e7',
        applicationId: OTHER_APPLICATION_ID,
        name: 'Марта',
        email: 'marta@acme.io',
        updatedAt: daysBefore(4),
      }),
    ],
    ...responseHistory([APPLIED_AT_NOW, moved({ from: 'applied', to: 'screening', hours: 2 })]),
  },
  {
    userId: OLENA_ID,
    id: THIRD_APPLICATION_ID,
    contacts: [
      contactRow({
        id: MARTA_NEWER_ID,
        applicationId: THIRD_APPLICATION_ID,
        name: 'Марта Коваль',
        email: 'Marta@Acme.io',
        updatedAt: daysBefore(2),
      }),
      contactRow({
        id: PETRO_ID,
        applicationId: THIRD_APPLICATION_ID,
        name: 'Петро',
        email: 'petro@acme.io',
        updatedAt: daysBefore(3),
      }),
      contactRow({
        id: '0199f0a0-0000-7000-8000-0000000000e8',
        applicationId: THIRD_APPLICATION_ID,
        name: 'Без пошти',
        updatedAt: daysBefore(0),
      }),
    ],
    ...responseHistory([APPLIED_AT_NOW, moved({ from: 'applied', to: 'screening', hours: 40 })]),
  },
];

class FakeContactsRepository {
  readonly inserted: ByUser<InsertContact>[] = [];

  insert(userId: string, input: InsertContact): Promise<ContactRow | null> {
    if (this.applicationOf(userId, input) === undefined) {
      return Promise.resolve(null);
    }
    this.inserted.push({ userId, ...input });
    return Promise.resolve(OKSANA);
  }

  sameCompanyApplicationIds(userId: string, target: ContactsOfApplication): Promise<string[]> {
    const owns = this.applicationOf(userId, target) !== undefined;
    return Promise.resolve(owns ? this.historiesOf(userId).map(({ id }) => id) : []);
  }

  findHistory(userId: string, { applicationIds }: HistoryOfApplications) {
    return Promise.resolve(
      this.historiesOf(userId).filter(({ id }) => applicationIds.includes(id)),
    );
  }

  updateOwned(userId: string, contact: UpdateContact): Promise<number> {
    return Promise.resolve(this.contactOf(userId, contact) === undefined ? 0 : 1);
  }

  findOwned(userId: string, contact: FindContact): Promise<ContactRow | null> {
    return Promise.resolve(this.contactOf(userId, contact) ?? null);
  }

  deleteOwned(userId: string, contact: ContactOfApplication): Promise<number> {
    return Promise.resolve(this.contactOf(userId, contact) === undefined ? 0 : 1);
  }

  private historiesOf(userId: string): OwnedHistory[] {
    return HISTORIES.filter((history) => history.userId === userId);
  }

  private applicationOf(userId: string, { applicationId }: ContactsOfApplication) {
    return this.historiesOf(userId).find(({ id }) => id === applicationId);
  }

  private contactOf(userId: string, { contactId, ...application }: ContactOfApplication) {
    return this.applicationOf(userId, application)?.contacts.find(({ id }) => id === contactId);
  }
}

async function serviceWithFakes() {
  const repository = new FakeContactsRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [ContactsService, ContactsRepository],
    now: NOW,
  })
    .overrideProvider(ContactsRepository)
    .useValue(repository)
    .compile();
  return { repository, service: moduleRef.get(ContactsService) };
}

describe('ContactsService.list', () => {
  it('pools a contact over every application holding its email, whatever its case', async () => {
    const { service } = await serviceWithFakes();

    const { items } = await service.list(OLENA_ID, APPLICATION_ID);

    expect(items.map(({ id, avgResponseHours }) => ({ id, avgResponseHours }))).toEqual([
      { id: CONTACT_ID, avgResponseHours: 10 },
      { id: IHOR_ID, avgResponseHours: 14 },
    ]);
  });

  it('suggests each other email once in its latest copy, newest first, minus the emails already here', async () => {
    const { service } = await serviceWithFakes();

    const { suggestions } = await service.list(OLENA_ID, APPLICATION_ID);

    expect(suggestions).toEqual([
      {
        id: MARTA_NEWER_ID,
        applicationId: THIRD_APPLICATION_ID,
        name: 'Марта Коваль',
        role: null,
        email: 'Marta@Acme.io',
        telegram: null,
        phone: null,
        note: null,
        createdAt: '2026-10-17T09:00:00.000Z',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
      expect.objectContaining({ id: PETRO_ID, updatedAt: '2026-10-19T09:00:00.000Z' }),
    ]);
  });
});

describe.each([
  {
    method: 'create',
    call: (service: ContactsService, { userId, id }: Target) =>
      service.create(userId, { applicationId: id, input: INPUT }),
  },
  {
    method: 'list',
    call: (service: ContactsService, { userId, id }: Target) => service.list(userId, id),
  },
])('ContactsService.$method', ({ call }) => {
  it.each(MISSING_TARGETS)('answers $case with 404 and stores nothing', async (target) => {
    const { repository, service } = await serviceWithFakes();

    await expect(call(service, target)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect(repository.inserted).toEqual([]);
  });
});

describe.each([
  {
    method: 'update',
    call: (service: ContactsService) =>
      service.update(OLENA_ID, { ...MISSING_CONTACT, input: { role: 'Recruiter' } }),
  },
  {
    method: 'remove',
    call: (service: ContactsService) => service.remove(OLENA_ID, MISSING_CONTACT),
  },
])('ContactsService.$method', ({ call }) => {
  it('answers a contact missing from the application with 404 Contact not found', async () => {
    const { service } = await serviceWithFakes();

    await expect(call(service)).rejects.toMatchObject(CONTACT_NOT_FOUND);
  });
});
