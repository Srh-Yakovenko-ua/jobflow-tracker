import {
  type InterviewPrepVacancy,
  interviewPrepVacancySchema,
  type InterviewPrepWeakSpots,
} from '@jobflow/shared';
import {
  buildVacancyParseOutput,
  INTERVIEW_PREP_INPUT,
  vacancyFieldOf,
} from '@jobflow/shared/testing';

import type { StoredAiResultJob } from '../modules/ai/index.js';
import type {
  InterviewPrepSourceQuery,
  InterviewPrepSourceRow,
  InterviewPrepSuggestion,
  LatestInterviewPrepRow,
  RecordInterviewPrepRequested,
} from '../modules/interview-prep/index.js';
import { applicationPath } from './applications.js';
import { APPLICATION_ID, OLENA_ID } from './service-fixtures.js';
import { minutesAfter } from './time.js';

export const interviewPrepPath = (id: string) => `${applicationPath(id)}/interview-prep`;

export const INTERVIEW_PREP_VACANCY: InterviewPrepVacancy =
  interviewPrepVacancySchema.parse(INTERVIEW_PREP_INPUT);

export const DESIGN_WEAK_SPOTS: InterviewPrepWeakSpots = {
  reasons: [
    { stage: 'applied', code: 'skills_gap', count: 3 },
    { stage: 'applied', code: 'english_level', count: 3 },
    { stage: 'tech_interview', code: 'skills_gap', count: 3 },
    { stage: 'applied', code: 'salary_expectations', count: 2 },
    { stage: 'applied', code: 'chose_other', count: 2 },
  ],
  topics: ['algorithms'],
};

export const PARSED_REQUIREMENTS = ['React + TypeScript', 'Node.js у проді', ' React '];

export const PARSED_VACANCY = buildVacancyParseOutput({
  requirements: vacancyFieldOf(PARSED_REQUIREMENTS, 'Вимоги'),
});

export const PLANNED_INTERVIEW = { kind: 'tech_interview', startsAt: minutesAfter(1440) } as const;

export const INTERVIEW_PREP_SOURCE_ROW: InterviewPrepSourceRow = {
  company: 'Acme',
  position: 'Senior React developer',
  stack: ['React', 'GraphQL'],
  aiParsed: PARSED_VACANCY,
  scheduledEvents: [PLANNED_INTERVIEW],
};

const reachesOlena = (userId: string, applicationId: string) =>
  userId === OLENA_ID && applicationId === APPLICATION_ID;

export class FakeInterviewPrepRepository {
  source: InterviewPrepSourceRow = INTERVIEW_PREP_SOURCE_ROW;

  latest: StoredAiResultJob | null = null;

  runningJobId: string | null = null;

  readonly sourceReads: InterviewPrepSourceQuery[] = [];

  readonly recorded: [string, RecordInterviewPrepRequested][] = [];

  findSource(userId: string, query: InterviewPrepSourceQuery) {
    this.sourceReads.push(query);
    return Promise.resolve(reachesOlena(userId, query.applicationId) ? this.source : null);
  }

  findLatest(userId: string, applicationId: string): Promise<LatestInterviewPrepRow | null> {
    const aiJobs = this.latest === null ? [] : [this.latest];
    return Promise.resolve(reachesOlena(userId, applicationId) ? { aiJobs } : null);
  }

  lockApplication(userId: string, { applicationId }: { applicationId: string }) {
    const lock = reachesOlena(userId, applicationId) ? { runningJobId: this.runningJobId } : null;
    return Promise.resolve(lock);
  }

  recordRequested(userId: string, recorded: RecordInterviewPrepRequested): Promise<void> {
    this.recorded.push([userId, recorded]);
    return Promise.resolve();
  }
}

export class RecordingInterviewPrep {
  readonly suggested: [string, InterviewPrepSuggestion][] = [];

  prepares = true;

  suggest(userId: string, suggestion: InterviewPrepSuggestion): Promise<boolean> {
    this.suggested.push([userId, suggestion]);
    return Promise.resolve(this.prepares);
  }
}
