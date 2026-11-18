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

const STATS_ONLY = 'лише цифри статистики';

export type ModelDataCopy = { [Kind in AiKind]: Record<AiPayloadField<Kind>, string> };

export const settings = {
  title: 'Налаштування',
  navLabel: 'Розділи налаштувань',
  sections: {
    search: 'Пошук і тиша',
    rhythm: 'Ритм пошуку',
    notifications: 'Повідомлення',
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
    description: 'Скільки днів без подій до індикатора тиші й нагадування про фоллоу-ап.',
    presets: 'Поріг тиші в днях',
    unit: (days: number) => `${dayWordOf(days)} після останньої події`,
    median: ({ median, preset }: MedianCopy) =>
      `Твоя медіана відповіді ${daysOf(median)}, тож раджу ${String(preset)}.`,
    noMedian: (days: number) => `Поки замало відповідей: стартово ${daysOf(days)}.`,
    finalStage: (days: number) => `На етапі «фінал» поріг подвоюється: ${daysOf(days)}.`,
  },
  rules: {
    title: 'Автоматичний ghost',
    autoGhost: (days: number) => ({
      title: `Переводити в ghosted після ${countedUk(days, DAY_GENITIVE_FORMS)} тиші`,
      description: 'Картка йде з дошки в приглушену колонку. Це можна відкотити будь-коли.',
    }),
    askReason: {
      title: 'Питати причину при переносі у «відмову»',
      description: 'Без причин аналітика відмов не працює, але вимикати можна.',
    },
    monthlySummary: {
      title: 'Місячне AI-саммарі',
      description: 'Першого числа, о 7:00. Приходить пушем і листом.',
    },
  },
  notifications: {
    title: 'Повідомлення',
    inApp: {
      title: 'Сповіщення в застосунку',
      description: "Нагадування й зміни етапів з'являються в центрі сповіщень JobFlow.",
    },
    push: {
      title: 'Пуші в браузері',
      description: 'Нагадування приходять, навіть коли вкладку закрито.',
    },
    email: {
      title: 'Листи на пошту',
      description: 'Нагадування й підсумки приходять ще й листом.',
      types: emailTypes,
    },
    quietHours: {
      title: 'Тихі години',
      description: 'У цей час пуші й листи не приходять.',
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
    description: 'Що саме йде в модель.',
    modelData: {
      title: 'Що бачить модель',
      features: {
        vacancy_parse: 'Розбір вакансії',
        resume_parse: 'Розбір резюме',
        match: 'Match Score',
        followup: 'Фоллоу-ап',
        monthly_summary: 'Місячне AI-саммарі',
        cv_hints: 'Підказки до CV',
        interview_prep: 'Підготовка до співбесіди',
      } satisfies Record<AiKind, string>,
      line: (feature: string, labels: readonly string[]) => `${feature}: ${labels.join(', ')}.`,
      notes: 'Текст нотаток у модель не йде, лише слова-теми зі словника.',
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
      title: 'Видалити всі AI-результати',
      description:
        'Розбори, Match Score, саммарі, драфти й підготовки зникнуть. Вакансії, резюме й збережені плани лишаться.',
      action: 'Видалити всі AI-результати',
      dialog: {
        title: 'Видалити всі AI-результати?',
        body: 'Розбори, Match Score, саммарі, драфти й підготовки зникнуть назавжди. Вакансії, резюме й збережені плани лишаться.',
        cancel: 'Скасувати',
        confirm: 'Видалити',
      },
      deleted: 'AI-результати видалено',
      failed: {
        title: 'Не вдалося видалити AI-результати',
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
