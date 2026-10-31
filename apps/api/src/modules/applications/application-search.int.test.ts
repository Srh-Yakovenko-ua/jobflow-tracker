import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import {
  APPLICATIONS_PATH,
  companiesOf,
  getApplicationBoard,
  getWithQuery,
  listApplications,
  listPages,
  notePath,
  signedInWithSearch,
} from '../../test/applications.js';
import {
  type ApplicationRowInput,
  createApplicationRows,
  createNotes,
} from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import { daysBefore, NOW } from '../../test/time.js';
import { encodeApplicationCursor, encodeRankCursor } from './application-cursor.js';
import { ApplicationSearchRepository } from './application-search.repository.js';

type Owner = { userId: string; searchId: string };

const KAFKA_NOTE = 'Шукають досвід з Kafka та Go';

const KAFKA_HIT = { text: 'Kafka', match: true };

const COMPOUND_NOTE = 'Потрібен back-end на Node.js';

const SEARCH_ROWS = [
  { company: 'Kavun Labs', position: 'Backend engineer', lastEventAt: daysBefore(1) },
  { company: 'Zürich AG', position: 'Data engineer', lastEventAt: daysBefore(2) },
  { company: 'Zurich Re', position: 'Platform engineer', lastEventAt: daysBefore(3) },
  {
    company: 'Smereka Soft',
    position: 'Frontend engineer',
    stack: ['Go', 'Redis'],
    lastEventAt: daysBefore(4),
  },
  { company: 'Kafka Systems', position: 'Backend engineer', lastEventAt: daysBefore(5) },
  { company: 'Lypa Dev', position: 'Full-stack веб-розробник', lastEventAt: daysBefore(6) },
] satisfies ApplicationRowInput[];

