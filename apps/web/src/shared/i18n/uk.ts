import type { Theme } from '@jobflow/shared';

import { application } from './application';
import { devUi } from './dev-ui';
import { shell } from './shell';
import { states } from './states';

export const uk = {
  locale: 'uk-UA',
  app: {
    brand: 'JobFlow',
    title: 'JobFlow · трекер пошуку роботи',
    notifications: 'Сповіщення',
    close: 'Закрити',
  },
  ui: {
    clear: 'Скинути',
    clearAll: 'Скинути все',
    remove: 'Прибрати',
    addOption: (query: string) => `+ додати «${query}»`,
    noMatches: 'Немає збігів',
    loading: 'Завантаження…',
    decrease: 'Зменшити',
    increase: 'Збільшити',
    navigate: 'навігація',
    select: 'обрати',
    ofTotal: 'із',
    keys: { navigate: '↑↓', select: '↵' },
    theme: 'Тема',
  },
  theme: { light: 'Світла', dark: 'Темна', system: 'Системна' } satisfies Record<Theme, string>,
  devUi,
  application,
  states,
  shell,
  errors: {
    saveFailed: {
      title: 'Не вдалося зберегти',
      description: 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.',
    },
  },
  auth: {
    login: { title: 'Увійти' },
    register: { title: 'Створити акаунт' },
  },
  board: {
    title: 'Дошка',
  },
  designSystem: {
    pageTitle: 'Дизайн-система',
    typography: {
      index: '02',
      title: 'Типографіка',
      display: {
        eyebrow: 'дисплей',
        family: 'Unbounded · OFL',
        headline: ['Воронка', 'пошуку'],
        score: '78 / 100',
        note: 'Геометричний дисплей українського походження з питомою кирилицею, не латиниця з домальованими літерами. Дає системі власне обличчя і тримає великі цифри аналітики. Тільки 500–700 і тільки від 24px.',
      },
      ui: {
        eyebrow: 'інтерфейс',
        family: 'Onest · OFL',
        headline: "Технічне інтерв'ю",
        subline: 'Середній час на етапі: 9 днів',
        lead: 'Розмір 14–17 тримає щільні списки й довгі українські лейбли без переносів.',
        note: 'Кирилиця спроєктована разом з латиницею, є tabular-nums і 300–700. Мікролейбли, той самий Onest 600 у капіталізації з трекінгом .14em: третій шрифт системі не потрібен.',
      },
    },
    scale: {
      index: '03',
      title: 'Шкала, типографіка, шари',
      eyebrow: 'роль → значення',
    },
    typeSamples: {
      num: '54',
      display: 'Заголовок',
      title: 'Підзаголовок',
      'body-l': 'Основний текст',
      body: 'Текст інтерфейсу',
      label: 'Лейбл поля',
      caption: 'Підпис до поля',
      eyebrow: 'Надрядок',
    },
    checks: {
      focusEyebrow: 'фокус 2+2',
      link: 'Посилання до типографіки',
      button: 'Кнопка',
      motionEyebrow: 'рух',
      motionNote:
        'Ховер тіні 180 мс, пульс даних 820 мс. З prefers-reduced-motion усі тривалості 0.',
    },
    darkTheme: {
      index: '04',
      title: 'Темна тема',
      surfacesEyebrow: 'поверхні',
      note: 'База тепла, не сине-сіра. Тіней немає — ієрархію тримає світлість поверхонь і акцентні ореоли. Акцент піднімається до 72% L, щоб тримати контраст на темному.',
    },
  },
} as const;
