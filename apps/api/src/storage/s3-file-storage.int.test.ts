import { randomUUID } from 'node:crypto';

import { GetBucketLifecycleConfigurationCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { type AppConfig, configModule } from '../config/app-config.js';
import { PDF, PDF_BYTES, PDF_ETAG } from '../test/resumes.js';
import { outcomeWithin, startTcpProxy, type TcpProxy } from '../test/tcp-proxy.js';
import type { UploadUrlRequest } from './file-storage.js';
import { S3FileStorage, type S3Settings, s3SettingsOf } from './s3-file-storage.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SIGNED_AT = new Date('2026-11-07T10:00:00.000Z');

const SILENT_LIMIT_MS = DEPENDENCY_LIMITS.storageTimeoutMs + 1000;

const REFUSED_LIMIT_MS = DEPENDENCY_LIMITS.connectTimeoutMs + 500;

const STORAGE_DOWN = {
  body: { status: 503, type: 'not_ready', detail: 'File storage did not answer' },
};

type PutBody = { type: string; body: Uint8Array };

const newKey = (extension = 'pdf') => `users/${randomUUID()}/resumes/${randomUUID()}.${extension}`;

const STORAGE_CALLS = [
  { name: 'head', call: (storage: S3FileStorage) => storage.head(newKey()) },
  {
    name: 'copy',
    call: (storage: S3FileStorage) =>
      storage.copy({ from: newKey(), to: newKey(), ifMatch: PDF_ETAG }),
  },
];

const pdfUpload = (key: string, signedAt = new Date()): UploadUrlRequest => ({
  key,
  mime: PDF,
  sizeBytes: PDF_BYTES.length,
  signedAt,
});

let settings: S3Settings;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
  settings = s3SettingsOf(moduleRef.get<AppConfig>(ConfigService));
});

