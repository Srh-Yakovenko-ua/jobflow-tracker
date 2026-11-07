import { randomUUID } from 'node:crypto';

import { errorResponseSchema, noteSchema } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  notesPath,
  type SignedInApplication,
  signUpWithApplication,
} from '../../test/applications.js';
import { BOHDAN } from '../../test/auth.js';
import { callRoute, errorPathsOf, statusAndDetail } from '../../test/http.js';
import { keyHeaders } from '../../test/idempotency.js';
import { minutesAfter, NOW, settableClock } from '../../test/time.js';
import { Clock } from '../clock.js';
import { type ClaimOutcome, IdempotencyRepository } from './idempotency.repository.js';

type KeyedNote = { application: SignedInApplication; body: object; key?: string };

const FIRST = { body: 'Перша нотатка' };

const OTHER = { body: 'Інша нотатка' };

const DAY_MINUTES = 24 * 60;

const IN_PROGRESS = [409, 'A request with this Idempotency-Key is still in progress'];

const REFUSED = new Error('connect ECONNREFUSED 127.0.0.1:5432');

class BrokenKeys implements Pick<IdempotencyRepository, 'claim' | 'complete' | 'release'> {
  claimRefused = true;

  claim(): Promise<ClaimOutcome> {
    return this.claimRefused ? Promise.reject(REFUSED) : Promise.resolve({ claimed: true });
  }

  complete(): Promise<void> {
    return Promise.reject(REFUSED);
  }

  release(): Promise<void> {
    return Promise.reject(REFUSED);
  }
}

const clock = settableClock(NOW);

function postNote(app: NestExpressApplication, { application, body, key }: KeyedNote) {
  const { accessToken, id } = application;
  const headers = key === undefined ? {} : keyHeaders(key);
  return callRoute(app, { method: 'post', path: notesPath(id), body, accessToken, headers });
}

const noteIdOf = ({ body }: Response) => noteSchema.parse(body).id;

const errorOf = (response: Response) => errorResponseSchema.parse(response.body);

describe('an Idempotency-Key on the create POSTs', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  beforeEach(() => {
    clock.at(NOW);
  });

  const post = (note: KeyedNote) => postNote(testApp.app, note);

  const noteBodies = async () =>
    (await testApp.prisma.note.findMany({ select: { body: true } })).map(({ body }) => body);

  it('answers the same key with another body with 409 and keeps the first note alone', async () => {
    const olena = await signUpWithApplication(testApp.app);
    const key = randomUUID();

    const first = await post({ application: olena, body: FIRST, key });
    const second = await post({ application: olena, body: OTHER, key });

    expect(first.status).toBe(201);
    expect(errorOf(second)).toEqual({
      type: 'conflict',
      title: 'Conflict',
      status: 409,
      detail: 'Idempotency-Key was already used with another request',
      requestId: second.get('x-request-id'),
    });
    expect(await noteBodies()).toEqual([FIRST.body]);
  });

  it("never replays one user's key to another user, and keeps the first user's reply", async () => {
    const olena = await signUpWithApplication(testApp.app);
    const bohdan = await signUpWithApplication(testApp.app, BOHDAN);
    const key = randomUUID();

    const olenaNote = await post({ application: olena, body: FIRST, key });
    const bohdanNote = await post({ application: bohdan, body: FIRST, key });
    const olenaReplay = await post({ application: olena, body: FIRST, key });

    expect(bohdanNote.status).toBe(201);
    expect(noteSchema.parse(bohdanNote.body)).toMatchObject({ applicationId: bohdan.id });
    expect(noteIdOf(bohdanNote)).not.toBe(noteIdOf(olenaNote));
    expect([olenaReplay.status, olenaReplay.body]).toEqual([201, olenaNote.body]);
    expect(await noteBodies()).toEqual([FIRST.body, FIRST.body]);
  });

  it('leaves two POSTs without the header as two notes and stores no key', async () => {
    const olena = await signUpWithApplication(testApp.app);

    const first = await post({ application: olena, body: FIRST });
    const second = await post({ application: olena, body: FIRST });

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(await testApp.prisma.note.count()).toBe(2);
    expect(await testApp.prisma.idempotencyKey.count()).toBe(0);
  });

  it('releases the key after a refused POST, so the fixed retry with the same key creates the note', async () => {
    const olena = await signUpWithApplication(testApp.app);
    const key = randomUUID();

    const refused = await post({ application: olena, body: { body: ' ' }, key });
    const retried = await post({ application: olena, body: FIRST, key });

    expect([refused.status, retried.status]).toEqual([422, 201]);
    expect(await noteBodies()).toEqual([FIRST.body]);
  });

  it('replays the key for 24 hours and makes a new note once it is older', async () => {
    const olena = await signUpWithApplication(testApp.app);
    const key = randomUUID();
    const first = await post({ application: olena, body: FIRST, key });

    clock.at(minutesAfter(DAY_MINUTES - 1));
    const replayed = await post({ application: olena, body: FIRST, key });
    clock.at(minutesAfter(DAY_MINUTES + 1));
    const renewed = await post({ application: olena, body: FIRST, key });

    expect(replayed.body).toEqual(first.body);
    expect(renewed.status).toBe(201);
    expect(noteIdOf(renewed)).not.toBe(noteIdOf(first));
    expect(await testApp.prisma.note.count()).toBe(2);
  });

  it('lets one of two concurrent POSTs with one key create the note and answers the other with it or in progress', async () => {
    const olena = await signUpWithApplication(testApp.app);
    const note = { application: olena, body: FIRST, key: randomUUID() };

    const outcomes = (await Promise.all([post(note), post(note)])).map(statusAndDetail);

    expect(outcomes).toContainEqual([201, undefined]);
    for (const outcome of outcomes) expect([[201, undefined], IN_PROGRESS]).toContainEqual(outcome);
    expect(await testApp.prisma.note.count()).toBe(1);
  });
});

describe('an Idempotency-Key whose store the database refuses', () => {
  const keys = new BrokenKeys();
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(IdempotencyRepository).useValue(keys),
  );

  beforeEach(() => {
    keys.claimRefused = true;
  });

  const postKeyed = async (body: object) =>
    postNote(testApp.app, {
      application: await signUpWithApplication(testApp.app),
      body,
      key: randomUUID(),
    });

  it('answers a refused claim with 500 and requestId and creates no note', async () => {
    const response = await postKeyed(FIRST);

    expect(errorOf(response)).toEqual({
      type: 'internal_error',
      title: 'Internal error',
      status: 500,
      requestId: response.get('x-request-id'),
    });
    expect(await testApp.prisma.note.count()).toBe(0);
  });

  it('still answers 201 with the note when storing the reply fails', async () => {
    keys.claimRefused = false;

    const response = await postKeyed(FIRST);

    expect([response.status, noteSchema.parse(response.body).body]).toEqual([201, FIRST.body]);
    expect(await testApp.prisma.note.count()).toBe(1);
  });

  it('answers with the original 422 when releasing the key fails', async () => {
    keys.claimRefused = false;

    const response = await postKeyed({ body: ' ' });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['body']]);
  });
});
