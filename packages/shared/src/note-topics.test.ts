import { describe, expect, it } from 'vitest';

import {
  NOTE_TOPIC_LABELS,
  NOTE_TOPIC_REASONS,
  NOTE_TOPICS,
  noteTopicSchema,
} from './note-topics.js';

describe('NOTE_TOPICS', () => {
  it('keeps the AN-15 note topics in their order', () => {
    expect(NOTE_TOPICS).toEqual([
      'algorithms',
      'dp',
      'system_design',
      'english',
      'take_home',
      'react_internals',
      'sql',
      'behavioural',
    ]);
  });

  it('gives every topic its Ukrainian label', () => {
    expect(NOTE_TOPICS.map((topic) => NOTE_TOPIC_LABELS[topic].labelUk)).toEqual([
      'Алгоритми',
      'Динамічне програмування',
      'System design',
      'Англійська',
      'Тестове завдання',
      'React internals',
      'SQL',
      'Поведінкові питання',
    ]);
    expect(Object.keys(NOTE_TOPIC_LABELS)).toEqual([...NOTE_TOPICS]);
  });

  it('every note topic names the reason it explains', () => {
    expect(NOTE_TOPIC_REASONS).toEqual({
      algorithms: 'skills_gap',
      dp: 'skills_gap',
      system_design: 'skills_gap',
      english: 'english_level',
      take_home: 'skills_gap',
      react_internals: 'skills_gap',
      sql: 'skills_gap',
      behavioural: 'skills_gap',
    });
  });

  it('refuses a topic outside the list', () => {
    expect(noteTopicSchema.safeParse('salary').success).toBe(false);
  });
});
