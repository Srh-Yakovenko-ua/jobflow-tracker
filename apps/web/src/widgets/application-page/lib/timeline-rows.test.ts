import type { Note, TimelineItem } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import { NOTE_ID, noteOf } from '@/test/note-fixtures';
import {
  DESIGN_NOTE,
  DESIGN_TIMELINE,
  DESIGN_TIMELINE_APPLICATION,
  noteAddedOf,
  stageMoveOf,
  timelineItemOf,
} from '@/test/timeline-fixtures';

import { type TimelineRow, timelineRowsOf } from './timeline-rows';

const AT = '2026-09-01T10:00:00Z';

const RING = { kind: 'ring' } as const;

function looksOf(items: readonly TimelineItem[]) {
  const rows = timelineRowsOf({ items, application: DESIGN_TIMELINE_APPLICATION });
  return rows.map(({ title, meta, marker, tone }: TimelineRow) => ({ title, meta, marker, tone }));
}

function itemOf(fields: Pick<TimelineItem, 'type' | 'meta'> & Partial<TimelineItem>) {
  return timelineItemOf({ serial: 900, occurredAt: AT, title: 'подія', ...fields });
}

function noteMetaOf(listed: Pick<Note, 'id' | 'body'>) {
  const draft = noteAddedOf({ id: NOTE_ID, body: 'Друга з', createdAt: AT });
  const move = itemOf({
    type: 'stage_changed',
    meta: stageMoveOf({ fromStage: 'applied', toStage: 'screening', daysInPreviousStage: 2 }),
  });
  const notes = [noteOf({ applicationId: DESIGN_TIMELINE_APPLICATION.id, ...listed })];
  const rows = timelineRowsOf({
    items: [draft, move],
    application: DESIGN_TIMELINE_APPLICATION,
    notes,
  });
  return rows.map(({ meta, metaFormat }) => ({ meta, metaFormat }));
}

