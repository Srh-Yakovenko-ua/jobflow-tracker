import { type OAuthProvider, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@jobflow/shared';

export const auth = {
  login: { title: 'Увійти', submit: 'Увійти' },
  register: { title: 'Створити акаунт', submit: 'Створити акаунт' },
  tabsLabel: 'Вхід або реєстрація',
  email: {
    label: 'Email',
    placeholder: 'andrii@example.com',
    invalid: 'Вкажи пошту у форматі name@example.com',
    taken: 'Ця пошта вже зареєстрована. Увійди на вкладці «Увійти»',
  },
  password: {
    label: 'Пароль',
    hint: `Мінімум ${String(PASSWORD_MIN_LENGTH)} символів`,
    invalidNew: `Пароль має містити від ${String(PASSWORD_MIN_LENGTH)} до ${String(PASSWORD_MAX_LENGTH)} символів`,
    missing: 'Введи пароль',
  },
  or: 'АБО',
  oauth: {
    google: 'Продовжити з Google',
    github: 'Продовжити з GitHub',
  } satisfies Record<OAuthProvider, string>,
  privacy:
    'Твої відгуки, заметки й резюме видно тільки тобі. Тексти вакансій ідуть у модель для розбору; заметки — ніколи.',
  promise: {
    headline: ['Пошук роботи —', 'це воронка,', 'а не удача'],
    lead: '54 відгуки, 32 відмови, 17 тиш і один офер. JobFlow показує, де саме зникають можливості — і що з цим робити далі.',
    caption: 'приклад воронки за 12 тижнів',
  },
  alerts: {
    invalidCredentials: {
      title: 'Невірна пошта або пароль',
      description: 'Перевір обидва поля й спробуй ще раз.',
    },
    rateLimited: {
      title: 'Забагато спроб',
      retryIn: 'Спробуй знову через',
      later: 'Спробуй трохи пізніше.',
    },
    unavailable: {
      title: 'Сервер не відповідає',
      description: 'Це збій на нашому боці. Спробуй ще раз за хвилину.',
    },
    oauthDenied: {
      title: 'Вхід через Google або GitHub скасовано',
      description: 'Увійди поштою або спробуй ще раз.',
    },
  },
} as const;
