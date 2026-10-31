import {
  contactListResponseSchema,
  contactSchema,
  type CreateContactInput,
  type MoveApplicationInput,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  applicationPath,
  contactPath,
  contactsPath,
  type ContactTarget,
  createApplication,
  foreignReaches,
  notesPath,
  postStageMove,
  ROMASHKA,
  type SignedInApplication,
  signUpWithApplication,
  undoLastMove,
  useStageMoveTestApp,
} from '../../test/applications.js';
import { BOHDAN } from '../../test/auth.js';
import { callRoute, errorPathsOf, type RouteCall, statusAndDetail } from '../../test/http.js';
import { hoursLater } from '../../test/response-history.js';
import { minutesAfter, NOW, settableClock } from '../../test/time.js';
import { CONTACT_SELECT } from './contacts.repository.js';

type SignedInContact = SignedInApplication & ContactTarget;

type ContactRoute = Omit<RouteCall, 'accessToken'>;

type TimedMove = { hours: number; input: MoveApplicationInput };

const NOW_ISO = '2026-10-22T09:00:00.000Z';

const OKSANA = {
  name: 'Оксана Левченко',
  role: 'Talent Partner',
  email: 'o.levchenko@acme.io',
  telegram: '@oksana_hr',
  phone: '+380 (67) 123-45-67',
  note: 'Відповідає ввечері',
} satisfies CreateContactInput;

const EDITED = { role: 'Head of Talent', phone: null };

const TO_SCREENING: MoveApplicationInput = { fromStage: 'applied', toStage: 'screening' };

const TO_TECH_INTERVIEW: MoveApplicationInput = {
  fromStage: 'screening',
  toStage: 'tech_interview',
};

const MISSING_CONTACT = [404, 'Contact not found'];

const MISSING_APPLICATION = [404, 'Application not found'];

const clock = settableClock(NOW);

const contactRoutes = (target: ContactTarget, body: object = EDITED) =>
  ({
    post: { method: 'post', path: contactsPath(target.id), body: { ...OKSANA, ...body } },
    get: { method: 'get', path: contactsPath(target.id) },
    patch: { method: 'patch', path: contactPath(target), body },
    delete: { method: 'delete', path: contactPath(target) },
  }) satisfies Record<RouteCall['method'], ContactRoute>;

