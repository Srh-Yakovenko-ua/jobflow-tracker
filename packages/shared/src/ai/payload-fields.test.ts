import { describe, expect, it } from 'vitest';

import { AI_KINDS } from './kinds.js';
import { AI_PAYLOAD_FIELDS } from './payload-fields.js';

describe('AI_PAYLOAD_FIELDS', () => {
  it('allows only the vacancy text into a vacancy parse payload, the resume text and scan pages into a resume parse payload, and the vacancy and the profile into a match payload', () => {
    expect(AI_PAYLOAD_FIELDS).toEqual({
      vacancy_parse: ['text'],
      resume_parse: ['text', 'pages'],
      match: ['vacancy', 'profile'],
    });
  });

  it('lists the allowed fields for every AI kind', () => {
    expect(Object.keys(AI_PAYLOAD_FIELDS)).toEqual([...AI_KINDS]);
  });
});
