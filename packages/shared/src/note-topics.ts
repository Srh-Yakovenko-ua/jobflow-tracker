import { z } from 'zod';

import type { RejectionReasonCode } from './rejection-reasons.js';

export const NOTE_TOPICS = [
  'algorithms',
  'dp',
  'system_design',
  'english',
  'take_home',
  'react_internals',
  'sql',
  'behavioural',
] as const;

export const noteTopicSchema = z.enum(NOTE_TOPICS);

export type NoteTopic = z.infer<typeof noteTopicSchema>;

export const NOTE_TOPIC_LABELS: Record<NoteTopic, { labelUk: string }> = {
  algorithms: { labelUk: 'Алгоритми' },
  dp: { labelUk: 'Динамічне програмування' },
  system_design: { labelUk: 'System design' },
  english: { labelUk: 'Англійська' },
  take_home: { labelUk: 'Тестове завдання' },
  react_internals: { labelUk: 'React internals' },
  sql: { labelUk: 'SQL' },
  behavioural: { labelUk: 'Поведінкові питання' },
};

export const NOTE_TOPIC_REASONS: Record<NoteTopic, RejectionReasonCode> = {
  algorithms: 'skills_gap',
  dp: 'skills_gap',
  system_design: 'skills_gap',
  english: 'english_level',
  take_home: 'skills_gap',
  react_internals: 'skills_gap',
  sql: 'skills_gap',
  behavioural: 'skills_gap',
};
