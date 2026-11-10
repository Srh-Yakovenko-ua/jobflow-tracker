import { describe, expect, it } from 'vitest';

import { buildJobUpdate } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  LIVE_EVENTS,
  LIVE_LIMITS,
  liveEventSchema,
  liveStreamQuerySchema,
  liveTicketSchema,
} from './live.js';

const id = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2d';
const applicationId = '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2c';
const jobUpdate = buildJobUpdate({ status: 'done', step: 3, applicationId });
const applicationUpdate = { applicationId, fields: ['company', 'position'] };
const notification = { notificationId: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2e' };

describe('live contract constants', () => {
  it('names the three events the stream pushes', () => {
    expect(LIVE_EVENTS).toEqual({
      jobUpdated: 'job.updated',
      applicationUpdated: 'application.updated',
      notificationCreated: 'notification.created',
    });
  });

  it('keeps a ticket for 30 s, beats every 25 s, polls every 2 s and caps a stream at 15 minutes', () => {
    expect(LIVE_LIMITS).toEqual({
      ticketTtlSeconds: 30,
      heartbeatSeconds: 25,
      pollFallbackMs: 2000,
      streamMaxSeconds: 900,
    });
  });
});

describe('liveEventSchema', () => {
  it.each([
    { type: 'job.updated', data: jobUpdate },
    { type: 'application.updated', data: applicationUpdate },
    { type: 'notification.created', data: notification },
  ])('accepts $type with its id and payload unchanged', (event) => {
    expect(liveEventSchema.parse({ id, ...event })).toEqual({ id, ...event });
  });

  it.each([
    { label: 'an event type the stream does not push', type: 'application.created' },
    { label: 'a missing event type', type: undefined },
  ])('refuses $label at type', ({ type }) => {
    expect(issuePathsOf(liveEventSchema.safeParse({ id, type, data: applicationUpdate }))).toEqual([
      'type',
    ]);
  });

  it.each([
    {
      type: 'job.updated',
      payload: 'notification.created',
      data: notification,
      paths: [
        'data.id',
        'data.kind',
        'data.status',
        'data.step',
        'data.errorType',
        'data.applicationId',
      ],
    },
    {
      type: 'application.updated',
      payload: 'job.updated',
      data: jobUpdate,
      paths: ['data.fields'],
    },
    {
      type: 'notification.created',
      payload: 'application.updated',
      data: applicationUpdate,
      paths: ['data.notificationId'],
    },
  ])('refuses $type carrying the payload of $payload', ({ type, data, paths }) => {
    expect(issuePathsOf(liveEventSchema.safeParse({ id, type, data }))).toEqual(paths);
  });

  it.each([
    { label: 'a missing id', patch: { id: undefined } },
    { label: 'an id that is not a uuid', patch: { id: '1' } },
  ])('refuses $label at id', ({ patch }) => {
    const event = { type: 'notification.created', data: notification, ...patch };

    expect(issuePathsOf(liveEventSchema.safeParse(event))).toEqual(['id']);
  });
});

describe('liveTicketSchema', () => {
  const issued = {
    ticket: 'Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4',
    expiresInSeconds: 30,
  };

  it('accepts the ticket with its lifetime in seconds', () => {
    expect(liveTicketSchema.parse(issued)).toEqual(issued);
  });

  it.each([
    { label: 'an empty ticket', patch: { ticket: '' }, path: 'ticket' },
    { label: 'a fractional lifetime', patch: { expiresInSeconds: 0.5 }, path: 'expiresInSeconds' },
  ])('refuses $label at $path', ({ patch, path }) => {
    expect(issuePathsOf(liveTicketSchema.safeParse({ ...issued, ...patch }))).toEqual([path]);
  });
});

describe('liveStreamQuerySchema', () => {
  it('reads a missing ticket as an empty one', () => {
    expect(liveStreamQuerySchema.parse({})).toEqual({ ticket: '' });
  });

  it('accepts a ticket of exactly 128 characters', () => {
    expect(liveStreamQuerySchema.parse({ ticket: 'a'.repeat(128) })).toEqual({
      ticket: 'a'.repeat(128),
    });
  });

  it('refuses a ticket of 129 characters at ticket', () => {
    expect(issuePathsOf(liveStreamQuerySchema.safeParse({ ticket: 'a'.repeat(129) }))).toEqual([
      'ticket',
    ]);
  });
});
