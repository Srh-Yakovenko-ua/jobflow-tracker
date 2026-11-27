import {
  type AiKind,
  type AiPayloadField,
  countedUk,
  DAY_FORMS_UK,
  type PluralForms,
  pluralUk,
} from '@jobflow/shared';

import { settingsAccount } from './settings-account';
import { emailTypes } from './settings-email';

const DAY_GENITIVE_FORMS = {
  one: 'дня',
  few: 'днів',
  other: 'днів',
} as const satisfies PluralForms;

const daysOf = (count: number) => countedUk(count, DAY_FORMS_UK);

const dayWordOf = (count: number) => pluralUk(count, DAY_FORMS_UK);

type MedianCopy = { median: number; preset: number };

const answeredIn = (median: number) => (median === 0 ? 'того ж дня' : `за ${daysOf(median)}`);

const STATS_ONLY = 'лише цифри статистики';

export type ModelDataCopy = { [Kind in AiKind]: Record<AiPayloadField<Kind>, string> };

export const settings = {
  title: 'Налаштування',
  navLabel: 'Розділи налаштувань',
  sections: {
    search: 'Пошук і тиша',
    rhythm: 'Ритм пошуку',
    notifications: 'Сповіщення',
    aiPrivacy: 'AI та приватність',
    appearance: 'Вигляд і тема',
    account: 'Акаунт',
  },
  saving: 'Зберігаю…',
  saved: 'Збережено',
  saveFailed: {
    title: 'Не вдалося зберегти',
    description: "Налаштування лишилось як було. Перевір з'єднання і спробуй ще раз.",
  },
  silence: {
    title: 'Поріг тиші',
    description: 'Через скільки днів без відповіді нагадати про фоллоу-ап.',
    presets: 'Поріг тиші в днях',
    unit: (days: number) => `${dayWordOf(days)} після останньої події`,
    median: ({ median, preset }: MedianCopy) =>
      `Тобі зазвичай відповідають ${answeredIn(median)}, тож радимо ${String(preset)}.`,
    noMedian: (days: number) => `Поки замало відповідей: стартово ${daysOf(days)}.`,
    finalStage: (days: number) => `На етапі «фінал» поріг подвоюється: ${daysOf(days)}.`,
  },
  rules: {
    title: 'Автоматичні дії',
    autoGhost: (days: number) => ({
      title: `Переводити в ghosted після ${countedUk(days, DAY_GENITIVE_FORMS)} тиші`,
      description: `Поріг тиші лише нагадує. Через ${daysOf(days)} картка переходить у ghosted, повернути можна будь-коли.`,
    }),
    askReason: {
      title: 'Питати причину при переносі у «відмову»',
      description: 'Без причин аналітика відмов буде порожня.',
    },
    monthlySummary: {
      title: 'Місячне AI-саммарі',
      description: 'Першого числа о 7:00, сповіщенням і листом.',
    },
  },
  notifications: {
    title: 'Сповіщення',
    inApp: {
      title: 'Сповіщення в застосунку',
      description: "Нагадування й зміни етапів з'являються в центрі сповіщень JobFlow.",
    },
    push: {
      title: 'Сповіщення в браузері',
      description: 'Нагадування приходять, навіть коли вкладку закрито.',
    },
    email: {
      title: 'Листи на пошту',
      description: 'Нагадування й саммарі приходять ще й листом.',
      types: emailTypes,
    },
    quietHours: {
      title: 'Тихі години',
      description: 'У цей час сповіщення й листи не приходять.',
      start: 'Від',
      end: 'До',
    },
    timezone: {
      label: 'Часовий пояс',
      search: 'Пошук поясу',
      hint: 'За ним рахуються дати, тихі години й нагадування.',
    },
  },
  aiPrivacy: {
    title: 'AI та приватність',
    description: 'AI бачить лише те, що потрібно для кожної функції.',
    modelData: {
      title: 'Що бачить AI',
      features: {
        vacancy_parse: 'Розбір вакансії',
        resume_parse: 'Розбір резюме',
        match: 'Match Score',
        followup: 'Фоллоу-ап',
        monthly_summary: 'Місячне AI-саммарі',
        cv_hints: 'Підказки до резюме',
        interview_prep: 'Підготовка до співбесіди',
      } satisfies Record<AiKind, string>,
      line: (feature: string, labels: readonly string[]) => `${feature}: ${labels.join(', ')}.`,
      notes: 'Текст нотаток AI не бачить, лише позначені теми.',
      fields: {
        vacancy_parse: { text: 'текст вакансії' },
        resume_parse: { text: 'текст резюме без контактів', pages: 'скан, якщо немає тексту' },
        match: { vacancy: 'текст вакансії', profile: 'профіль резюме' },
        followup: {
          recruiterFirstName: 'імʼя рекрутера',
          company: 'компанія',
          position: 'посада',
          stage: 'етап',
          silenceDays: 'дні тиші',
          lastInterview: 'остання співбесіда',
          senderName: 'твоє імʼя',
          language: 'мова',
          tone: 'тон',
          hint: 'твоя підказка',
        },
        monthly_summary: {
          period: 'місяці',
          activity: STATS_ONLY,
          funnel: STATS_ONLY,
          reasons: STATS_ONLY,
          sources: STATS_ONLY,
          resumeAb: STATS_ONLY,
          forecast: STATS_ONLY,
          whatIf: STATS_ONLY,
          insights: 'висновки',
          ruleActions: 'поради',
          previousPlan: 'прогрес плану',
        },
        cv_hints: {
          position: 'посада',
          score: 'Match Score',
          requirements: 'вимоги вакансії',
          profile: 'профіль резюме',
        },
        interview_prep: {
          position: 'посада',
          interviewKind: 'тип співбесіди',
          requirements: 'вимоги вакансії',
          gaps: 'прогалини резюме',
          weakSpots: 'слабкі місця',
        },
      } satisfies ModelDataCopy,
    },
    dataDeletion: {
      title: 'Видалити все, що зробив AI',
      description:
        'Зникнуть розбори, Match Score, саммарі, листи й підготовки. Вакансії, резюме й плани лишаться.',
      action: 'Видалити все, що зробив AI',
      dialog: {
        title: 'Видалити все, що зробив AI?',
        body: 'Розбори, Match Score, саммарі, листи й підготовки зникнуть назавжди. Вакансії, резюме й плани лишаться.',
        cancel: 'Скасувати',
        confirm: 'Видалити',
      },
      deleted: 'Усе, що зробив AI, видалено',
      failed: {
        title: 'Не вдалося видалити зроблене AI',
        description: "Усе лишилось як було. Перевір з'єднання і спробуй ще раз.",
      },
    },
  },
  appearance: { title: 'Тема' },
  singleKeyShortcuts: {
    title: 'Гарячі клавіші з однієї літери',
    description:
      'N, G, ? і / спрацьовують одним натиском. Вимкни, якщо вводиш текст голосом або перемикачем.',
  },
  account: settingsAccount,
  password: {
    title: 'Зміна пароля',
    current: 'Поточний пароль',
    next: 'Новий пароль',
    submit: 'Змінити пароль',
    changed: 'Пароль змінено. На інших пристроях треба увійти знову.',
    wrongCurrent: 'Поточний пароль не підходить',
  },
} as const;
