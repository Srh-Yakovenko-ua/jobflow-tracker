'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { z } from 'zod';

import { useUserStorageKey } from '@/entities/user';
import { useStoredJson } from '@/shared/lib/use-stored-json';

import type { InterviewPrepResult } from '../lib/interview-prep-view';

export type TopicChecklistInput = Readonly<{
  applicationId: ApplicationResponse['id'];
  generatedAt: InterviewPrepResult['generatedAt'];
}>;

export type TopicChecklist = Readonly<{
  ready: boolean;
  isChecked: (topic: number) => boolean;
  toggle: (topic: number) => void;
}>;

const checklistsSchema = z.record(
  z.string(),
  z.object({ generatedAt: z.string(), checked: z.array(z.number().int().nonnegative()) }),
);

export function useTopicChecklist({
  applicationId,
  generatedAt,
}: TopicChecklistInput): TopicChecklist {
  const key = useUserStorageKey('interview-prep');
  const stored = useStoredJson({ key, schema: checklistsSchema, fallback: {} });
  const entry = stored.value[applicationId];
  const checked = entry?.generatedAt === generatedAt ? entry.checked : [];
  return {
    ready: key !== undefined,
    isChecked: (topic) => checked.includes(topic),
    toggle: (topic) => {
      const next = checked.includes(topic)
        ? checked.filter((other) => other !== topic)
        : [...checked, topic].sort((left, right) => left - right);
      stored.store({ ...stored.value, [applicationId]: { generatedAt, checked: next } });
    },
  };
}
