import type { JobStatus, SummaryResponse } from '@jobflow/shared';
import { buildJobStatus, buildSummary } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { type SummaryLatest, type SummaryState, summaryStateOf } from './summary-state';

const SUMMARY = buildSummary();

const NEWER_JOB_ID = buildJobStatus().id;

const RUNNING_JOB = buildJobStatus({ status: 'processing', step: 2, queue: null });

function answered(data: SummaryResponse): SummaryLatest {
  return { data, isError: false };
}

function jobOf(status: JobStatus['status'], id = NEWER_JOB_ID): SummaryResponse['job'] {
  return { id, status };
}

describe('summaryStateOf', () => {
  it.each<{ name: string; latest: SummaryLatest; job?: JobStatus; state: SummaryState }>([
    {
      name: 'no answer yet is loading',
      latest: { data: undefined, isError: false },
      state: { status: 'loading' },
    },
    {
      name: 'a failed first read is load-failed',
      latest: { data: undefined, isError: true },
      state: { status: 'load-failed' },
    },
    {
      name: 'no summary and no job is empty',
      latest: answered({ summary: null, job: null }),
      state: { status: 'empty' },
    },
    {
      name: 'a queued job is generating',
      latest: answered({ summary: null, job: jobOf('queued') }),
      state: { status: 'generating', job: { status: 'processing', step: 1, steps: 3 } },
    },
    {
      name: 'a processing job over an older summary is generating, at the step the job reports',
      latest: answered({ summary: SUMMARY, job: jobOf('processing') }),
      job: RUNNING_JOB,
      state: { status: 'generating', job: { status: 'processing', step: 2, steps: 3 } },
    },
    {
      name: 'a failed job with no summary is job-failed',
      latest: answered({ summary: null, job: jobOf('failed') }),
      state: { status: 'job-failed', summary: null },
    },
    {
      name: 'a failed job newer than the summary is job-failed and keeps the summary',
      latest: answered({ summary: SUMMARY, job: jobOf('failed') }),
      state: { status: 'job-failed', summary: SUMMARY },
    },
    {
      name: 'the done job of the summary is ready',
      latest: answered({ summary: SUMMARY, job: jobOf('done', SUMMARY.aiJobId) }),
      state: { status: 'ready', summary: SUMMARY },
    },
    {
      name: 'a summary kept through a failed refetch stays ready',
      latest: { data: { summary: SUMMARY, job: null }, isError: true },
      state: { status: 'ready', summary: SUMMARY },
    },
  ])('$name', ({ latest, job, state }) => {
    expect(summaryStateOf({ latest, job })).toEqual(state);
  });
});
