import type { WorkMode } from '@jobflow/shared';

const ROLES = {
  middle: {
    position: 'Middle Frontend Developer',
    stack: ['React', 'TypeScript', 'Redux Toolkit'],
  },
  react: { position: 'React Developer', stack: ['React', 'TypeScript', 'TanStack Query'] },
  next: { position: 'Frontend Engineer', stack: ['Next.js', 'React', 'TypeScript'] },
  vue: { position: 'Frontend Developer (Vue)', stack: ['Vue 3', 'TypeScript', 'Pinia'] },
  angular: { position: 'Frontend Developer (Angular)', stack: ['Angular', 'RxJS', 'TypeScript'] },
  fullstack: {
    position: 'Full-stack Developer (React, Node.js)',
    stack: ['React', 'Node.js', 'PostgreSQL'],
  },
  design: {
    position: 'Frontend Developer (Design System)',
    stack: ['React', 'Storybook', 'Figma', 'CSS'],
  },
  ui: { position: 'UI Engineer', stack: ['React', 'CSS', 'Motion', 'Figma'] },
} as const;

type Role = keyof typeof ROLES;

const ROWS = [
  ['Kvit Software', 'middle', 'remote'],
  ['Bereza Labs', 'react', 'remote'],
  ['Zoria Tech', 'next', 'remote'],
  ['Vela Interactive', 'middle', 'hybrid'],
  ['Stepove Digital', 'react', 'remote'],
  ['Kalynove Systems', 'angular', 'office'],
  ['Sych Analytics', 'middle', 'remote'],
  ['Leleka Cloud', 'next', 'hybrid'],
  ['Dzherelo Soft', 'vue', 'remote'],
  ['Hornytsia Studio', 'react', 'hybrid'],
  ['Polyn Data', 'middle', 'remote'],
  ['Kryzhan Apps', 'react', 'remote'],
  ['Smereka Works', 'vue', 'hybrid'],
  ['Veselka Code', 'middle', 'remote'],
  ['Chumakivskyi Shliakh Tech', 'fullstack', 'office'],
  ['Zhuravel Vision', 'next', 'remote'],
  ['Kobza Media', 'react', 'hybrid'],
  ['Lystopad Labs', 'middle', 'remote'],
  ['Vyshyvanka Commerce', 'next', 'remote'],
  ['Pasika Health', 'react', 'hybrid'],
  ['Svitanok Fintech', 'middle', 'remote'],
  ['Dovbush Games', 'react', 'remote'],
  ['Tavria Mobility', 'next', 'hybrid'],
  ['Kozhumiaka Security', 'angular', 'office'],
  ['Vatra Retail', 'middle', 'remote'],
  ['Polonyna Cloud', 'vue', 'remote'],
  ['Inhul Robotics', 'fullstack', 'hybrid'],
  ['Mlynok Foods Digital', 'react', 'remote'],
  ['Kashtan Payments', 'middle', 'hybrid'],
  ['Bandurka Sound', 'react', 'remote'],
  ['Yasen Platform', 'next', 'remote'],
  ['Oberih Software', 'react', 'hybrid'],
  ['Dubrava Systems', 'middle', 'remote'],
  ['Topolia Labs', 'next', 'remote'],
  ['Lavanda Design Systems', 'design', 'remote'],
  ['Hrim Logistics', 'middle', 'office'],
  ['Krynytsia Data', 'react', 'remote'],
  ['Shpak Mobile', 'next', 'hybrid'],
  ['Kalamar Edu', 'vue', 'remote'],
  ['Medoid Tech', 'middle', 'remote'],
  ['Voloshka Ventures', 'react', 'hybrid'],
  ['Bystrytsia Soft', 'angular', 'remote'],
  ['Prylutskyi Digital Works', 'middle', 'remote'],
  ['Hai Zelenyi Tech', 'fullstack', 'hybrid'],
  ['Synii Kit Studio', 'react', 'remote'],
  ['Shypshyna Apps', 'next', 'remote'],
  ['Ruta Media Lab', 'middle', 'hybrid'],
  ['Holub Mail Tech', 'react', 'remote'],
  ['Malva Product', 'vue', 'remote'],
  ['Teplo Home Tech', 'ui', 'remote'],
  ['Ozero Analytics', 'design', 'hybrid'],
  ['Vitryla Design', 'ui', 'remote'],
  ['Bdzhilka Commerce', 'design', 'remote'],
  ['Pryvit Pixel Craft', 'ui', 'hybrid'],
] as const satisfies readonly (readonly [string, Role, WorkMode])[];

const LIVE_CODING_NOTES: Partial<Record<number, string>> = {
  9: 'Технічка з live coding: дебаунс пошуку на React за 30 хвилин. Встиг, але без тестів. Після цього тиша.',
  20: 'Live coding на 45 хвилин: кастомний хук для пагінації. Застряг на скасуванні запиту, треба підтягнути AbortController.',
  21: 'Live coding: таблиця з сортуванням і фільтром без бібліотек. Зауважили, що мало знаю про мемоізацію.',
  22: 'Технічне інтерв’ю з live coding у CodeSandbox: форма з валідацією. Попросили ще задачу на алгоритми, її не довів.',
  30: 'Live coding англійською: event loop і проміси. Код написав, але пояснювати рішення англійською було важко.',
  31: 'Live coding пройшов спокійно: компонент автокомпліту з клавіатурною навігацією. Наступний крок: фінал з CTO.',
  32: 'Live coding з тимлідом: рефакторинг класового компонента в хуки. На фіналі сказали, що офіс п’ять днів на тиждень.',
  33: 'Технічка з live coding: drag and drop списку на чистому TypeScript. На фіналі насторожили переробки і хаос у процесах.',
  34: 'Live coding по дизайн-системі: токени в CSS змінних і Storybook. Фінал позаду, чекаю на рішення.',
};

export type DemoApplicationText = {
  company: string;
  position: string;
  stack: readonly string[];
  workMode: WorkMode;
  liveCodingNote: string | null;
};

export const DEMO_APPLICATION_TEXTS: readonly DemoApplicationText[] = ROWS.map(
  ([company, role, workMode], index) => ({
    company,
    ...ROLES[role],
    workMode,
    liveCodingNote: LIVE_CODING_NOTES[index] ?? null,
  }),
);
