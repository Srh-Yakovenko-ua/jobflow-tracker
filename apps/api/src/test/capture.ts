import type { CapturePasteInput, PossibleDuplicate } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type {
  AnnouncedCapture,
  DraftFill,
  FilledDraft,
  OpenDraft,
  OpenedDraft,
} from '../modules/applications/index.js';
import { VACANCY_TEXT } from './ai.js';
import type { ApplicationRequest } from './applications.js';
import { callRoute } from './http.js';
import type { ByUser } from './recorded-events.js';
import { APPLICATION_ID, MISSING_ID, OLENA_ID } from './service-fixtures.js';
import { minutesBefore, NOW } from './time.js';

export const CAPTURE_PASTE_PATH = '/api/v1/capture/paste';

export const PASTED_URL = 'https://jobs.example.test/7';

export const PASTE: CapturePasteInput = { text: VACANCY_TEXT, url: PASTED_URL };

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

export class FakeApplicationDrafts {
  readonly steps: string[] = [];

  readonly opened: ByUser<OpenDraft>[] = [];

  readonly announced: ByUser<AnnouncedCapture>[] = [];

  readonly fills: ByUser<DraftFill>[] = [];

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
}
