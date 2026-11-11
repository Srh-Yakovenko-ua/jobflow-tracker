import type {
  CapturePasteResponse,
  CreateApplicationResponse,
  PossibleDuplicate,
} from '@jobflow/shared';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { expect } from 'vitest';

import { apiUrl, idempotencyKeyOf, type SentCreate } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import {
  applicationResponseOf,
  fixtureIdOf,
  heldReply,
  type MoveRouteOptions,
} from './board-fixtures';
import { doubleClickWhileHeld, type HeldDoubleClick } from './double-click-while-held';

export type SentAdd = Omit<SentCreate<unknown>, 'id'>;

export type AddRoutesOptions = {
  paste?: MoveRouteOptions;
  manual?: MoveRouteOptions;
  duplicates?: readonly PossibleDuplicate[];
};

type AddRouteSpec = MoveRouteOptions & {
  path: string;
  sent: SentAdd[];
  replyOf: (serial: number) => Response;
};

const ADDED_SERIAL_FROM = 950;

const JOB_SERIAL_OFFSET = 20;

const TEXT_LABEL = 'Текст вакансії';

const LINK_LABEL = 'Посилання на вакансію';

function pastedIdsOf(serial: number) {
  return { applicationId: fixtureIdOf(serial), jobId: fixtureIdOf(serial + JOB_SERIAL_OFFSET) };
}

export const FIRST_PASTE = pastedIdsOf(ADDED_SERIAL_FROM + 1);

export const NO_ACTIVE_SEARCH = {
  status: 409,
  type: 'conflict',
  detail: 'No active search',
} as const;

export const STILL_RUNNING = {
  status: 409,
  type: 'idempotency_conflict',
  detail: 'A request with this Idempotency-Key is still in progress',
} as const;

export const TWO_MINUTES = { 'Retry-After': '120' } as const;

export const POSITION_ERROR = 'Вкажи позицію одним коротким рядком';

export const TIMEOUT_REASON =
  'AI не встиг відповісти. Це збій на нашому боці, з текстом усе гаразд.';

export const ACME_DUPLICATE: PossibleDuplicate = {
  id: ACME_APPLICATION.id,
  company: ACME_APPLICATION.company,
  position: ACME_APPLICATION.position,
  appliedAt: '2026-10-12T09:00:00Z',
  stage: 'tech_interview',
};

export function textField() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: TEXT_LABEL });
}

export function linkField() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: LINK_LABEL });
}

export type HeldAdd = Pick<HeldDoubleClick, 'user' | 'held' | 'sent'> & {
  submit: string;
  another: string;
};

export async function addsOnceOnDoubleClick({ submit, another, ...held }: HeldAdd) {
  await doubleClickWhileHeld({ ...held, click: submit, disabledWhileHeld: [submit] });
  await screen.findByRole('button', { name: another });
  expect(held.sent).toHaveLength(1);
}

function addRoute({ path, sent, replyOf, ...control }: AddRouteSpec) {
  return http.post(apiUrl(path), async (info) => {
    const body: unknown = await info.request.json();
    sent.push({ body, idempotencyKey: idempotencyKeyOf(info.request.headers) });
    const serial = ADDED_SERIAL_FROM + sent.length;
    return heldReply({ ...control, info, fallback: () => replyOf(serial) });
  });
}

export function addRoutes({ paste = {}, manual = {}, duplicates = [] }: AddRoutesOptions = {}) {
  const pasted: SentAdd[] = [];
  const created: SentAdd[] = [];
  const possibleDuplicates = [...duplicates];
  const handlers = [
    addRoute({
      ...paste,
      path: '/capture/paste',
      sent: pasted,
      replyOf: (serial) =>
        HttpResponse.json<CapturePasteResponse>(
          { ...pastedIdsOf(serial), possibleDuplicates },
          { status: 202 },
        ),
    }),
    addRoute({
      ...manual,
      path: '/applications',
      sent: created,
      replyOf: (serial) =>
        HttpResponse.json<CreateApplicationResponse>(
          { ...applicationResponseOf({ id: fixtureIdOf(serial) }), possibleDuplicates },
          { status: 201 },
        ),
    }),
  ];
  return { handlers, sent: { pasted, created } };
}
