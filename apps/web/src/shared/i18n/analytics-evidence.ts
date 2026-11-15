import {
  countedUk,
  DAY_FORMS_UK,
  type MatchScoreBucket,
  pluralUk,
  type ResumeAbVersion,
  type SalaryOutcome,
  type Seniority,
} from '@jobflow/shared';

import { applications, FORMS, type SourceCounts, sourceCounts } from './analytics-forms';

export type VersionSwitch = Readonly<
  Pick<ResumeAbVersion, 'number'> & { date: string; before: string; after: string }
>;

export type RateCounts = Readonly<Record<'value' | 'successes' | 'trials', number>>;

export type VersionPair = Readonly<{ challenger: number; baseline: number; percent: number }>;

export const evidence = {
  resume_ab: {
    eyebrow: 'A/B версій резюме',
    fallback: 'Яка версія CV працює краще',
    label: ({ number, title }: Pick<ResumeAbVersion, 'number' | 'title'>) =>
      `CV v${String(number)} · ${title}`,
    tip: ({ value, successes, trials }: RateCounts) =>
      `${String(value)}% · ${String(successes)} із ${String(trials)}`,
    probability: ({ challenger, baseline, percent }: VersionPair) =>
      `Імовірність, що CV v${String(challenger)} краще за v${String(baseline)}: ${String(percent)}%`,
    switched: ({ number, date, before, after }: VersionSwitch) =>
      `Після переходу на CV v${String(number)} ${date}: конверсія ${before} → ${after}`,
    small: ({ number, ...counts }: SourceCounts & Pick<ResumeAbVersion, 'number'>) =>
      `CV v${String(number)}: ${sourceCounts(counts)}.`,
    empty: {
      none: {
        title: 'Версій резюме ще немає',
        hint: "Познач, з яким CV ти відгукуєшся, і тут з'явиться порівняння версій.",
      },
      single: {
        title: 'Поки що лише одна версія CV',
        hint: "Порівняння з'явиться, коли ти відгукнешся з другою версією.",
      },
    },
    table: { caption: 'Конверсія за версіями резюме', version: 'версія' },
  },
  timings: {
    eyebrow: 'час на етапах · медіана',
    series: 'днів на етапі',
    days: (shown: string, count: number) => `${shown} ${pluralUk(count, DAY_FORMS_UK)}`,
    median: (days: string) => `${days} · медіана`,
    typical: (low: string, high: string) => `типово ${low}–${high}`,
    small: (stage: string, samples: number) => `${stage}: ${countedUk(samples, FORMS.sample)}.`,
    empty: {
      title: 'Етапів ще немає',
      hint: "Тут з'явиться, скільки днів відгук проводить на кожному етапі.",
    },
    table: {
      caption: 'Час на етапах',
      stage: 'етап',
      median: 'медіана',
      typical: 'типово',
      samples: 'замірів',
    },
  },
  salary: {
    eyebrow: 'зарплатна аналітика · твої картки',
    fallback: 'На якій вилці приходить офер',
    outcomes: {
      offer: 'офер',
      salary_rejection: 'відмова через зарплату',
      other: 'інші',
    } satisfies Record<SalaryOutcome, string>,
    seniorities: {
      intern: 'Intern',
      junior: 'Junior',
      middle: 'Middle',
      senior: 'Senior',
      lead: 'Lead',
    } satisfies Record<Seniority, string>,
    series: 'медіана вилки',
    dollars: (amount: string) => `$${amount}`,
    thousands: (count: number) => `$${String(count)}k`,
    median: (amount: string) => `${amount} медіана вилки`,
    range: (low: string, high: string) => `${low}–${high}`,
    tip: {
      median: (amount: string) => `${amount} · медіана`,
      range: (low: string, high: string) => `вилки від ${low} до ${high}`,
    },
    missing: (count: number) =>
      `${applications(count)} без вилки ${pluralUk(count, FORMS.leftOut)} у розрахунок.`,
    unconverted: (count: number) =>
      `${applications(count)} у валюті без курсу ${pluralUk(count, FORMS.leftOut)} у розрахунок.`,
    small: (group: string, count: number) =>
      `${group}: ${applications(count)}. На такій вибірці медіана лише орієнтир.`,
    empty: {
      title: 'Вилок ще немає',
      hint: "Тут з'явиться, на якій вилці приходить офер, а на якій відмовляють через зарплату.",
    },
    table: {
      caption: 'Зарплатні вилки, $ net',
      group: 'група',
      applications: 'відгуків',
      median: 'медіана',
      range: 'вилка',
    },
  },
  matchValidation: {
    eyebrow: 'Match Score · перевірка на відгуках',
    fallback: "Чи передбачає Match Score інтерв'ю",
    buckets: {
      below_50: 'до 50',
      from_50_to_74: '50–74',
      from_75: '75+',
    } satisfies Record<MatchScoreBucket, string>,
    step: "до інтерв'ю",
    series: "дійшли до інтерв'ю",
    correlation: (r: string, count: number) => `r = ${r} на ${String(count)} відгуках`,
    unscored: (count: number) => `${applications(count)} без Match Score не входять у розрахунок.`,
    small: (bucket: string, count: number) => `${bucket}: ${applications(count)}.`,
    empty: {
      title: 'Match Score ще немає',
      hint: "Тут з'явиться, чи частіше вакансії з високим збігом доходять до інтерв'ю.",
    },
    table: {
      caption: 'Match Score і результати відгуків',
      bucket: 'Match Score',
      applications: 'відгуків',
      screening: 'дійшли до скринінгу',
      interview: "дійшли до інтерв'ю",
    },
  },
} as const;
