import {
  type Application,
  applicationMatchResponseSchema,
  cvHintsResponseSchema,
  followupResponseSchema,
  interviewPrepResponseSchema,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

const AI_RESPONSE_SCHEMAS = {
  match: applicationMatchResponseSchema,
  followup: followupResponseSchema,
  'cv-hints': cvHintsResponseSchema,
  'interview-prep': interviewPrepResponseSchema,
} as const;

export type ApplicationAiSegment = keyof typeof AI_RESPONSE_SCHEMAS;

type AiResponses = {
  [Segment in ApplicationAiSegment]: z.infer<(typeof AI_RESPONSE_SCHEMAS)[Segment]>;
};

const SCHEMA_OF: { [Segment in ApplicationAiSegment]: z.ZodType<AiResponses[Segment]> } =
  AI_RESPONSE_SCHEMAS;

export type ApplicationAiRead<Segment extends ApplicationAiSegment> = Readonly<{
  id: Application['id'];
  segment: Segment;
}>;

export function fetchApplicationAi<Segment extends ApplicationAiSegment>(
  { id, segment }: ApplicationAiRead<Segment>,
  signal: AbortSignal,
): Promise<AiResponses[Segment]> {
  return apiClient.request({
    path: `/applications/${id}/${segment}`,
    schema: SCHEMA_OF[segment],
    signal,
  });
}

export function applicationAiQueryOptions<Segment extends ApplicationAiSegment>(
  read: ApplicationAiRead<Segment>,
) {
  return queryOptions({
    queryKey: applicationKeys.ai(read.id, read.segment),
    queryFn: ({ signal }) => fetchApplicationAi(read, signal),
  });
}
