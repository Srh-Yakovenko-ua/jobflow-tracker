import type { AiJobStatus, PluralForms } from '@jobflow/shared';

const FORMS = {
  task: { one: 'задача', few: 'задачі', other: 'задач' },
  minute: { one: 'хвилина', few: 'хвилини', other: 'хвилин' },
  cardsWaiting: { one: 'карточка чекає', few: 'карточки чекають', other: 'карточок чекають' },
  secondShort: { other: 'с' },
  minuteShort: { other: 'хв' },
} as const satisfies Record<string, PluralForms>;

export const states = {
  forms: FORMS,
  empty: {
    meter: (count: number, goal: number) => `${String(count)} / ${String(goal)}`,
    meterLabel: 'Прогрес до першого висновку',
  },
  async: {
    status: {
      queued: 'у черзі',
      processing: 'обробляється',
      done: 'готово',
      failed: 'AI не впорався',
    } satisfies Record<AiJobStatus, string>,
    queued: (position: string, eta: string) => `у черзі · ${position} · ~${eta}`,
    ahead: (tasks: string) => `${tasks} перед твоєю`,
    next: 'твоя задача наступна',
    processing: (step: number, steps: number) =>
      `крок ${String(step)} з ${String(steps)} · обробляється`,
    closable: 'можна закрити сторінку',
    closableIn: (eta: string) => `~${eta} · можна закрити сторінку`,
    progressLabel: 'Хід обробки',
    done: (took: string) => `готово за ${took}`,
    safe: 'Дані цілі, нічого не втрачено.',
    manual: 'Зробити вручну',
    retry: 'Спробувати ще раз',
  },
  errors: {
    offline: {
      eyebrow: "Немає зв'язку",
      title: 'Працюєш офлайн',
      body: (time: string) => `Усе збережене раніше ціле. Аналітика поки показує дані на ${time}.`,
      action: 'Спробувати зараз',
    },
    aiQueue: {
      eyebrow: 'Черга AI перевантажена',
      title: 'Розбір затримується',
      body: (tasks: string, minutes: string) =>
        `У черзі ${tasks}, орієнтовно ${minutes}. Карточки вже на дошці — поля підтягнуться самі, нічого не втрачено.`,
    },
    fileTooBig: {
      eyebrow: 'Файл не підійшов',
      title: (size: string) => `Резюме важить ${size} МБ`,
      body: (limit: string) =>
        `Максимум — ${limit} МБ. Найчастіше вага від картинок у PDF; експорт «для вебу» зазвичай вирішує. Нічого не втрачено.`,
      action: 'Обрати інший файл',
    },
    loadFailed: {
      eyebrow: 'Збій завантаження',
      title: 'Не вдалося завантажити',
      body: 'Це збій на нашому боці, збережені дані на місці.',
      action: 'Спробувати ще раз',
    },
  },
  crash: {
    pageTitle: 'Помилка на нашому боці',
    title: 'Щось зламалось у нас, не в тебе',
    page: {
      eyebrow: 'Сторінка впала',
      body: 'Сторінка не завантажилась через помилку на нашому боці. Дані цілі — вони не залежать від цього екрана.',
    },
    widget: {
      eyebrow: 'Блок впав',
      body: 'Блок не завантажився через помилку на нашому боці. Дані цілі — вони не залежать від цього блоку.',
    },
    action: 'Перезавантажити',
    meta: (code: string, time: string) => `код ${code} · ${time}`,
  },
  notFound: {
    pageTitle: 'Сторінку не знайдено',
    eyebrow: 'Помилка 404',
    title: 'Такої сторінки немає',
    hint: 'Посилання могло застаріти або змінитися. Усі твої дані на місці.',
    action: 'На дошку',
  },
} as const;