describe('the contacts routes', () => {
  const testApp = useStageMoveTestApp(clock);

  const call = (accessToken: string, route: ContactRoute) =>
    callRoute(testApp.app, { ...route, accessToken });

  const callAll = (accessToken: string, routes: ContactRoute[]) =>
    Promise.all(routes.map((route) => call(accessToken, route)));

  const postContact = ({ accessToken, id }: SignedInApplication, body: object) =>
    call(accessToken, { method: 'post', path: contactsPath(id), body });

  const storedContact = (contactId: string) =>
    testApp.prisma.contact.findUniqueOrThrow({ where: { id: contactId }, select: CONTACT_SELECT });

  async function contactsOf({ accessToken, id }: SignedInApplication) {
    const response = await call(accessToken, { method: 'get', path: contactsPath(id) });
    expect(response.status).toBe(200);
    return contactListResponseSchema.parse(response.body);
  }

  async function addContact(application: SignedInApplication, body: object) {
    const response = await postContact(application, body);
    return { ...application, contactId: contactSchema.parse(response.body).id };
  }

  const olenaWithContact = async (): Promise<SignedInContact> =>
    addContact(await signUpWithApplication(testApp.app), OKSANA);

  async function moveAt(application: SignedInApplication, { hours, input }: TimedMove) {
    clock.at(hoursLater(hours));
    const response = await postStageMove(testApp.app, { ...application, input });
    expect(response.status).toBe(201);
  }

  async function responseHoursOf(application: SignedInApplication) {
    const { items } = await contactsOf(application);
    return items.map(({ avgResponseHours }) => avgResponseHours);
  }

  it('POST answers 201 with the contact as sent, stamped with the clock time', async () => {
    const application = await signUpWithApplication(testApp.app);

    const response = await postContact(application, OKSANA);

    expect(response.status).toBe(201);
    const { id, ...contact } = contactSchema.parse(response.body);
    expect(contact).toEqual({
      ...OKSANA,
      applicationId: application.id,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(await storedContact(id)).toMatchObject({ ...OKSANA, createdAt: NOW, updatedAt: NOW });
  });

  it('POST with only a name trims it and stores every other field as null', async () => {
    const application = await signUpWithApplication(testApp.app);

    const response = await postContact(application, { name: '  Ігор  ' });

    expect(response.status).toBe(201);
    expect(contactSchema.parse(response.body)).toMatchObject({
      name: 'Ігор',
      role: null,
      email: null,
      telegram: null,
      phone: null,
      note: null,
    });
  });

  it('GET lists the contacts oldest first, with no response time before two replies', async () => {
    const first = await olenaWithContact();
    clock.at(minutesAfter(5));
    const second = await addContact(first, { name: 'Марта Коваль' });

    const { items, suggestions } = await contactsOf(first);

    expect(
      items.map(({ id, createdAt, avgResponseHours }) => [id, createdAt, avgResponseHours]),
    ).toEqual([
      [first.contactId, NOW_ISO, null],
      [second.contactId, '2026-10-22T09:05:00.000Z', null],
    ]);
    expect(suggestions).toEqual([]);
  });

  it('PATCH changes the sent fields and updatedAt, clears a field sent as null and keeps the rest', async () => {
    const contact = await olenaWithContact();
    clock.at(minutesAfter(30));

    const response = await call(contact.accessToken, contactRoutes(contact).patch);

    expect(response.status).toBe(200);
    expect(contactSchema.parse(response.body)).toEqual({
      ...OKSANA,
      ...EDITED,
      id: contact.contactId,
      applicationId: contact.id,
      createdAt: NOW_ISO,
      updatedAt: '2026-10-22T09:30:00.000Z',
    });
  });

  it('DELETE answers 204 and the contact leaves the list', async () => {
    const contact = await olenaWithContact();

    const response = await call(contact.accessToken, contactRoutes(contact).delete);

    expect([response.status, response.text]).toEqual([204, '']);
    expect((await contactsOf(contact)).items).toEqual([]);
  });

  it('answers every contacts route without a token with 401', async () => {
    const contact = await olenaWithContact();

    const responses = await Promise.all(
      Object.values(contactRoutes(contact)).map((route) => callRoute(testApp.app, route)),
    );

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
  });

  it.each([
    { case: 'no name', method: 'post', body: { email: OKSANA.email }, path: 'name' },
    { case: 'a name of spaces', method: 'post', body: { name: '   ' }, path: 'name' },
    {
      case: 'a malformed email',
      method: 'post',
      body: { name: 'Оксана', email: 'oksana@' },
      path: 'email',
    },
    {
      case: 'a t.me link for telegram',
      method: 'patch',
      body: { telegram: 'https://t.me/oksana_hr' },
      path: 'telegram',
    },
    { case: 'a name cleared with null', method: 'patch', body: { name: null }, path: 'name' },
    { case: 'an empty patch', method: 'patch', body: {}, path: '' },
  ] as const)(
    '$method answers $case with 422 at "$path" and keeps the contact',
    async ({ method, body, path }) => {
      const contact = await olenaWithContact();
      const before = await storedContact(contact.contactId);
      const route = { ...contactRoutes(contact)[method], body };

      const response = await call(contact.accessToken, route);

      expect([response.status, errorPathsOf(response.body)]).toEqual([422, [path]]);
      expect(await storedContact(contact.contactId)).toEqual(before);
      expect(await testApp.prisma.contact.count()).toBe(1);
    },
  );

  it('PATCH and DELETE answer a malformed contact id with 422', async () => {
    const contact = await olenaWithContact();
    const { patch, delete: remove } = contactRoutes({ ...contact, contactId: 'not-a-uuid' });

    const responses = await callAll(contact.accessToken, [patch, remove]);

    expect(responses.map(({ status, body }) => [status, errorPathsOf(body)])).toEqual([
      [422, ['']],
      [422, ['']],
    ]);
  });

  it.each(foreignReaches<SignedInContact>(testApp, 'contact'))(
    'PATCH and DELETE answer $case with 404 and keep the contact',
    async ({ reach }) => {
      const contact = await olenaWithContact();
      const before = await storedContact(contact.contactId);
      const target = await reach(contact);
      const { patch, delete: remove } = contactRoutes(target);

      const responses = await callAll(target.accessToken, [patch, remove]);

      expect(responses.map(statusAndDetail)).toEqual([MISSING_CONTACT, MISSING_CONTACT]);
      expect(await storedContact(contact.contactId)).toEqual(before);
    },
  );

  it('answers every contacts route on a soft-deleted application with 404 and keeps the contact', async () => {
    const contact = await olenaWithContact();
    const before = await storedContact(contact.contactId);
    await call(contact.accessToken, { method: 'delete', path: applicationPath(contact.id) });

    const responses = await callAll(contact.accessToken, Object.values(contactRoutes(contact)));

    expect(responses.map(statusAndDetail)).toEqual([
      MISSING_APPLICATION,
      MISSING_APPLICATION,
      MISSING_CONTACT,
      MISSING_CONTACT,
    ]);
    expect(await storedContact(contact.contactId)).toEqual(before);
    expect(await testApp.prisma.contact.count()).toBe(1);
  });

  it('GET shows avgResponseHours 14 after replies 10 h and 18 h apart through POST /events', async () => {
    const contact = await olenaWithContact();

    await moveAt(contact, { hours: 10, input: TO_SCREENING });
    await moveAt(contact, { hours: 28, input: TO_TECH_INTERVIEW });

    expect(await responseHoursOf(contact)).toEqual([14]);
  });

  it('leaves an undone move and its undo out of the response time', async () => {
    const contact = await olenaWithContact();
    await moveAt(contact, { hours: 10, input: TO_SCREENING });
    clock.at(new Date(hoursLater(10).getTime() + 5000));
    expect((await undoLastMove(testApp.app, contact)).status).toBe(201);

    await moveAt(contact, { hours: 20, input: TO_SCREENING });
    await moveAt(contact, { hours: 38, input: TO_TECH_INTERVIEW });

    expect(await responseHoursOf(contact)).toEqual([19]);
  });

  it('starts the wait again at a followup_sent row but not at a note', async () => {
    const contact = await olenaWithContact();
    clock.at(hoursLater(5));
    await call(contact.accessToken, {
      method: 'post',
      path: notesPath(contact.id),
      body: { body: 'Нотатка' },
    });
    await moveAt(contact, { hours: 10, input: TO_SCREENING });
    await testApp.prisma.timelineEvent.create({
      data: { applicationId: contact.id, kind: 'followup_sent', occurredAt: hoursLater(20) },
      select: { id: true },
    });

    await moveAt(contact, { hours: 28, input: TO_TECH_INTERVIEW });

    expect(await responseHoursOf(contact)).toEqual([9]);
  });

  it("suggests OLENA's same email from her other ромашка application, never another company, a deleted application or BOHDAN", async () => {
    const olena = await olenaWithContact();
    const { accessToken } = olena;
    await addContact(olena, { name: 'Марта Коваль', email: 'marta@romashka.ua' });
    const acme = await createApplication(testApp.app, {
      accessToken,
      input: { ...ROMASHKA, company: 'Acme' },
    });
    await addContact({ accessToken, id: acme.id }, { name: 'Ірина', email: 'hr@acme.io' });
    const deleted = await addContact(
      {
        accessToken,
        id: (await createApplication(testApp.app, { accessToken, input: ROMASHKA })).id,
      },
      { name: 'Колишня', email: 'old@romashka.ua' },
    );
    await call(accessToken, { method: 'delete', path: applicationPath(deleted.id) });
    await addContact(await signUpWithApplication(testApp.app, BOHDAN), {
      name: 'Тарас',
      email: 'taras@romashka.ua',
    });
    const fresh = await createApplication(testApp.app, {
      accessToken,
      input: { ...ROMASHKA, company: 'ромашка' },
    });
    await addContact({ accessToken, id: fresh.id }, { name: 'Марта', email: 'Marta@Romashka.ua' });

    const { items, suggestions } = await contactsOf({ accessToken, id: fresh.id });

    expect(items.map(({ name }) => name)).toEqual(['Марта']);
    expect(suggestions).toEqual([
      {
        ...OKSANA,
        id: olena.contactId,
        applicationId: olena.id,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      },
    ]);
  });
});