describe('S3FileStorage against MinIO', () => {
  let storage: S3FileStorage;

  beforeAll(() => {
    storage = new S3FileStorage(settings);
  });

  afterAll(() => {
    storage.onModuleDestroy();
  });

  const bucketUrl = (key = '') => new URL(`${settings.bucket}/${key}`, settings.endpoint);

  async function putThroughUrl(key: string, { type, body }: PutBody): Promise<number> {
    const { url } = await storage.createUploadUrl(pdfUpload(key));
    const response = await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body });
    return response.status;
  }

  const putPdf = (key: string) => putThroughUrl(key, { type: PDF, body: PDF_BYTES });

  it('signs a PUT valid 10 minutes with Content-Type and Content-Length in the signature', async () => {
    const { url, expiresAt } = await storage.createUploadUrl(pdfUpload(newKey(), SIGNED_AT));

    const { origin, searchParams: query } = new URL(url);
    expect([origin, query.get('X-Amz-Expires'), query.get('X-Amz-SignedHeaders')]).toEqual([
      'http://localhost:9000',
      '600',
      'content-length;content-type;host',
    ]);
    expect([query.get('X-Amz-Date'), expiresAt.toISOString()]).toEqual([
      '20261107T100000Z',
      '2026-11-07T10:10:00.000Z',
    ]);
  });

  it('signs for the public endpoint when one is set', async () => {
    const publicStorage = new S3FileStorage({
      ...settings,
      publicEndpoint: 'http://storage.example.test:9000',
    });

    const { url } = await publicStorage.createUploadUrl(pdfUpload(newKey(), SIGNED_AT));

    expect(new URL(url).origin).toBe('http://storage.example.test:9000');
  });

  it('stores the body of a presigned PUT with its type and size', async () => {
    const key = newKey();

    expect(await putPdf(key)).toBe(200);
    expect(await storage.head(key)).toEqual({
      sizeBytes: PDF_BYTES.length,
      mime: PDF,
      etag: PDF_ETAG,
    });
  });

  it('copies an object whose ETag still matches the one read', async () => {
    const [from, to] = [newKey(), newKey()];
    await putPdf(from);

    const copied = await storage.copy({ from, to, ifMatch: PDF_ETAG });

    expect([copied, await storage.readStart({ key: to, bytes: PDF_BYTES.length })]).toEqual([
      true,
      PDF_BYTES,
    ]);
  });

  it('refuses to copy an object written again since its ETag was read and writes nothing', async () => {
    const [from, to] = [newKey(), newKey()];
    await putPdf(from);
    await putThroughUrl(from, { type: PDF, body: new Uint8Array(PDF_BYTES.length) });

    expect(await storage.copy({ from, to, ifMatch: PDF_ETAG })).toBe(false);
    expect(await storage.head(to)).toBeNull();
  });

  it('answers false to a copy of a missing object', async () => {
    expect(await storage.copy({ from: newKey(), to: newKey(), ifMatch: PDF_ETAG })).toBe(false);
  });

  it('expires uploads under the pending prefix after one day', async () => {
    const client = new S3Client({ ...settings, forcePathStyle: true });
    const { Rules = [] } = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: settings.bucket }),
    );
    client.destroy();

    const pending = Rules.filter(({ Filter }) => Filter?.Prefix === 'pending/');
    expect(pending.map(({ Status, Expiration }) => [Status, Expiration?.Days])).toEqual([
      ['Enabled', 1],
    ]);
  });

  it.each([
    { case: 'a body of another length', type: PDF, body: new Uint8Array(PDF_BYTES.length + 1) },
    { case: 'another Content-Type', type: 'text/plain', body: PDF_BYTES },
  ])('refuses a presigned PUT with $case with 403 and stores nothing', async ({ type, body }) => {
    const key = newKey();

    expect(await putThroughUrl(key, { type, body })).toBe(403);
    expect(await storage.head(key)).toBeNull();
  });

  it('answers 403 to a direct URL of the object or the bucket without a signature', async () => {
    const key = newKey();
    await putPdf(key);

    const object = await fetch(bucketUrl(key));
    const bucket = await fetch(bucketUrl());

    expect([object.status, bucket.status]).toEqual([403, 403]);
  });

  it('serves a PDF inline through a download URL valid 5 minutes', async () => {
    const key = newKey();
    await putPdf(key);
    const signedAt = new Date();

    const { url, expiresAt } = await storage.createDownloadUrl({
      key,
      mime: PDF,
      filename: "Олена's CV.pdf",
      signedAt,
    });
    const response = await fetch(url);

    expect([
      new URL(url).searchParams.get('X-Amz-Expires'),
      expiresAt.getTime() - signedAt.getTime(),
    ]).toEqual(['300', 300_000]);
    expect([
      response.status,
      response.headers.get('content-type'),
      response.headers.get('content-disposition'),
      new Uint8Array(await response.arrayBuffer()),
    ]).toEqual([
      200,
      PDF,
      "inline; filename*=UTF-8''%D0%9E%D0%BB%D0%B5%D0%BD%D0%B0%27s%20CV.pdf",
      PDF_BYTES,
    ]);
  });

  it('serves a DOCX as an attachment', async () => {
    const { url } = await storage.createDownloadUrl({
      key: newKey('docx'),
      mime: DOCX,
      filename: 'cv.docx',
      signedAt: new Date(),
    });

    expect(new URL(url).searchParams.get('response-content-disposition')).toBe(
      "attachment; filename*=UTF-8''cv.docx",
    );
  });

  it('reads only the first bytes asked for while the ETag still matches', async () => {
    const key = newKey();
    await putPdf(key);

    const start = await storage.readStart({ key, bytes: 8, ifMatch: PDF_ETAG });

    expect(new TextDecoder().decode(start)).toBe('%PDF-1.7');
  });

  it('reads nothing from an object written again since its ETag was read', async () => {
    const key = newKey();
    await putPdf(key);
    await putThroughUrl(key, { type: PDF, body: new Uint8Array(PDF_BYTES.length) });

    expect(await storage.readStart({ key, bytes: 8, ifMatch: PDF_ETAG })).toEqual(new Uint8Array());
  });

  it('answers null for a missing object and deletes a stored one', async () => {
    const key = newKey();
    await putPdf(key);

    await storage.delete(key);

    expect([await storage.head(key), await storage.head(newKey())]).toEqual([null, null]);
  });
});

describe('S3FileStorage when MinIO does not answer', () => {
  let proxy: TcpProxy;
  let storage: S3FileStorage;

  beforeEach(async () => {
    proxy = await startTcpProxy(settings.endpoint);
    storage = new S3FileStorage({ ...settings, endpoint: proxy.url });
  });

  afterEach(() => {
    storage.onModuleDestroy();
  });

  it.each(STORAGE_CALLS)(
    'answers $name with 503 within the storage limit while the open connection stays silent',
    { timeout: SILENT_LIMIT_MS + 1000 },
    async ({ call }) => {
      proxy.silence();

      expect(await outcomeWithin(call(storage), SILENT_LIMIT_MS)).toMatchObject(STORAGE_DOWN);
      await proxy.close();
    },
  );

  it.each(STORAGE_CALLS)(
    'answers $name with 503 at once when the connection is refused',
    async ({ call }) => {
      await proxy.close();

      expect(await outcomeWithin(call(storage), REFUSED_LIMIT_MS)).toMatchObject(STORAGE_DOWN);
    },
  );
});
