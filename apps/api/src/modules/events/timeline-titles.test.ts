import {
  TIMELINE_ITEM_TYPES,
  type TimelineActor,
  type TimelineItemType,
  type TimelineRecord,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { MOVE_EVENT_ID, NOTE_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import type { TimelineRows } from './timeline.repository.js';
import { timelineItemsOf } from './timeline-items.js';
import { recordTitle, type StageChange } from './timeline-titles.js';

type TitleCase = {
  type: TimelineItemType;
  rows: TimelineRows;
  title: string;
  actor: TimelineActor;
};

const NO_ROWS: TimelineRows = { stageEvents: [], timelineEvents: [], notes: [] };

const journal = (record: TimelineRecord): TimelineRows => ({
  ...NO_ROWS,
  timelineEvents: [{ id: MOVE_EVENT_ID, ...record, occurredAt: NOW }],
});

const stageChange = (change: StageChange): TimelineRows => ({
  ...NO_ROWS,
  stageEvents: [{ id: MOVE_EVENT_ID, ...change, reasonCode: null, comment: null, occurredAt: NOW }],
});

const TITLE_CASES: TitleCase[] = [
  {
    type: 'stage_changed',
    rows: stageChange({ fromStage: null, toStage: 'applied' }),
    title: 'відгук надіслано',
    actor: 'user',
  },
  {
    type: 'stage_changed',
    rows: stageChange({ fromStage: 'final', toStage: 'rejected' }),
    title: 'фінал → відмова',
    actor: 'user',
  },
  {
    type: 'stage_changed',
    rows: stageChange({ fromStage: 'ghosted', toStage: 'screening' }),
    title: 'ghosted → скринінг',
    actor: 'user',
  },
  {
    type: 'captured',
    rows: journal({ kind: 'captured', payload: { method: 'bookmarklet' } }),
    title: 'Карточку створено букмарклетом',
    actor: 'user',
  },
  {
    type: 'captured',
    rows: journal({ kind: 'captured', payload: { method: 'paste' } }),
    title: 'Карточку створено з тексту',
    actor: 'user',
  },
  {
    type: 'ai_parsed',
    rows: journal({ kind: 'ai_parsed', payload: { durationSec: 3 } }),
    title: 'AI розібрав опис за 3 секунди',
    actor: 'system',
  },
  {
    type: 'silence_started',
    rows: journal({ kind: 'silence_started', payload: { silenceDays: 14 } }),
    title: '14 днів тиші · індикатор увімкнено',
    actor: 'system',
  },
  {
    type: 'followup_generated',
    rows: journal({ kind: 'followup_generated', payload: {} }),
    title: 'Фоллоу-ап згенеровано',
    actor: 'system',
  },
  {
    type: 'followup_sent',
    rows: journal({ kind: 'followup_sent', payload: {} }),
    title: 'Фоллоу-ап надіслано',
    actor: 'user',
  },
  {
    type: 'interview_scheduled',
    rows: journal({
      kind: 'interview_scheduled',
      payload: { kind: 'screening_call', startsAt: '2026-11-03T14:00:00.000Z' },
    }),
    title: 'Скринінг заплановано',
    actor: 'user',
  },
  {
    type: 'interview_done',
    rows: journal({
      kind: 'interview_done',
      payload: { kind: 'final_interview', durationMin: 45 },
    }),
    title: 'Фінал пройдено · 45 хв',
    actor: 'user',
  },
  {
    type: 'note_added',
    rows: { ...NO_ROWS, notes: [{ id: NOTE_ID, body: 'Спитати про on-call', createdAt: NOW }] },
    title: 'Заметка',
    actor: 'user',
  },
  {
    type: 'resume_attached',
    rows: journal({ kind: 'resume_attached', payload: { resumeVersionId: RESUME_VERSION_ID } }),
    title: 'CV прикріплено',
    actor: 'user',
  },
];

describe('timeline item titles', () => {
  it.each(TITLE_CASES)('titles $type as $title by the $actor', ({ type, rows, title, actor }) => {
    expect(timelineItemsOf(rows)).toEqual([expect.objectContaining({ type, title, actor })]);
  });

  it('has a title case for every timeline item type', () => {
    expect(new Set(TITLE_CASES.map(({ type }) => type))).toEqual(new Set(TIMELINE_ITEM_TYPES));
  });

  it.each([
    { count: 1, seconds: '1 секунду', days: '1 день' },
    { count: 2, seconds: '2 секунди', days: '2 дні' },
    { count: 5, seconds: '5 секунд', days: '5 днів' },
    { count: 11, seconds: '11 секунд', days: '11 днів' },
    { count: 21, seconds: '21 секунду', days: '21 день' },
    { count: 22, seconds: '22 секунди', days: '22 дні' },
  ])('counts $count as $seconds and $days', ({ count, seconds, days }) => {
    expect([
      recordTitle({ kind: 'ai_parsed', payload: { durationSec: count } }),
      recordTitle({ kind: 'silence_started', payload: { silenceDays: count } }),
    ]).toEqual([`AI розібрав опис за ${seconds}`, `${days} тиші · індикатор увімкнено`]);
  });
});