describe('the full text search of the list and the board', () => {
  const testApp = useTestApp();

  const rowsFor = (owner: Owner, rows: ApplicationRowInput[]) =>
    createApplicationRows(testApp.prisma, { ...owner, rows });

  const kafkaNotesOn = (applicationIds: string[]) =>
    createNotes(
      testApp.prisma,
      applicationIds.map((applicationId) => ({ applicationId, body: KAFKA_NOTE })),
    );

  async function olenaWithKafkaNote() {
    const olena = await signedInWithSearch(testApp.prisma);
    const ids = await rowsFor(olena, SEARCH_ROWS);
    const [kavunId = ''] = ids;
    const [noteId = ''] = await kafkaNotesOn([kavunId]);
    return { ...olena, ids, kavunId, noteId };
  }

  it('finds an application whose only Kafka is in a note, with the Kafka of the note as a matched snippet part, and counts it on the board', async () => {
    const { accessToken } = await olenaWithKafkaNote();

    const list = await listApplications(testApp.app, { accessToken, query: { q: 'kafka' } });
    const board = await getApplicationBoard(testApp.app, { accessToken, query: { q: 'kafka' } });

    expect(companiesOf(list)).toEqual(['Kavun Labs', 'Kafka Systems']);
    expect(list.items[0]?.snippet).toContainEqual(KAFKA_HIT);
    expect(board.columns.applied.count).toBe(2);
    expect(board.columns.applied.items?.map(({ company }) => company)).toEqual([
      'Kavun Labs',
      'Kafka Systems',
    ]);
  });

  it.each([
    { q: 'kaf', companies: ['Kavun Labs', 'Kafka Systems'] },
    { q: 'zurich', companies: ['Zürich AG', 'Zurich Re'] },
    { q: 'Zürich', companies: ['Zürich AG', 'Zurich Re'] },
    { q: 'redis', companies: ['Smereka Soft'] },
    { q: '"досвід з kafka"', companies: ['Kavun Labs'] },
    { q: 'kafka -go', companies: ['Kafka Systems'] },
    { q: 'full-stack', companies: ['Lypa Dev'] },
    { q: 'full-st', companies: ['Lypa Dev'] },
    { q: 'веб-розроб', companies: ['Lypa Dev'] },
    { q: 'erlang', companies: [] },
  ])('lists $companies for q $q', async ({ q, companies }) => {
    const { accessToken } = await olenaWithKafkaNote();

    const list = await listApplications(testApp.app, { accessToken, query: { q } });

    expect(companiesOf(list)).toEqual(companies);
  });

  it.each([
    { q: 'back-end', companies: ['Zürich AG'] },
    { q: 'bac', companies: ['Kavun Labs', 'Zürich AG', 'Kafka Systems'] },
    { q: 'node.js', companies: ['Zürich AG'] },
    { q: 'nod', companies: ['Zürich AG'] },
  ])(
    'finds the hyphenated back-end and the dotted Node.js of a note, listing $companies for q $q',
    async ({ q, companies }) => {
      const { accessToken, ids } = await olenaWithKafkaNote();
      const [, zurichId = ''] = ids;
      await createNotes(testApp.prisma, [{ applicationId: zurichId, body: COMPOUND_NOTE }]);

      const list = await listApplications(testApp.app, { accessToken, query: { q } });

      expect(companiesOf(list)).toEqual(companies);
    },
  );

  it("leaves out BOHDAN's application and OLENA's deleted one, though both carry a Kafka note", async () => {
    const olena = await olenaWithKafkaNote();
    const bohdan = await signedInWithSearch(testApp.prisma);
    const [deletedId = ''] = await rowsFor(olena, [
      { company: 'Buk Cloud', lastEventAt: NOW, deletedAt: NOW },
    ]);
    const [bohdanId = ''] = await rowsFor(bohdan, [{ company: 'Dub Data', lastEventAt: NOW }]);
    await kafkaNotesOn([deletedId, bohdanId]);
    const search = testApp.app.get(ApplicationSearchRepository);

    const olenaList = await listApplications(testApp.app, {
      accessToken: olena.accessToken,
      query: { q: 'kafka', sort: 'relevance' },
    });
    const bohdanList = await listApplications(testApp.app, {
      accessToken: bohdan.accessToken,
      query: { q: 'kafka' },
    });
    const matches = await search.findMatches(olena.userId, { q: 'kafka' });
    const headlines = await search.findSnippets(olena.userId, {
      q: 'kafka',
      applicationIds: [bohdanId],
    });

    expect(companiesOf(olenaList)).toEqual(['Kafka Systems', 'Kavun Labs']);
    expect(companiesOf(bohdanList)).toEqual(['Dub Data']);
    expect(matches.map(({ id }) => id).sort()).toEqual([olena.ids[0], olena.ids[4]].sort());
    expect(headlines).toEqual([]);
  });

  it('stops matching a note once it is edited from Kafka to Go', async () => {
    const { accessToken, kavunId, noteId } = await olenaWithKafkaNote();

    const edit = await callRoute(testApp.app, {
      method: 'patch',
      path: notePath({ id: kavunId, noteId }),
      body: { body: 'Тепер лише Go' },
      accessToken,
    });
    const list = await listApplications(testApp.app, { accessToken, query: { q: 'kafka' } });

    expect(edit.status).toBe(200);
    expect(companiesOf(list)).toEqual(['Kafka Systems']);
  });

  it('puts the company match before the newer notes-only match by relevance, with a snippet on the notes-only hit only', async () => {
    const { accessToken } = await olenaWithKafkaNote();

    const page = await listApplications(testApp.app, {
      accessToken,
      query: { q: 'kafka', sort: 'relevance' },
    });

    expect(companiesOf(page)).toEqual(['Kafka Systems', 'Kavun Labs']);
    expect(page.items[0]?.snippet).toBeNull();
    expect(page.items[1]?.snippet).toContainEqual(KAFKA_HIT);
  });

  it('walks relevance pages of 1 through every hit once, a tie of equal ranks by the newer id first, and ends with no cursor', async () => {
    const olena = await olenaWithKafkaNote();
    const [yasenId = ''] = await rowsFor(olena, [
      { company: 'Yasen Tech', position: 'Backend engineer', lastEventAt: daysBefore(6) },
    ]);
    await kafkaNotesOn([yasenId]);

    const pages = await listPages(testApp.app, {
      accessToken: olena.accessToken,
      query: { q: 'kafka', sort: 'relevance', limit: '1' },
    });

    expect(pages.map(companiesOf)).toEqual([['Kafka Systems'], ['Yasen Tech'], ['Kavun Labs']]);
    expect(pages.at(-1)?.nextCursor).toBeNull();
  });

  it.each([
    { case: 'sort relevance without q', query: { sort: 'relevance' }, error: 'sort' },
    {
      case: 'a rank cursor with sort lastEventAt',
      query: {
        sort: 'lastEventAt',
        cursor: encodeRankCursor({ rank: 0.5, id: randomUUID() }),
      },
      error: 'cursor',
    },
    {
      case: 'a date cursor with sort relevance',
      query: {
        q: 'kafka',
        sort: 'relevance',
        cursor: encodeApplicationCursor({ lastEventAt: NOW, id: randomUUID() }),
      },
      error: 'cursor',
    },
  ])('answers $case with 422 at $error', async ({ query, error }) => {
    const { accessToken } = await signedInWithSearch(testApp.prisma);

    const response = await getWithQuery(testApp.app, {
      path: APPLICATIONS_PATH,
      accessToken,
      query,
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, [error]]);
  });

  it('answers a search without a token with 401', async () => {
    const response = await getWithQuery(testApp.app, {
      path: APPLICATIONS_PATH,
      query: { q: 'kafka' },
    });

    expect(response.status).toBe(401);
  });
});
