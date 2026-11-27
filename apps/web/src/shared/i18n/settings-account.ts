import type { ExportFormat } from '@jobflow/shared';

const STAYS = 'Акаунт і дані на місці.';

export const settingsAccount = {
  title: 'Акаунт',
  name: "Ім'я",
  email: 'Пошта',
  logoutEverywhere: {
    title: 'Вийти на всіх пристроях',
    description: 'Виходить на всіх пристроях, і на цьому теж, та вимикає букмарклет.',
    action: 'Вийти на всіх пристроях',
    dialog: {
      title: 'Вийти на всіх пристроях?',
      body: 'Букмарклет теж перестане працювати.',
      cancel: 'Скасувати',
      confirm: 'Вийти всюди',
    },
  },
  export: {
    title: 'Вивантажити дані',
    description: 'Вакансії, етапи й причини відмов, контакти, нотатки й резюме одним архівом.',
    formatLabel: 'Формат архіву',
    formats: { json: 'JSON для програм', csv: 'CSV для Excel' } satisfies Record<
      ExportFormat,
      string
    >,
    action: 'Вивантажити',
    building: 'Збираю архів…',
    gone: 'Цього архіву вже немає. Вивантаж дані ще раз.',
    download: 'Завантажити архів',
    linkTtl: 'Посилання діє годину.',
    failed: {
      title: 'Не вдалося почати вивантаження',
      description: "Дані на місці. Перевір з'єднання і спробуй ще раз.",
    },
  },
  import: {
    title: 'Імпорт з таблиці',
    description: 'Перенеси відгуки з Google Sheets чи Excel через файл CSV.',
    action: 'Імпортувати CSV',
  },
  deletion: {
    title: 'Видалити акаунт',
    description: 'Спершу вивантажимо всі твої дані, потім попросимо підтвердити.',
    action: 'Видалити акаунт',
    dialog: {
      title: 'Видалити акаунт назавжди?',
      body: 'Зникнуть вакансії, контакти, нотатки, резюме й нагадування. Відновити їх не вийде.',
      exportOffer: 'Спершу збережи архів зі своїми даними.',
      password: 'Пароль',
      passwordHint: 'Входиш через Google чи GitHub? Введи пошту свого акаунта.',
      wrongPassword: 'Не підходить. Для входу через Google чи GitHub введи пошту акаунта.',
      cancel: 'Скасувати',
      confirm: 'Видалити акаунт',
      failed: {
        title: 'Не вдалося видалити акаунт',
        description: `${STAYS} Спробуй ще раз за хвилину.`,
      },
    },
  },
} as const;
