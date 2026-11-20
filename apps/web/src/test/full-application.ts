import type { ApplicationCard, ApplicationResponse } from '@jobflow/shared';

export const FULL_CARD: ApplicationCard = {
  id: '0b6f3c1e-5d2a-4c8e-9f10-000000000001',
  company: 'Trident Systems',
  position: 'Senior Frontend Engineer',
  source: 'djinni',
  salaryMin: 5000,
  salaryMax: 6500,
  currency: 'USD',
  matchScore: 84,
  currentStage: 'applied',
  isDraft: false,
  appliedAt: '2026-10-20T09:00:00Z',
  lastEventAt: '2026-10-20T09:00:00Z',
  daysInStage: 3,
  daysSinceLastEvent: 3,
  silenceLevel: 'none',
  stack: ['React', 'TS'],
  stackCount: 4,
  nextScheduledEvent: null,
  aiStatus: 'done',
  aiJobId: null,
};

export const FULL_APPLICATION: ApplicationResponse = {
  ...FULL_CARD,
  searchId: '0b6f3c1e-5d2a-4c8e-9f10-0000000000ff',
  url: null,
  location: null,
  workMode: null,
  resumeVersionId: null,
  aiParsed: null,
  rawText: null,
  createdAt: FULL_CARD.lastEventAt,
  updatedAt: FULL_CARD.lastEventAt,
};
