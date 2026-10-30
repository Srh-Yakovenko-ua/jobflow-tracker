import {
  type ApplicationResponse,
  type ApplicationTimelineResponse,
  applicationTimelineResponseSchema,
  type RejectionReasonCode,
  type Stage,
  type TimelineItem,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf } from './board-fixtures';

export type TimelineItemSeed = Omit<TimelineItem, 'id' | 'actor'> & {
  serial: number;
  actor?: TimelineItem['actor'];
};

export type StageMoveSeed = {
  fromStage: Stage | null;
  toStage: Stage;
  daysInPreviousStage: number | null;
  reasonCode?: RejectionReasonCode;
  comment?: string;
};

export type TimelineRouteOptions = {
  timeline?: ApplicationTimelineResponse;
  reply?: HttpResponseResolver;
};

export function timelineItemOf({
  serial,
  actor = 'user',
  ...item
}: TimelineItemSeed): TimelineItem {
  return { id: fixtureIdOf(serial), actor, ...item };
}

export function stageMoveOf({ reasonCode, comment, ...move }: StageMoveSeed): TimelineItem['meta'] {
  return { ...move, reasonCode: reasonCode ?? null, comment: comment ?? null };
}

export const EMPTY_TIMELINE: ApplicationTimelineResponse = { items: [] };

export const LONG_COMMENT = `https://jobs.example.com/${'x'.repeat(975)}`;

export const DESIGN_NOTE =
  'Друга задача — динамічне програмування, здався на 20 хв. Треба повторити DP і графи. Команда норм, тимлід говорив по суті, стек без легасі.';

export const DESIGN_TIMELINE_APPLICATION: ApplicationResponse = {
  ...ACME_APPLICATION,
  appliedAt: '2026-08-13T09:00:00Z',
  lastEventAt: '2026-09-03T10:00:00Z',
  daysSinceLastEvent: 4,
  createdAt: '2026-08-12T10:00:00Z',
};

export const DESIGN_TIMELINE = applicationTimelineResponseSchema.parse({
  items: [
    timelineItemOf({
      serial: 309,
      type: 'note_added',
      occurredAt: '2026-09-03T12:40:00Z',
      title: 'Заметка',
      meta: { body: DESIGN_NOTE },
    }),
    timelineItemOf({
      serial: 308,
      type: 'interview_done',
      occurredAt: '2026-09-03T10:00:00Z',
      title: "Техінтерв'ю пройдено · 90 хв",
      meta: { kind: 'tech_interview', durationMin: 90 },
    }),
    timelineItemOf({
      serial: 307,
      type: 'stage_changed',
      occurredAt: '2026-08-28T09:00:00Z',
      title: "скринінг → техінтерв'ю",
      meta: stageMoveOf({
        fromStage: 'screening',
        toStage: 'tech_interview',
        daysInPreviousStage: 7,
      }),
    }),
    timelineItemOf({
      serial: 306,
      type: 'followup_sent',
      occurredAt: '2026-08-27T08:00:00Z',
      title: 'Фоллоу-ап надіслано',
      meta: {},
    }),
    timelineItemOf({
      serial: 305,
      type: 'stage_changed',
      occurredAt: '2026-08-21T09:00:00Z',
      title: 'відгук → скринінг',
      meta: stageMoveOf({ fromStage: 'applied', toStage: 'screening', daysInPreviousStage: 8 }),
    }),
    timelineItemOf({
      serial: 304,
      type: 'silence_started',
      occurredAt: '2026-08-20T09:00:00Z',
      title: '7 днів тиші · індикатор увімкнено',
      meta: { silenceDays: 7 },
      actor: 'system',
    }),
    timelineItemOf({
      serial: 303,
      type: 'stage_changed',
      occurredAt: '2026-08-13T09:00:00Z',
      title: 'відгук надіслано',
      meta: stageMoveOf({ fromStage: null, toStage: 'applied', daysInPreviousStage: null }),
    }),
    timelineItemOf({
      serial: 302,
      type: 'ai_parsed',
      occurredAt: '2026-08-12T10:00:06Z',
      title: 'AI розібрав опис за 6 секунд',
      meta: { durationSec: 6 },
      actor: 'system',
    }),
    timelineItemOf({
      serial: 301,
      type: 'captured',
      occurredAt: '2026-08-12T10:00:00Z',
      title: 'Карточку створено букмарклетом',
      meta: { method: 'bookmarklet' },
    }),
  ],
});

export function timelineRoute({
  timeline = DESIGN_TIMELINE,
  reply = () => HttpResponse.json(timeline),
}: TimelineRouteOptions = {}) {
  return http.get(apiUrl('/applications/:id/timeline'), reply);
}
