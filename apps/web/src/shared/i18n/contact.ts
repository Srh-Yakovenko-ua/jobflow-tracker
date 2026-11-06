export const contact = {
  kicker: 'Рекрутер',
  edit: 'Редагувати рекрутера',
  summary: (parts: readonly string[]) => parts.join(', '),
  rows: { email: 'email', telegram: 'telegram', response: 'відповідає за' },
  responseHours: (hours: number) => `~${String(hours)} год`,
  copy: { email: 'Скопіювати email', telegram: 'Скопіювати telegram' },
  add: 'Додати рекрутера',
  suggestions: 'Контакти з інших відгуків',
  fields: { name: "Ім'я", role: 'Роль', email: 'Email', telegram: 'Telegram' },
  errors: {
    name: "Вкажи ім'я одним коротким рядком",
    role: 'Роль одним коротким рядком',
    email: 'Пошта у форматі name@company.com',
    telegram: 'Нік із 5–32 латинських літер, цифр або _, без посилання',
  },
} as const;
