import { AI_PAYLOAD_FIELDS, type Application, type Contact, type NoteInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { PRIVATE_NOTE, RECRUITER_CHANNELS, VACANCY_TEXT } from '../../test/ai.js';
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

describe('AI_PAYLOAD_BUILDERS.vacancy_parse', () => {
  it('sends only the vacancy text of an application that carries notes and recruiter contacts', () => {
    const payload = AI_PAYLOAD_BUILDERS.vacancy_parse(APPLICATION);

    expect(payload).toEqual({ text: VACANCY_TEXT });
    expect(Object.keys(payload)).toEqual(AI_PAYLOAD_FIELDS.vacancy_parse);
  });
});
