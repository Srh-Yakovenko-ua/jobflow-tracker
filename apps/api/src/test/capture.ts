import {
  type CaptureBookmarkletInput,
  type CapturePasteInput,
  type CaptureTokenCreated,
  captureTokenCreatedSchema,
  type PossibleDuplicate,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type {
  AnnouncedCapture,
  ApplicationRow,
  DraftConfirm,
  DraftFill,
  FilledDraft,
  OpenDraft,
  OpenedDraft,
} from '../modules/applications/index.js';
import { VACANCY_TEXT } from './ai.js';
import type { TestApp } from './app.js';
import {
  type ApplicationRequest,
  type SignedInApplication,
  signedInWithSearch,
} from './applications.js';
import { callRoute } from './http.js';
import type { ByUser } from './recorded-events.js';
import { APPLICATION_ID, MISSING_ID, OLENA_ID } from './service-fixtures.js';
import { minutesBefore, NOW } from './time.js';

export const CAPTURE_PASTE_PATH = '/api/v1/capture/paste';

export const draftConfirmPath = (id: string) => `/api/v1/capture/drafts/${id}/confirm`;

export type DraftConfirmRequest = Pick<SignedInApplication, 'id'> & { accessToken?: string };

export const PASTED_URL = 'https://jobs.example.test/7';

export const PASTE: CapturePasteInput = { text: VACANCY_TEXT, url: PASTED_URL };

export const CAPTURE_BOOKMARKLET_PATH = '/api/v1/capture/bookmarklet';

export const CAPTURE_TOKENS_PATH = '/api/v1/capture/tokens';

export const JOB_BOARD_ORIGIN = 'https://djinni.co';

export const BOOKMARKLET = {
  url: 'https://djinni.co/jobs/700123-senior-react-developer/',
  title: 'Senior React developer at Acme',
  text: VACANCY_TEXT,
} satisfies CaptureBookmarkletInput;

export type BookmarkletRequest = {
  captureToken?: string | undefined;
  input: object;
  headers?: Record<string, string> | undefined;
};

export const captureAuthorization = (token: string) => ({ authorization: `Capture ${token}` });

export async function issueCaptureToken(
  app: NestExpressApplication,
  accessToken: string,
): Promise<CaptureTokenCreated> {
  const response = await callRoute(app, { method: 'post', path: CAPTURE_TOKENS_PATH, accessToken });
  return captureTokenCreatedSchema.parse(response.body);
}

export async function signedInWithCaptureToken({ app, prisma }: TestApp) {
  const searcher = await signedInWithSearch(prisma);
  const { id, token } = await issueCaptureToken(app, searcher.accessToken);
  return { ...searcher, captureTokenId: id, captureToken: token };
}

export function postBookmarklet(
  app: NestExpressApplication,
  { captureToken, input, headers }: BookmarkletRequest,
) {
  const authorization = captureToken === undefined ? {} : captureAuthorization(captureToken);
  return callRoute(app, {
    method: 'post',
    path: CAPTURE_BOOKMARKLET_PATH,
    body: input,
    headers: { ...headers, ...authorization },
  });
}

export async function bookmarkletStatus(
  app: NestExpressApplication,
  captureToken: string,
): Promise<number> {
  const response = await postBookmarklet(app, { captureToken, input: BOOKMARKLET });
  return response.status;
}

export const BLANK_DRAFT_COLUMNS = {
  company: 'компанію не розпізнано',
  position: 'Без назви',
  source: 'other',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  stack: [],
  location: null,
  workMode: null,
} satisfies Partial<ApplicationRow>;

export const OPENED_DRAFT: OpenedDraft = {
  applicationId: APPLICATION_ID,
  createdAt: minutesBefore(2),
};

export const POSSIBLE_DUPLICATE: PossibleDuplicate = {
  id: MISSING_ID,
  company: 'Acme',
  position: 'React developer',
  stage: 'screening',
  appliedAt: '2026-10-01T09:00:00.000Z',
};

export function postPaste(
  app: NestExpressApplication,
  { accessToken, input }: Partial<ApplicationRequest<object>>,
) {
  return callRoute(app, { method: 'post', path: CAPTURE_PASTE_PATH, body: input, accessToken });
}

export function postConfirm(app: NestExpressApplication, { accessToken, id }: DraftConfirmRequest) {
  return callRoute(app, { method: 'post', path: draftConfirmPath(id), accessToken });
}

export class FakeApplicationDrafts {
  readonly steps: string[] = [];

  readonly opened: ByUser<OpenDraft>[] = [];

  readonly announced: ByUser<AnnouncedCapture>[] = [];

  readonly fills: ByUser<DraftFill>[] = [];

  readonly confirmed: ByUser<DraftConfirm>[] = [];

  refusal: Error | undefined;

  filled: FilledDraft | null = { createdAt: OPENED_DRAFT.createdAt, filledAt: NOW };

  possibleDuplicates(): Promise<PossibleDuplicate[]> {
    this.steps.push('duplicates');
    return Promise.resolve([POSSIBLE_DUPLICATE]);
  }

  open(userId: string, draft: OpenDraft): Promise<OpenedDraft> {
    this.steps.push('open');
    if (this.refusal !== undefined) {
      return Promise.reject(this.refusal);
    }
    this.opened.push({ userId, ...draft });
    return Promise.resolve(OPENED_DRAFT);
  }

  announce(userId: string, capture: AnnouncedCapture): Promise<void> {
    this.announced.push({ userId, ...capture });
    return Promise.resolve();
  }

  findRawText(userId: string, applicationId: string): Promise<string | null> {
    const owned = userId === OLENA_ID && applicationId === APPLICATION_ID;
    return Promise.resolve(owned ? VACANCY_TEXT : null);
  }

  fill(userId: string, fill: DraftFill): Promise<FilledDraft | null> {
    this.fills.push({ userId, ...fill });
    return Promise.resolve(this.filled);
  }

  confirm(userId: string, draft: DraftConfirm): Promise<Date> {
    if (this.refusal !== undefined) {
      return Promise.reject(this.refusal);
    }
    this.confirmed.push({ userId, ...draft });
    return Promise.resolve(NOW);
  }
}
