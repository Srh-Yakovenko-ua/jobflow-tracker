import type { JobStatus, JobUpdated } from '../src/schemas/job.js';

export function buildJobUpdate(overrides: Partial<JobUpdated> = {}): JobUpdated {
  return {
    id: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b',
    kind: 'vacancy_parse',
    status: 'queued',
    step: 1,
    errorType: null,
    applicationId: '0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2c',
    ...overrides,
  };
}

export function buildJobStatus(overrides: Partial<JobStatus> = {}): JobStatus {
  return { ...buildJobUpdate(), totalSteps: 3, queue: { ahead: 2, etaSeconds: 30 }, ...overrides };
}
