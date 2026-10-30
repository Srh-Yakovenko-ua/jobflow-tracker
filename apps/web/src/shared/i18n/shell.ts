import { countedUk, type PluralForms } from '@jobflow/shared';

const SILENT_CARDS = {
  one: 'тиха картка',
  few: 'тихі картки',
  other: 'тихих карток',
} as const satisfies PluralForms;

export const shell = {
  nav: {
    board: 'Дошка',
    analytics: 'Аналітика',
    calendar: 'Календар',
    resumes: 'Резюме',
    reminders: 'Нагадування',
    settings: 'Налаштування',
  },
  navLabel: 'Навігація',
  bottomNavLabel: 'Навігація внизу екрана',
  skipToContent: 'Перейти до вмісту',
  collapse: 'Згорнути меню',
  expand: 'Розгорнути меню',
  silentBadge: (count: number) => countedUk(count, SILENT_CARDS),
  addApplication: 'Додати вакансію',
  userMenu: 'Меню користувача',
  logout: {
    label: 'Вийти',
    failed: {
      title: 'Не вдалося вийти',
      description: "Ти досі в акаунті. Перевір з'єднання і спробуй ще раз.",
    },
  },
  search: {
    label: 'Пошук вакансій',
    results: 'Знайдені вакансії',
    placeholder: 'компанія або посада',
    loading: 'Шукаю…',
    error: 'Пошук не вдався',
    retry: 'Спробувати ще раз',
  },
} as const;
