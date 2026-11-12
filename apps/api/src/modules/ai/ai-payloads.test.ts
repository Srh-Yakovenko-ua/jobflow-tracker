import {
  AI_PAYLOAD_FIELDS,
  type Application,
  type Contact,
  type NoteInput,
  resumeParseInputSchema,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { PRIVATE_NOTE, RECRUITER_CHANNELS, VACANCY_TEXT } from '../../test/ai.js';
import {
  RESUME_TEXT,
  SCAN_EXTRACTION,
  SCAN_PAGE_JPEG,
  TEXT_EXTRACTION,
} from '../../test/documents.js';
import { AI_PAYLOAD_BUILDERS, type VacancySource } from './ai-payloads.js';

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

describe('AI_PAYLOAD_BUILDERS.vacancy_parse', () => {
  it('sends only the vacancy text of an application that carries notes and recruiter contacts', () => {
    const payload = AI_PAYLOAD_BUILDERS.vacancy_parse(APPLICATION);

    expect(payload).toEqual({ text: VACANCY_TEXT });
    expect(Object.keys(payload)).toEqual(AI_PAYLOAD_FIELDS.vacancy_parse);
  });
});