describe('timelineRowsOf', () => {
  it('the design fixture reads newest first with the AI parse time folded into the capture row', () => {
    expect(looksOf(DESIGN_TIMELINE.items)).toEqual([
      { title: 'Нотатка', meta: DESIGN_NOTE, marker: RING, tone: 'strong' },
      {
        title: "Техінтерв'ю пройдено · 90 хв",
        meta: null,
        marker: { kind: 'stage', stage: 'tech_interview' },
        tone: 'strong',
      },
      {
        title: "скринінг → техінтерв'ю",
        meta: 'Перенесено вручну. 7 днів на етапі скринінгу.',
        marker: { kind: 'stage', stage: 'screening' },
        tone: 'strong',
      },
      { title: 'Фоллоу-ап надіслано', meta: null, marker: RING, tone: 'strong' },
      {
        title: 'відгук → скринінг',
        meta: 'Перенесено вручну. 8 днів на етапі відгуку.',
        marker: { kind: 'stage', stage: 'applied' },
        tone: 'strong',
      },
      {
        title: '7 днів тиші · індикатор увімкнено',
        meta: 'Автоматична подія. Картка приглушилась на дошці.',
        marker: { kind: 'silence' },
        tone: 'muted',
      },
      {
        title: 'відгук надіслано',
        meta: 'Через Djinni.',
        marker: { kind: 'stage', stage: 'applied' },
        tone: 'strong',
      },
      {
        title: 'Картку створено букмарклетом',
        meta: 'AI розібрав опис за 6 секунд',
        marker: RING,
        tone: 'medium',
      },
    ]);
  });

  it('each row keeps the id and the time of its item', () => {
    const rows = timelineRowsOf({
      items: DESIGN_TIMELINE.items,
      application: DESIGN_TIMELINE_APPLICATION,
    });

    expect(rows[0]).toMatchObject({
      id: DESIGN_TIMELINE.items[0]?.id,
      at: new Date('2026-09-03T12:40:00Z'),
    });
  });

  it('an AI parse with no capture row stays its own muted row', () => {
    const parsed = itemOf({ type: 'ai_parsed', meta: { durationSec: 4 }, actor: 'system' });

    expect(looksOf([parsed])).toEqual([
      { title: 'подія', meta: null, marker: RING, tone: 'muted' },
    ]);
  });

  it.for([
    { type: 'draft_confirmed', meta: {}, title: 'Поля перевірено вручну' },
    { type: 'match_scored', meta: { score: 59 }, title: 'Обчислено Match Score: 59' },
  ] as const)(
    'a $type row with no capture row reads as a muted ringed row with the title the API gave it',
    ({ type, meta, title }) => {
      expect(looksOf([itemOf({ type, meta, title })])).toEqual([
        { title, meta: null, marker: RING, tone: 'muted' },
      ]);
    },
  );

  it('a confirmed draft folds into the capture row after the AI parse time and loses its own row', () => {
    const confirmed = itemOf({ type: 'draft_confirmed', meta: {} });

    expect(looksOf([confirmed, ...DESIGN_TIMELINE.items]).at(-1)).toEqual({
      title: 'Картку створено букмарклетом',
      meta: 'AI розібрав опис за 6 секунд, поля перевірено вручну',
      marker: RING,
      tone: 'medium',
    });
    expect(looksOf([confirmed, ...DESIGN_TIMELINE.items])).toHaveLength(8);
  });

  it('a draft confirmed with no parse row leaves only the capture row, saying the fields were checked', () => {
    const confirmed = itemOf({ type: 'draft_confirmed', meta: {} });
    const captured = itemOf({
      type: 'captured',
      meta: { method: 'paste' },
      title: 'Картку створено',
    });

    expect(looksOf([confirmed, captured])).toEqual([
      { title: 'Картку створено', meta: 'Поля перевірено вручну', marker: RING, tone: 'medium' },
    ]);
  });

  it('a rejection reads the days in the stage, the reason and the comment, with the clay ring', () => {
    const rejection = itemOf({
      type: 'stage_changed',
      meta: stageMoveOf({
        fromStage: 'tech_interview',
        toStage: 'rejected',
        daysInPreviousStage: 5,
        reasonCode: 'skills_gap',
        comment: 'Не догнав DP.',
      }),
    });

    expect(looksOf([rejection])).toEqual([
      {
        title: 'подія',
        meta: "Перенесено вручну. 5 днів на етапі техінтерв'ю. Причина: не вистачає скілів. Не догнав DP.",
        marker: { kind: 'stage', stage: 'rejected' },
        tone: 'strong',
      },
    ]);
  });

  it.for([
    { kind: 'screening_call', marker: { kind: 'stage', stage: 'screening' } },
    { kind: 'offer_call', marker: { kind: 'stage', stage: 'offer' } },
    { kind: 'other', marker: RING },
  ])('an interview of kind $kind draws its stage marker', ({ kind, marker }) => {
    const done = itemOf({ type: 'interview_done', meta: { kind, durationMin: 45 } });

    expect(looksOf([done])[0]?.marker).toEqual(marker);
  });

  it('meta of an unexpected shape falls back to what can be read', () => {
    const odd = itemOf({
      type: 'stage_changed',
      meta: { fromStage: 'final', toStage: 'nonsense', reasonCode: 'nonsense', comment: 42 },
    });
    const bodiless = itemOf({ type: 'note_added', meta: { body: 7 } });

    expect(looksOf([odd, bodiless])).toEqual([
      { title: 'подія', meta: 'Перенесено вручну.', marker: RING, tone: 'strong' },
      { title: 'подія', meta: null, marker: RING, tone: 'strong' },
    ]);
  });

  it('a note row takes the body from the notes list by id', () => {
    expect(noteMetaOf({ id: NOTE_ID, body: 'Друга задача' })).toEqual([
      { meta: 'Друга задача', metaFormat: 'note' },
      { meta: 'Перенесено вручну. 2 дні на етапі відгуку.', metaFormat: 'text' },
    ]);
  });

  it('the fallback to meta.body when the note is not listed', () => {
    expect(noteMetaOf({ id: fixtureIdOf(902), body: 'Інша нотатка' })).toEqual([
      { meta: 'Друга з', metaFormat: 'note' },
      { meta: 'Перенесено вручну. 2 дні на етапі відгуку.', metaFormat: 'text' },
    ]);
  });
});
