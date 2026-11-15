import {
  type CvHintsInput,
  cvHintsInputSchema,
  type CvHintsOutput,
  cvHintsProfileSchema,
} from '../src/ai/cv-hints.js';
import { buildResumeParseOutput } from './ai.js';

export const CV_HINTS_INPUT: CvHintsInput = cvHintsInputSchema.parse({
  position: 'Senior React developer',
  score: 59,
  requirements: [
    { name: 'AWS / інфраструктура', weight: 'must', coverage: 'missing', pointsLost: 27 },
    { name: 'Досвід ліда команди 3+', weight: 'nice', coverage: 'missing', pointsLost: 9 },
    { name: 'GraphQL', weight: 'nice', coverage: 'partial', pointsLost: 5 },
    { name: 'Node.js у проді', weight: 'must', coverage: 'full', pointsLost: 0 },
    { name: 'React + TypeScript', weight: 'must', coverage: 'full', pointsLost: 0 },
  ],
  profile: cvHintsProfileSchema.parse(buildResumeParseOutput()),
});

export const CV_HINTS_OUTPUT: CvHintsOutput = {
  hints: [
    {
      requirement: 'GraphQL',
      evidenceInCv: 'Built the Acme dashboard in React',
      suggestion:
        'Підніми рядок про дашборд Acme вище і назви в ньому API, з якими працював дашборд, якщо серед них був GraphQL.',
      expectedScoreImpact: 5,
    },
  ],
  gaps: ['AWS / інфраструктура', 'Досвід ліда команди 3+'],
};
