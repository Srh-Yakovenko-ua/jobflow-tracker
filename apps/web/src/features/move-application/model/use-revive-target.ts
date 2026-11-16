'use client';

import type { ActiveStage, ApplicationCard } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { timelineQueryOptions } from '@/entities/application';

import { reviveTargetOf } from '../lib/revive-target';

export type RevivedApplication = Pick<ApplicationCard, 'id' | 'currentStage'>;

export function useReviveTarget(application: RevivedApplication): ActiveStage | null {
  const ghosted = application.currentStage === 'ghosted';
  const timeline = useQuery({ ...timelineQueryOptions(application.id), enabled: ghosted });
  return ghosted && timeline.data ? reviveTargetOf(timeline.data.items) : null;
}
