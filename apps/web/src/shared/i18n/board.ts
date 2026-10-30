import { countedUk, type PluralForms } from '@jobflow/shared';

const CARDS_IN_WORK = {
  one: 'карточка в роботі',
  few: 'карточки в роботі',
  other: 'карточок в роботі',
} as const satisfies PluralForms;

export const board = {
  title: 'Дошка',
  eyebrow: (inWork: number) => `активний пошук · ${countedUk(inWork, CARDS_IN_WORK)}`,
  firstRun: {
    title: 'Тут буде твоя воронка',
    hint: 'Почни з однієї вакансії, на яку вже відгукнувся цього тижня. Далі буде швидко: букмарклет додає карточку одним кліком зі сторінки вакансії.',
    footnote: "колонки «відмова» і «ghosted» з'являться, коли будуть потрібні",
  },
  finalNote: ['Тут буває тісно рідко.', 'Це нормально.'],
  columnEmpty: ['тут поки порожньо'],
} as const;
