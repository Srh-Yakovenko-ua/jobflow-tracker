import type { ErrorResponse } from '@jobflow/shared';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { SCAN_EXTRACTION, TEXT_EXTRACTION } from '../../test/documents.js';
import { exampleEnv } from '../../test/example-env.js';
import {
  type FetchReply,
  recordFetch,
  refusedConnection,
  stalled,
  timeOutAtOnce,
} from '../../test/fetch.js';
import { PDF, PDF_BYTES } from '../../test/resumes.js';
import { DocumentsClient } from './documents-client.js';

const DOCUMENTS_SERVICE_URL = 'http://documents.test:8002';

const EXTRACT = { bytes: PDF_BYTES, filename: 'cv.pdf', mime: PDF, requestId: 'req-doc-3' };

const documentsClient = new DocumentsClient(
  new ConfigService(validateEnv({ ...exampleEnv, DOCUMENTS_SERVICE_URL })),
);

const fileOf = (body: RequestInit['body']) =>
  body instanceof FormData ? body.get('file') : undefined;

const replyWith = (reply: FetchReply) => recordFetch({ replies: reply, decodeBody: fileOf });

const replyInTurn = (replies: FetchReply[]) =>
  replyWith((init) => (replies.shift() ?? stalled)(init));

const docError = (status: number, type: string): ErrorResponse => ({
  type,
  title: 'Refused',
  status,
  detail: 'The file gave no text',
  requestId: 'req-doc-3',
});

const documentsError = (status: number, type: string) => ({
  name: 'DocumentsError',
  status,
  type,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DocumentsClient.extract', () => {
  it('posts the file as the multipart field file to /documents/extract with the request id and answers the parsed extraction', async () => {
    const calls = replyWith(() => Response.json(TEXT_EXTRACTION));

    expect(await documentsClient.extract(EXTRACT)).toEqual(TEXT_EXTRACTION);

    expect(calls.map(({ url }) => url)).toEqual(['http://documents.test:8002/documents/extract']);
    expect(calls[0]?.headers.get('x-request-id')).toBe('req-doc-3');
    const file = calls[0]?.body;
    expect(file).toBeInstanceOf(File);
    expect(file instanceof File ? [file.name, file.type] : []).toEqual(['cv.pdf', PDF]);
    expect(file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null).toEqual(
      PDF_BYTES,
    );
  });

  it('answers the JPEG pages of a scan and sends no request id when there is none', async () => {
    const calls = replyWith(() => Response.json(SCAN_EXTRACTION));

    expect(await documentsClient.extract({ ...EXTRACT, requestId: undefined })).toEqual(
      SCAN_EXTRACTION,
    );
    expect(calls[0]?.headers.has('x-request-id')).toBe(false);
  });

  it.each([
    { status: 413, type: 'file_too_large' },
    { status: 415, type: 'unsupported_type' },
    { status: 422, type: 'encrypted_pdf' },
    { status: 422, type: 'unreadable_file' },
  ])('turns the DOC-04 $status $type of the service into a DocumentsError', async (refusal) => {
    replyWith(() => Response.json(docError(refusal.status, refusal.type), refusal));

    await expect(documentsClient.extract(EXTRACT)).rejects.toMatchObject(
      documentsError(refusal.status, refusal.type),
    );
  });

  it.each([
    {
      answer: 'a 200 whose body is no extraction',
      reply: () => Response.json({ kind: 'photo', text: 'x' }),
      error: documentsError(502, 'unexpected_response'),
    },
    {
      answer: 'a 200 whose body is no JSON',
      reply: () => new Response('<html>', { status: 200 }),
      error: documentsError(502, 'unexpected_response'),
    },
    {
      answer: 'a 500 without a DOC-04 body',
      reply: () => new Response('Internal error', { status: 500 }),
      error: documentsError(500, 'unexpected_response'),
    },
    {
      answer: 'a refused connection',
      reply: () => Promise.reject(refusedConnection),
      error: documentsError(503, 'not_ready'),
    },
  ])('turns $answer into a DocumentsError', async ({ reply, error }) => {
    replyWith(reply);

    await expect(documentsClient.extract(EXTRACT)).rejects.toMatchObject(error);
  });

  it('starts the 10 s limit of an extract queued behind another only once that one has answered', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    let answerFirst: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      answerFirst = resolve;
    });
    const calls = replyInTurn([() => held, () => Response.json(SCAN_EXTRACTION)]);

    const extractions = Promise.all([
      documentsClient.extract(EXTRACT),
      documentsClient.extract(EXTRACT),
    ]);
    await vi.waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(timeout).toHaveBeenCalledTimes(1);
    answerFirst(Response.json(TEXT_EXTRACTION));

    expect(await extractions).toEqual([TEXT_EXTRACTION, SCAN_EXTRACTION]);
    expect(timeout.mock.calls).toEqual([[10_000], [10_000]]);
  });

  it('answers an extract queued behind one whose connection was refused', async () => {
    replyInTurn([() => Promise.reject(refusedConnection), () => Response.json(TEXT_EXTRACTION)]);

    const [refused, answered] = await Promise.allSettled([
      documentsClient.extract(EXTRACT),
      documentsClient.extract(EXTRACT),
    ]);

    expect(refused).toMatchObject({
      status: 'rejected',
      reason: documentsError(503, 'not_ready'),
    });
    expect(answered).toEqual({ status: 'fulfilled', value: TEXT_EXTRACTION });
  });

  it('gives up on a document service that never answers at the 10 s limit with 504 documents_timeout', async () => {
    const timeout = timeOutAtOnce();
    replyWith(stalled);

    await expect(documentsClient.extract(EXTRACT)).rejects.toMatchObject(
      documentsError(504, 'documents_timeout'),
    );
    expect(timeout).toHaveBeenCalledWith(10_000);
  });
});
