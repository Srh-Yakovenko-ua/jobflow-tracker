import type { ExportFormat } from '@jobflow/shared';

const STAYS = 'Акаунт і дані на місці.';

export const settingsAccount = {
  title: 'Акаунт',
  name: "Ім'я",
  email: 'Пошта',
  logoutEverywhere: {
    title: 'Вийти на всіх пристроях',
    description:
      'Завершує всі сесії, і цю теж, та вимикає букмарклет. Увійти знову можна будь-коли.',
    action: 'Вийти на всіх пристроях',
  },
  export: {
    title: 'Вивантажити дані',
    description:
      'Вакансії, історія етапів з причинами відмов, контакти, нотатки й дані резюме одним архівом.',
    formatLabel: 'Формат архіву',
    formats: { json: 'JSON', csv: 'CSV' } satisfies Record<ExportFormat, string>,
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
      body: 'Зникнуть усі вакансії, історія етапів, контакти, нотатки, резюме з файлами, нагадування й AI-результати. Відновити їх не вийде.',
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
