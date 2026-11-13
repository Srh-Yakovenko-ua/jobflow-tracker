import {
  AI_PAYLOAD_FIELDS,
  type Application,
  type Contact,
  followupInputSchema,
  matchInputSchema,
  type NoteInput,
  resumeParseInputSchema,
} from '@jobflow/shared';
import { buildFollowupInput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import {
  MATCH_PROFILE,
  PRIVATE_NOTE,
  RECRUITER_CHANNELS,
  RESUME_PROFILE,
  VACANCY_TEXT,
} from '../../test/ai.js';
import {
  RESUME_TEXT,
  SCAN_EXTRACTION,
  SCAN_PAGE_JPEG,
  TEXT_EXTRACTION,
} from '../../test/documents.js';
import { privatePayloadPaths } from './ai-payload-guard.js';
import { AI_PAYLOAD_BUILDERS, type VacancySource } from './ai-payloads.js';
import type { FollowupSource } from './followup-payload.js';

type ApplicationWithPrivateData = VacancySource &
  Pick<Application, 'company' | 'position'> & {
    notes: NoteInput[];
    contacts: Pick<Contact, 'name' | 'email' | 'phone' | 'telegram'>[];
  };

const APPLICATION: ApplicationWithPrivateData = {
  company: 'Acme',
  position: 'Senior React developer',
  rawText: VACANCY_TEXT,
  notes: [PRIVATE_NOTE],
  contacts: [{ name: 'Ірина', ...RECRUITER_CHANNELS }],
};

describe('AI_PAYLOAD_BUILDERS.resume_parse', () => {
  it('sends the text of a text extraction and no pages', () => {
    const payload = AI_PAYLOAD_BUILDERS.resume_parse(TEXT_EXTRACTION);

    expect(payload).toEqual({ text: RESUME_TEXT, pages: [] });
    expect(Object.keys(payload)).toEqual(AI_PAYLOAD_FIELDS.resume_parse);
  });

  it('sends the JPEG pages of a scan and an empty text', () => {
    expect(AI_PAYLOAD_BUILDERS.resume_parse(SCAN_EXTRACTION)).toEqual({
      text: '',
      pages: [SCAN_PAGE_JPEG],
    });
  });

  it('cuts a long text at 40000 characters without a broken surrogate pair and drops NUL characters', () => {
    const { text: sent } = AI_PAYLOAD_BUILDERS.resume_parse({
      ...TEXT_EXTRACTION,
      text: `React\u0000${'a'.repeat(39_994)}😀tail`,
    });

    expect(sent).toBe(`React${'a'.repeat(39_994)}�`);
    expect(resumeParseInputSchema.safeParse({ text: sent, pages: [] }).success).toBe(true);
  });
});

describe('AI_PAYLOAD_BUILDERS.match', () => {
  const SOURCE = { position: 'Senior React developer', stack: ['React'], rawText: VACANCY_TEXT };

  it('sends the vacancy fields and only the skills, years, levels and lead flag of the stored profile', () => {
    const payload = AI_PAYLOAD_BUILDERS.match({ ...SOURCE, profile: RESUME_PROFILE });

    expect(payload).toEqual({
      vacancy: { position: 'Senior React developer', stack: ['React'], text: VACANCY_TEXT },
      profile: MATCH_PROFILE,
    });
    expect(Object.keys(payload)).toEqual(AI_PAYLOAD_FIELDS.match);
    expect(JSON.stringify(payload.profile)).not.toMatch(/Acme|Frontend developer|positions/);
  });

  it.each([
    { rawText: null, case: 'no vacancy text' },
    { rawText: ' \n\t ', case: 'a blank vacancy text' },
  ])('sends an empty text for $case so position and stack still score', ({ rawText }) => {
    const payload = AI_PAYLOAD_BUILDERS.match({ ...SOURCE, rawText, profile: RESUME_PROFILE });

    expect(payload.vacancy.text).toBe('');
    expect(matchInputSchema.safeParse(payload).success).toBe(true);
  });

  it('cuts a long vacancy text at 20000 characters', () => {
    const rawText = `React ${'a'.repeat(30_000)}`;

    const payload = AI_PAYLOAD_BUILDERS.match({ ...SOURCE, rawText, profile: RESUME_PROFILE });

    expect(payload.vacancy.text).toHaveLength(20_000);
    expect(matchInputSchema.safeParse(payload).success).toBe(true);
  });
});

describe('AI_PAYLOAD_BUILDERS.followup', () => {
  const HINT = "згадай, що я дорозв'язав задачу";
  const SOURCE: FollowupSource = {
    application: {
      company: 'Acme',
      position: 'Senior React developer',
      currentStage: 'tech_interview',
      lastEventAt: new Date('2026-09-03T12:00:00.000Z'),
    },
    recruiterName: '  Оксана Петренко ',
    lastInterview: { kind: 'tech_interview', startsAt: new Date('2026-09-02T22:30:00.000Z') },
    senderName: ' Андрій ',
    timezone: 'Europe/Kyiv',
    request: { tone: 'warm', language: 'uk', hint: HINT },
    now: new Date('2026-09-10T11:00:00.000Z'),
  };

  it('sends the first word of the recruiter name, the whole days of silence and the interview day in the user timezone, and nothing private', () => {
    const payload = AI_PAYLOAD_BUILDERS.followup(SOURCE);

    expect(payload).toEqual(buildFollowupInput({ hint: HINT }));
    expect(Object.keys(payload).sort()).toEqual([...AI_PAYLOAD_FIELDS.followup].sort());
    expect(privatePayloadPaths(payload)).toEqual([]);
  });

  it('sends null for a missing recruiter, interview, sender name and hint', () => {
    const payload = AI_PAYLOAD_BUILDERS.followup({
      ...SOURCE,
      recruiterName: null,
      lastInterview: null,
      senderName: ' ',
      request: { tone: 'short', language: 'en' },
    });

    expect(payload).toMatchObject({
      recruiterFirstName: null,
      lastInterview: null,
      senderName: null,
      hint: null,
    });
    expect(followupInputSchema.safeParse(payload).success).toBe(true);
  });
});

describe('AI_PAYLOAD_BUILDERS.vacancy_parse', () => {
  it('sends only the vacancy text of an application that carries notes and recruiter contacts', () => {
    const payload = AI_PAYLOAD_BUILDERS.vacancy_parse(APPLICATION);

    expect(payload).toEqual({ text: VACANCY_TEXT });
    expect(Object.keys(payload)).toEqual(AI_PAYLOAD_FIELDS.vacancy_parse);
  });
});
