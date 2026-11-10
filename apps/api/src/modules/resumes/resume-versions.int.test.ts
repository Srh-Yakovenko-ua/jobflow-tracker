import {
  applicationTimelineResponseSchema,
  errorResponseSchema,
  resumeDownloadSchema,
  type ResumeUploadTicket,
  resumeVersionListResponseSchema,
  resumeVersionSchema,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { useTestApp } from '../../test/app.js';
import {
  applicationPath,
  createApplication,
  ROMASHKA,
  timelinePath,
} from '../../test/applications.js';
import { BOHDAN, OLENA, signUp } from '../../test/auth.js';
import { callRoute, errorPathsOf, type RouteCall, statusAndDetail } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import {
  activationPath,
  downloadPath,
  exeBytesOfLength,
  PDF,
  PDF_BYTES,
  postResumeVersion,
  putThroughTicket,
  RESUME_VERSIONS_PATH,
  resumeLinkPath,
  resumeVersionPath,
  uploadedPdf,
  type UploadedVersion,
  uploadResumeVersion,
} from '../../test/resumes.js';

type Owner = { userId: string; accessToken: string };

type Route = Omit<RouteCall, 'accessToken'>;

const MISSING_ID = '0199f0a0-0000-7000-8000-0000000000ff';

const NEVER_UPLOADED_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

const MALFORMED_ID = 'not-a-uuid';

const MALFORMED_REQUESTS: { case: string; route: (applicationId: string) => Route; at: string }[] =
  [
    {
      case: 'DELETE of a malformed version id',
      route: () => ({ method: 'delete', path: resumeVersionPath(MALFORMED_ID) }),
      at: 'id',
    },
    {
      case: 'activating a malformed version id',
      route: () => ({ method: 'post', path: activationPath(MALFORMED_ID) }),
      at: 'id',
    },
    {
      case: 'the download of a malformed version id',
      route: () => ({ method: 'get', path: downloadPath(MALFORMED_ID) }),
      at: 'id',
    },
    {
      case: 'a relink of a malformed application id',
      route: () => ({
        method: 'patch',
        path: resumeLinkPath(MALFORMED_ID),
        body: { resumeVersionId: MISSING_ID },
      }),
      at: 'id',
    },
    {
      case: 'a relink to a malformed version id',
      route: (applicationId) => ({
        method: 'patch',
        path: resumeLinkPath(applicationId),
        body: { resumeVersionId: MALFORMED_ID },
      }),
      at: 'resumeVersionId',
    },
    {
      case: 'a relink without a version id',
      route: (applicationId) => ({
        method: 'patch',
        path: resumeLinkPath(applicationId),
        body: {},
      }),
      at: 'resumeVersionId',
    },
  ];

const ROUTES_WITHOUT_TOKEN: Route[] = [
  { method: 'get', path: RESUME_VERSIONS_PATH },
  { method: 'post', path: RESUME_VERSIONS_PATH, body: {} },
  { method: 'patch', path: resumeVersionPath(MISSING_ID), body: { isArchived: true } },
  { method: 'delete', path: resumeVersionPath(MISSING_ID) },
  { method: 'post', path: activationPath(MISSING_ID) },
  { method: 'get', path: downloadPath(MISSING_ID) },
  { method: 'patch', path: resumeLinkPath(MISSING_ID), body: { resumeVersionId: MISSING_ID } },
];

const storedKey = ({ userId }: Owner, { uploadId }: ResumeUploadTicket) =>
  `users/${userId}/resumes/${uploadId}.pdf`;

describe('the resume versions of a user', () => {
  const testApp = useTestApp();

  async function signedUp(): Promise<Owner> {
    const { accessToken, user } = await signUp(testApp.app, OLENA);
    return { userId: user.id, accessToken };
  }

  const call = (accessToken: string | undefined, route: Route) =>
    callRoute(testApp.app, { ...route, accessToken });

  async function twoVersions(owner: Owner): Promise<[UploadedVersion, UploadedVersion]> {
    const first = await uploadResumeVersion(testApp.app, owner);
    return [first, await uploadResumeVersion(testApp.app, owner)];
  }

  const activate = (owner: Owner, id: string) =>
    call(owner.accessToken, { method: 'post', path: activationPath(id) });

  const newApplication = (owner: Owner, company = ROMASHKA.company) =>
    createApplication(testApp.app, {
      accessToken: owner.accessToken,
      input: { ...ROMASHKA, company },
    });

  it('creates version 1 and then 2 with 201, the copied key, the stored size and one resume.version_uploaded row each', async () => {
    const owner = await signedUp();
    const firstTicket = await uploadedPdf(testApp.app, { ...owner, bytes: PDF_BYTES });
    const secondTicket = await uploadedPdf(testApp.app, { ...owner, bytes: PDF_BYTES });

    const first = await postResumeVersion(testApp.app, { ...owner, ticket: firstTicket });
    const second = await postResumeVersion(testApp.app, { ...owner, ticket: secondTicket });

    const versions = [first, second].map(({ body }) => resumeVersionSchema.parse(body));
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(versions[0]).toMatchObject({
      number: 1,
      title: 'для продуктових',
      note: null,
      filename: 'cv.pdf',
      mime: PDF,
      sizeBytes: PDF_BYTES.length,
      isArchived: false,
      aiProfileStatus: 'queued',
      applicationsCount: 0,
    });
    expect(versions[1]).toMatchObject({ number: 2 });
    expect(
      await testApp.prisma.resumeVersion.findMany({
        where: { userId: owner.userId },
        orderBy: { number: 'asc' },
        select: { number: true, storageKey: true, sizeBytes: true },
      }),
    ).toEqual(
      [firstTicket, secondTicket].map((ticket, index) => ({
        number: index + 1,
        storageKey: storedKey(owner, ticket),
        sizeBytes: PDF_BYTES.length,
      })),
    );
    expect(await outboxRows(testApp.prisma, { eventType: 'resume.version_uploaded' })).toEqual(
      versions.map(({ id }) => ({
        aggregate: 'resume_version',
        aggregateId: id,
        eventType: 'resume.version_uploaded',
        payload: { userId: owner.userId, resumeVersionId: id },
      })),
    );
  });

  it('answers 409 to a second version from the same upload and keeps one row', async () => {
    const owner = await signedUp();
    const { ticket } = await uploadResumeVersion(testApp.app, owner);

    const response = await postResumeVersion(testApp.app, { ...owner, ticket });

    expect(statusAndDetail(response)).toEqual([409, 'A version from this upload already exists']);
    expect(await testApp.prisma.resumeVersion.count({ where: { userId: owner.userId } })).toBe(1);
  });

  it('answers 404 to a version from an upload that never reached storage', async () => {
    const owner = await signedUp();
    const response = await postResumeVersion(testApp.app, {
      ...owner,
      ticket: { uploadId: NEVER_UPLOADED_ID },
    });

    expect(statusAndDetail(response)).toEqual([404, 'Upload not found']);
  });

  it('answers 422 at title for a blank title', async () => {
    const owner = await signedUp();
    const ticket = await uploadedPdf(testApp.app, { ...owner, bytes: PDF_BYTES });

    const response = await postResumeVersion(testApp.app, { ...owner, ticket, title: ' ' });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['title']]);
  });

  it('refuses EXE bytes written through the ticket before the version with 422 at file', async () => {
    const owner = await signedUp();
    const ticket = await uploadedPdf(testApp.app, { ...owner, bytes: PDF_BYTES });
    await putThroughTicket(ticket, exeBytesOfLength(PDF_BYTES.length));

    const response = await postResumeVersion(testApp.app, { ...owner, ticket });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['file']]);
    expect(await testApp.prisma.resumeVersion.count({ where: { userId: owner.userId } })).toBe(0);
  });

  it('keeps the PDF of a version when EXE bytes are written through its ticket afterwards', async () => {
    const owner = await signedUp();
    const { ticket } = await uploadResumeVersion(testApp.app, owner);

    await putThroughTicket(ticket, exeBytesOfLength(PDF_BYTES.length));

    const start = await testApp.app
      .get(FileStorage)
      .readStart({ key: storedKey(owner, ticket), bytes: 5 });
    expect(new TextDecoder().decode(start)).toBe('%PDF-');
  });

  it('links a new Application to version 2 once version 2 is made active', async () => {
    const owner = await signedUp();
    const [, second] = await twoVersions(owner);

    const activated = await activate(owner, second.version.id);
    const application = await newApplication(owner);

    expect([activated.status, application.resumeVersionId]).toEqual([204, second.version.id]);
  });

  it('relinks an Application with 204, one resume.attached row and a timeline row, and writes nothing for the same version again', async () => {
    const owner = await signedUp();
    const [first, second] = await twoVersions(owner);
    await activate(owner, second.version.id);
    const application = await newApplication(owner);
    const relink = () =>
      call(owner.accessToken, {
        method: 'patch',
        path: resumeLinkPath(application.id),
        body: { resumeVersionId: first.version.id },
      });

    const relinked = await relink();
    const repeated = await relink();

    expect([relinked.status, repeated.status]).toEqual([204, 204]);
    expect(
      await testApp.prisma.application.findUnique({
        where: { id: application.id },
        select: { resumeVersionId: true },
      }),
    ).toEqual({ resumeVersionId: first.version.id });
    expect(await outboxRows(testApp.prisma, { eventType: 'resume.attached' })).toEqual([
      {
        aggregate: 'resume_version',
        aggregateId: first.version.id,
        eventType: 'resume.attached',
        payload: {
          userId: owner.userId,
          applicationId: application.id,
          resumeVersionId: first.version.id,
        },
      },
    ]);
    const timeline = await call(owner.accessToken, {
      method: 'get',
      path: timelinePath(application.id),
    });
    const titles = applicationTimelineResponseSchema
      .parse(timeline.body)
      .items.map(({ title }) => title);
    expect(titles.filter((title) => title.startsWith('Прикріплено'))).toEqual([
      'Прикріплено CV v1 · для продуктових',
    ]);
  });

  it('answers 409 with the archive hint to deleting a linked version and 204 to an unlinked one with its file', async () => {
    const owner = await signedUp();
    const [unlinked, linked] = await twoVersions(owner);
    await activate(owner, linked.version.id);
    await newApplication(owner);

    const refused = await call(owner.accessToken, {
      method: 'delete',
      path: resumeVersionPath(linked.version.id),
    });
    const deleted = await call(owner.accessToken, {
      method: 'delete',
      path: resumeVersionPath(unlinked.version.id),
    });

    expect(statusAndDetail(refused)).toEqual([
      409,
      'The version is linked to applications; archive it instead',
    ]);
    expect(errorResponseSchema.parse(refused.body).type).toBe('conflict');
    expect(deleted.status).toBe(204);
    expect(
      await testApp.prisma.resumeVersion.findMany({
        where: { userId: owner.userId },
        select: { id: true },
      }),
    ).toEqual([{ id: linked.version.id }]);
    const storage = testApp.app.get(FileStorage);
    const heads = await Promise.all(
      [linked, unlinked].map(({ ticket }) => storage.head(storedKey(owner, ticket))),
    );
    expect(heads.map((head) => head !== null)).toEqual([true, false]);
  });

  it('clears the active version when it is archived and answers 409 to activating it again', async () => {
    const owner = await signedUp();
    const { version } = await uploadResumeVersion(testApp.app, owner);
    await activate(owner, version.id);

    const archived = await call(owner.accessToken, {
      method: 'patch',
      path: resumeVersionPath(version.id),
      body: { isArchived: true },
    });
    const reactivated = await activate(owner, version.id);

    expect([archived.status, resumeVersionSchema.parse(archived.body).isArchived]).toEqual([
      200,
      true,
    ]);
    expect(statusAndDetail(reactivated)).toEqual([
      409,
      'Unarchive the version before making it active',
    ]);
    expect(
      await testApp.prisma.userSettings.findUnique({
        where: { userId: owner.userId },
        select: { activeResumeVersionId: true },
      }),
    ).toEqual({ activeResumeVersionId: null });
  });

  it('answers 422 at title to a title over 120 characters', async () => {
    const owner = await signedUp();
    const { version } = await uploadResumeVersion(testApp.app, owner);

    const response = await call(owner.accessToken, {
      method: 'patch',
      path: resumeVersionPath(version.id),
      body: { title: 'а'.repeat(121) },
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['title']]);
  });

  it('signs a download URL with the type and filename of the version row', async () => {
    const owner = await signedUp();
    const { version } = await uploadResumeVersion(testApp.app, owner);

    const response = await call(owner.accessToken, {
      method: 'get',
      path: downloadPath(version.id),
    });

    const query = new URL(resumeDownloadSchema.parse(response.body).url).searchParams;
    expect([
      response.status,
      query.get('response-content-type'),
      query.get('response-content-disposition'),
    ]).toEqual([200, PDF, "inline; filename*=UTF-8''cv.pdf"]);
  });

  it('lists the versions highest number first, counting only Applications not deleted, with the AI profile queued', async () => {
    const owner = await signedUp();
    const [first] = await twoVersions(owner);
    await activate(owner, first.version.id);
    await newApplication(owner);
    const removed = await newApplication(owner, 'Ромашка Лаб');
    await call(owner.accessToken, { method: 'delete', path: applicationPath(removed.id) });

    const response = await call(owner.accessToken, { method: 'get', path: RESUME_VERSIONS_PATH });

    const { items } = resumeVersionListResponseSchema.parse(response.body);
    expect(
      items.map(({ number, applicationsCount, aiProfileStatus }) => [
        number,
        applicationsCount,
        aiProfileStatus,
      ]),
    ).toEqual([
      [2, 0, 'queued'],
      [1, 1, 'queued'],
    ]);
  });

  it("lists BOHDAN only his own versions while OLENA's exist", async () => {
    await twoVersions(await signedUp());
    const bohdan = await signUp(testApp.app, BOHDAN);
    const { version } = await uploadResumeVersion(testApp.app, bohdan);

    const response = await call(bohdan.accessToken, { method: 'get', path: RESUME_VERSIONS_PATH });

    const { items } = resumeVersionListResponseSchema.parse(response.body);
    expect(items.map(({ id, number }) => [id, number])).toEqual([[version.id, 1]]);
  });

  it.each(MALFORMED_REQUESTS)(
    'answers $case with 422 at "$at" and changes nothing',
    async ({ route, at }) => {
      const owner = await signedUp();
      const { version } = await uploadResumeVersion(testApp.app, owner);
      await activate(owner, version.id);
      const application = await newApplication(owner);
      const stored = () =>
        Promise.all([
          testApp.prisma.resumeVersion.findMany({ select: { id: true, isArchived: true } }),
          testApp.prisma.application.findMany({ select: { resumeVersionId: true } }),
          testApp.prisma.userSettings.findMany({ select: { activeResumeVersionId: true } }),
          testApp.prisma.outboxEvent.count({ where: { eventType: 'resume.attached' } }),
        ]);

      const response = await call(owner.accessToken, route(application.id));

      expect([response.status, errorPathsOf(response.body)]).toEqual([422, [at]]);
      expect(await stored()).toEqual([
        [{ id: version.id, isArchived: false }],
        [{ resumeVersionId: version.id }],
        [{ activeResumeVersionId: version.id }],
        0,
      ]);
    },
  );

  it.each(ROUTES_WITHOUT_TOKEN)('answers $method $path without a token with 401', async (route) => {
    const response = await call(undefined, route);

    expect(response.status).toBe(401);
  });
});
