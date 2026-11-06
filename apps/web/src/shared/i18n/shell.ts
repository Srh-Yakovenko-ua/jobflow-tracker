import { countedUk, type PluralForms } from '@jobflow/shared';

const SILENT_CARDS = {
  one: 'тиха картка',
  few: 'тихі картки',
  other: 'тихих карток',
} as const satisfies PluralForms;

const PALETTE_ACTIONS = {
  add: 'Додати вакансію',
  paste: 'Вставити текст вакансії',
  move: 'Перемістити в…',
  followUp: 'Згенерувати фоллоу-ап',
  analytics: 'Відкрити аналітику',
  theme: 'Перемкнути тему',
  shortcuts: 'Гарячі клавіші',
} as const;

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
  palette: {
    title: 'Палітра команд',
    label: 'Вакансії, сторінки й дії',
    placeholder: 'Вакансія, сторінка або дія',
    movePlaceholder: (company: string) => `Куди перемістити ${company}?`,
    groups: {
      recent: 'Недавні',
      applications: 'Вакансії',
      pages: 'Сторінки',
      actions: 'Дії',
      stages: 'Етапи',
    },
    actions: PALETTE_ACTIONS,
    density: { compactOn: 'Щільний режим', fullOn: 'Повний режим' },
    close: 'закрити',
    back: 'назад',
  },
  shortcuts: {
    title: PALETTE_ACTIONS.shortcuts,
    then: 'потім',
    palette: 'Палітра команд',
    search: 'Пошук вакансій',
    items: {
      add: PALETTE_ACTIONS.add,
      board: 'Відкрити дошку',
      analytics: PALETTE_ACTIONS.analytics,
      reminders: 'Відкрити нагадування',
      shortcuts: PALETTE_ACTIONS.shortcuts,
    },
  },
} as const;
