import type { ApplicationCard } from '@jobflow/shared';

import {
  type ApplicationCardContext,
  type ApplicationCardProps,
  FULL_CARD,
  type ScoreBadgeProps,
} from '@/entities/application';
import { uk } from '@/shared/i18n';

const CARDS = uk.devUi.cards;

const SCORES = uk.devUi.matchScore.captions;

export const SPECIMEN_CONTEXT: ApplicationCardContext = {
  now: new Date('2026-10-23T09:00:00Z'),
  timeZone: 'Europe/Kyiv',
};

const NO_STACK: Pick<ApplicationCard, 'stack' | 'stackCount'> = { stack: [], stackCount: 0 };

export const CALL_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000002',
  company: 'Kvit Software',
  position: 'Full-stack Developer',
  currentStage: 'screening',
  matchScore: 66,
  salaryMin: 4200,
  salaryMax: 5000,
  daysInStage: 2,
  nextScheduledEvent: { kind: 'screening_call', startsAt: '2026-10-23T13:00:00Z' },
};

export const NORM_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000003',
  company: 'Northwind Digital',
  position: 'Lead Frontend Engineer',
  source: 'referral',
  currentStage: 'final',
  matchScore: 91,
  salaryMin: 6000,
  salaryMax: 7500,
  daysInStage: 13,
};

export const TOMORROW_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000007',
  company: 'Bereza Labs',
  position: 'Platform Engineer',
  source: 'referral',
  currentStage: 'tech_interview',
  matchScore: 69,
  salaryMin: 5200,
  salaryMax: null,
  nextScheduledEvent: { kind: 'tech_interview', startsAt: '2026-10-24T07:30:00Z' },
};

export const QUEUED_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000008',
  company: 'Bitmark',
  position: 'Go Backend Engineer',
  source: 'dou',
  currentStage: 'screening',
  matchScore: 71,
  aiStatus: 'queued',
  salaryMin: null,
  salaryMax: 6200,
};

export const PROCESSING_CARD: ApplicationCard = {
  ...QUEUED_CARD,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000009',
  company: 'Kvit Software',
  position: 'Senior Node.js Engineer',
  matchScore: null,
  aiStatus: 'processing',
  salaryMin: 4800,
};

export const FAILED_CARD: ApplicationCard = {
  ...QUEUED_CARD,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000010',
  company: 'Zoria Tech',
  position: 'React Native Developer',
  source: 'linkedin',
  matchScore: 62,
  aiStatus: 'failed',
  salaryMin: 3800,
  salaryMax: 4600,
};

export const LONG_TEXT_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000004',
  company: CARDS.longCompany,
  position: 'Senior Full-stack Engineer, Payments Platform (TypeScript/Node.js/PostgreSQL)',
  source: 'other',
  salaryMin: null,
  salaryMax: null,
  currency: null,
  matchScore: null,
  aiStatus: null,
};

export const WARN_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000005',
  company: 'Acme Technologies',
  position: 'Senior React Developer',
  currentStage: 'tech_interview',
  matchScore: 78,
  salaryMin: 4500,
  salaryMax: 6000,
  daysInStage: 5,
  daysSinceLastEvent: 5,
  silenceLevel: 'warn',
};

export const SILENT_CARD: ApplicationCard = {
  ...FULL_CARD,
  ...NO_STACK,
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000006',
  company: 'Vela Interactive',
  position: 'Middle QA Engineer',
  matchScore: 58,
  salaryMin: 2800,
  salaryMax: 3600,
  daysInStage: 9,
  daysSinceLastEvent: 9,
  silenceLevel: 'silent',
};

export type CardSpecimen = ApplicationCardProps & { eyebrow: string };

export const CARD_SPECIMENS: readonly CardSpecimen[] = [
  { eyebrow: CARDS.full, application: FULL_CARD, context: SPECIMEN_CONTEXT },
  {
    eyebrow: CARDS.compact,
    application: FULL_CARD,
    view: { density: 'compact' },
    context: SPECIMEN_CONTEXT,
  },
  { eyebrow: CARDS.call, application: CALL_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.tomorrow, application: TOMORROW_CARD, context: SPECIMEN_CONTEXT },
  {
    eyebrow: CARDS.norm,
    application: NORM_CARD,
    context: { ...SPECIMEN_CONTEXT, stageNormDays: 17 },
  },
  { eyebrow: CARDS.long, application: LONG_TEXT_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.warn, application: WARN_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.silent, application: SILENT_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.queued, application: QUEUED_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.processing, application: PROCESSING_CARD, context: SPECIMEN_CONTEXT },
  { eyebrow: CARDS.failed, application: FAILED_CARD, context: SPECIMEN_CONTEXT },
];

export type ScoreSpecimen = { caption: string; application: ScoreBadgeProps['application'] };

export const SCORE_SPECIMENS: readonly ScoreSpecimen[] = [
  { caption: SCORES.strong, application: { matchScore: 85, aiStatus: 'done' } },
  { caption: SCORES.mid, application: { matchScore: 70, aiStatus: 'done' } },
  { caption: SCORES.weak, application: { matchScore: 40, aiStatus: 'done' } },
  { caption: SCORES.queued, application: { matchScore: 85, aiStatus: 'queued' } },
  { caption: SCORES.processing, application: { matchScore: null, aiStatus: 'processing' } },
  { caption: SCORES.failed, application: { matchScore: 70, aiStatus: 'failed' } },
  { caption: SCORES.none, application: { matchScore: null, aiStatus: null } },
];
