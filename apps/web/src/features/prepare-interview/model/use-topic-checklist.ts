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

type Checklists = z.output<typeof checklistsSchema>;

export function useTopicChecklist({
  applicationId,
  generatedAt,
}: TopicChecklistInput): TopicChecklist {
  const key = useUserStorageKey('interview-prep');
  const stored = useStoredJson({ key, schema: checklistsSchema, fallback: {} });
  const checkedIn = (checklists: Checklists) => {
    const entry = checklists[applicationId];
    return entry?.generatedAt === generatedAt ? entry.checked : [];
  };
  return {
    ready: key !== undefined,
    isChecked: (topic) => checkedIn(stored.value).includes(topic),
    toggle: (topic) => {
      stored.store((latest) => {
        const checked = checkedIn(latest);
        const next = checked.includes(topic)
          ? checked.filter((other) => other !== topic)
          : [...checked, topic].sort((left, right) => left - right);
        return { ...latest, [applicationId]: { generatedAt, checked: next } };
      });
    },
  };
}
