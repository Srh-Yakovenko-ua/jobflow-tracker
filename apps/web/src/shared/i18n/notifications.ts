import { countedUk, DAY_FORMS_UK, type NotifiedAiKind, type PluralForms } from '@jobflow/shared';

import { shell } from './shell';

const SILENT_CARDS = {
  one: 'картка в тиші',
  few: 'картки в тиші',
  other: 'карток у тиші',
} as const satisfies PluralForms;

const APPLICATIONS = {
  one: 'відгук',
  few: 'відгуки',
  other: 'відгуків',
} as const satisfies PluralForms;

const UNREAD = {
  one: 'непрочитане',
  few: 'непрочитані',
  other: 'непрочитаних',
} as const satisfies PluralForms;

const AI_RETRY = 'Дані на місці, можна спробувати ще раз.';

type AiCopy = { title: string; text: string; action: string };

export const notifications = {
  title: 'Сповіщення',
  bell: (unread: number) =>
    unread === 0 ? 'Сповіщення' : `Сповіщення, ${countedUk(unread, UNREAD)}`,
  popoverTitle: (unread: number) => `нагадування · ${String(unread)}`,
  readAll: 'Прочитати все',
  all: 'Усі сповіщення',
  unread: 'непрочитане',
  popoverEmpty: 'Усі відповіли. Найкращий вигляд цього списку.',
  filters: {
    label: 'Які сповіщення показати',
    options: { all: 'Усі', unread: 'Непрочитані' },
  },
  more: 'Показати ще',
  days: { today: 'Сьогодні', yesterday: 'Вчора' },
  open: 'Відкрити',
  silentCards: (count: number) => countedUk(count, SILENT_CARDS),
  empty: {
    eyebrow: 'Нагадування · порожньо',
    title: 'Усі відповіли',
    hint: (silenceDays: number) =>
      `Жодної картки без подій довше ${countedUk(silenceDays, DAY_FORMS_UK)}. Саме такий вигляд цього екрана найкращий.`,
  },
  silence: {
    text: (companies: string, days: number) =>
      `${companies} · ${countedUk(days, DAY_FORMS_UK)} без відповіді`,
    action: shell.palette.actions.followUp,
  },
  interviewSoon: {
    title: (clock: string) => `Співбесіда о ${clock}`,
    action: 'Відкрити картку',
  },
  aiDone: {
    vacancy_parse: {
      title: 'Вакансію розібрано',
      text: 'Перевір поля перед збереженням.',
      action: 'Перевірити поля',
    },
    resume_parse: {
      title: 'Резюме розібрано',
      text: 'Нова версія вже у списку резюме.',
      action: 'Відкрити резюме',
    },
    followup: {
      title: 'Драфт фоллоу-апу готовий',
      text: 'Його можна правити перед відправкою.',
      action: 'Відкрити драфт',
    },
  } satisfies Record<NotifiedAiKind, AiCopy>,
  aiFailed: {
    vacancy_parse: {
      title: 'Не вдалося розібрати вакансію',
      text: AI_RETRY,
      action: 'Заповнити вручну',
    },
    resume_parse: {
      title: 'Не вдалося розібрати резюме',
      text: AI_RETRY,
      action: 'Відкрити резюме',
    },
    followup: {
      title: 'Не вдалося написати фоллоу-ап',
      text: AI_RETRY,
      action: shell.palette.actions.followUp,
    },
  } satisfies Record<NotifiedAiKind, AiCopy>,
  insightUnlocked: {
    title: 'Перші висновки готові',
    text: (applications: number) => `У статистиці вже ${countedUk(applications, APPLICATIONS)}.`,
    action: shell.palette.actions.analytics,
  },
  monthlySummaryReady: {
    title: (month: string) => `Саммарі за ${month} готове`,
    text: 'Що вийшло за місяць і які кроки зробити далі.',
    action: shell.palette.actions.analytics,
  },
} as const;
