import { z } from 'zod';

import { scheduledEventKindSchema } from '../scheduled-events.js';
import { applicationSchema } from '../schemas/application.js';
import { MATCH_LIMITS, matchCoverageSchema, matchRequirementSchema } from './match.js';
import { monthlySummaryInputSchema } from './monthly-summary.js';
import { vacancyValueSchemas } from './vacancy-parse.js';

export const INTERVIEW_PREP_LIMITS = {
  requirementsMax: 16,
  reasonsMax: 5,
  weakTopicsMax: 8,
  topicsMin: 5,
  topicsMax: 8,
  topicNameMaxLength: MATCH_LIMITS.nameMaxLength,
  whyMaxLength: 200,
  basisMaxLength: 200,
  questions: 10,
  questionMaxLength: 240,
  hintMaxLength: 240,
  askCompany: 3,
  planStepsMax: 6,
  stepMinutesMin: 5,
  stepMinutesMax: 120,
  taskMaxLength: 200,
  plan30Minutes: 30,
  plan120Minutes: 120,
} as const;

export const WEAK_TOPIC_PATTERN = /^[a-z_]{1,40}$/;

export const interviewPrepGapSchema = z.object({
  name: matchRequirementSchema.shape.name,
  coverage: matchCoverageSchema.exclude(['full']),
});

export const interviewPrepVacancySchema = z.object({
  position: applicationSchema.shape.position,
  interviewKind: scheduledEventKindSchema,
  requirements: z
    .array(vacancyValueSchemas.requirements.element)
    .max(INTERVIEW_PREP_LIMITS.requirementsMax),
  gaps: z.array(interviewPrepGapSchema).max(MATCH_LIMITS.requirementsMax),
});

export const interviewPrepWeakSpotsSchema = z.object({
  reasons: z
    .array(
      monthlySummaryInputSchema.shape.reasons.element.pick({
        stage: true,
        code: true,
        count: true,
      }),
    )
    .max(INTERVIEW_PREP_LIMITS.reasonsMax),
  topics: z.array(z.string().regex(WEAK_TOPIC_PATTERN)).max(INTERVIEW_PREP_LIMITS.weakTopicsMax),
});

export const interviewPrepInputSchema = interviewPrepVacancySchema.extend({
  weakSpots: interviewPrepWeakSpotsSchema,
});

const textOf = (maxLength: number) => z.string().min(1).max(maxLength);

export const interviewPrepTopicSchema = z.object({
  name: textOf(INTERVIEW_PREP_LIMITS.topicNameMaxLength),
  why: textOf(INTERVIEW_PREP_LIMITS.whyMaxLength),
  basis: textOf(INTERVIEW_PREP_LIMITS.basisMaxLength),
});

export const interviewPrepQuestionSchema = z.object({
  question: textOf(INTERVIEW_PREP_LIMITS.questionMaxLength),
  hint: textOf(INTERVIEW_PREP_LIMITS.hintMaxLength),
});

export const interviewPrepStepSchema = z.object({
  minutes: z
    .int()
    .min(INTERVIEW_PREP_LIMITS.stepMinutesMin)
    .max(INTERVIEW_PREP_LIMITS.stepMinutesMax),
  task: textOf(INTERVIEW_PREP_LIMITS.taskMaxLength),
});

const planOf = (budgetMinutes: number) =>
  z
    .array(interviewPrepStepSchema)
    .min(1)
    .max(INTERVIEW_PREP_LIMITS.planStepsMax)
    .refine((steps) => steps.reduce((total, { minutes }) => total + minutes, 0) <= budgetMinutes, {
      message: `The plan takes more than ${String(budgetMinutes)} minutes`,
    });

export const interviewPrepOutputSchema = z.object({
  topics: z
    .array(interviewPrepTopicSchema)
    .min(INTERVIEW_PREP_LIMITS.topicsMin)
    .max(INTERVIEW_PREP_LIMITS.topicsMax),
  questions: z.array(interviewPrepQuestionSchema).length(INTERVIEW_PREP_LIMITS.questions),
  askCompany: z
    .array(textOf(INTERVIEW_PREP_LIMITS.questionMaxLength))
    .length(INTERVIEW_PREP_LIMITS.askCompany),
  plan30: planOf(INTERVIEW_PREP_LIMITS.plan30Minutes),
  plan120: planOf(INTERVIEW_PREP_LIMITS.plan120Minutes),
});

export type InterviewPrepGap = z.infer<typeof interviewPrepGapSchema>;
export type InterviewPrepVacancy = z.infer<typeof interviewPrepVacancySchema>;
export type InterviewPrepWeakSpots = z.infer<typeof interviewPrepWeakSpotsSchema>;
export type InterviewPrepInput = z.infer<typeof interviewPrepInputSchema>;
export type InterviewPrepTopic = z.infer<typeof interviewPrepTopicSchema>;
export type InterviewPrepQuestion = z.infer<typeof interviewPrepQuestionSchema>;
export type InterviewPrepStep = z.infer<typeof interviewPrepStepSchema>;
export type InterviewPrepOutput = z.infer<typeof interviewPrepOutputSchema>;
