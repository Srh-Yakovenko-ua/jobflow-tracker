import { countedUk, DAY_FORMS_UK, type PluralForms, pluralUk } from '@jobflow/shared';

const DAY_GENITIVE_FORMS = {
  one: 'дня',
  few: 'днів',
  other: 'днів',
} as const satisfies PluralForms;

const daysOf = (count: number) => countedUk(count, DAY_FORMS_UK);

const dayWordOf = (count: number) => pluralUk(count, DAY_FORMS_UK);

type MedianCopy = { median: number; preset: number };

export const settings = {
  title: 'Налаштування',
  navLabel: 'Розділи налаштувань',
  sections: {
    search: 'Пошук і тиша',
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
    description:
      'Скільки днів без подій має пройти, щоб карточка отримала індикатор тиші, а ти — нагадування про фоллоу-ап.',
    presets: 'Поріг тиші в днях',
    unit: (days: number) => `${dayWordOf(days)} після останньої події`,
    median: ({ median, preset }: MedianCopy) =>
      `Твоя медіана відповіді — ${daysOf(median)}, тому ${String(preset)} — розумний поріг.`,
    noMedian: (days: number) =>
      `Поки замало відповідей, щоб порадити поріг; ${daysOf(days)} — стартове значення.`,
    finalStage: (days: number) =>
      `На етапі «фінал» поріг автоматично подвоюється: там ${daysOf(days)} — норма, і нагадування були б хибними.`,
  },
  rules: {
    title: 'Автоматичний ghost',
    autoGhost: (days: number) => ({
      title: `Переводити в ghosted після ${countedUk(days, DAY_GENITIVE_FORMS)} тиші`,
      description: 'Карточка йде з дошки в приглушену колонку. Це можна відкотити будь-коли.',
    }),
    askReason: {
      title: 'Питати причину при переносі у «відмову»',
      description: 'Без причин аналітика відмов не працює — але вимикати можна.',
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
    description: 'Що саме йде в модель і навіщо.',
    modelData: {
      title: 'Що бачить модель',
      items: [
        'Текст вакансії — для розбору й Match Score.',
        'Текст резюме або сторінки скану — для профілю резюме.',
        'Підсумкові числа за місяць — для місячного саммарі.',
      ],
    },
    dataDeletion: {
      title: 'Видалити всі AI-результати',
      description:
        'Розбори вакансій, Match Score і профілі резюме зникнуть, самі вакансії й резюме лишаться.',
    },
    captureToken: {
      title: 'Токен букмарклета',
      description: 'Букмарклет створює чернетки цим токеном. Новий токен вимикає старий.',
    },
  },
  appearance: { title: 'Тема' },
  account: {
    title: 'Акаунт',
    name: "Ім'я",
    email: 'Пошта',
    logoutEverywhere: {
      title: 'Вийти на всіх пристроях',
      description: 'Завершує всі сесії, і цю теж. Увійти знову можна будь-коли.',
      action: 'Вийти на всіх пристроях',
    },
    deletion: {
      title: 'Видалити акаунт',
      description: 'Спершу вивантажимо всі твої дані, потім попросимо підтвердити.',
    },
  },
  password: {
    title: 'Зміна пароля',
    current: 'Поточний пароль',
    next: 'Новий пароль',
    submit: 'Змінити пароль',
    changed: 'Пароль змінено. На інших пристроях треба увійти знову.',
    wrongCurrent: 'Поточний пароль не підходить',
    failed: {
      title: 'Не вдалося змінити пароль',
      description: "Пароль лишився старим. Перевір з'єднання і спробуй ще раз.",
    },
  },
} as const;
