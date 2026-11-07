import { countedUk, type PluralForms } from '@jobflow/shared';

const CARDS = {
  one: 'картка',
  few: 'картки',
  other: 'карток',
} as const satisfies PluralForms;

const CARDS_TAKEN = {
  one: 'картку',
  few: 'картки',
  other: 'карток',
} as const satisfies PluralForms;

const columns = {
  vacancy: { header: 'вакансія', menu: 'Вакансія' },
  stage: { header: 'етап', menu: 'Етап' },
  score: { header: 'score', menu: 'Match Score' },
  salary: { header: 'вилка', menu: 'Вилка' },
  source: { header: 'джерело', menu: 'Джерело' },
  appliedAt: { header: 'відгук', menu: 'Дата відгуку' },
  lastEventAt: { header: 'остання подія', menu: 'Остання подія' },
  daysInStage: { header: 'днів', menu: 'Днів на етапі' },
} as const;

const csv = {
  button: 'CSV',
  label: 'Завантажити CSV з поточним поданням',
  header: {
    company: 'Компанія',
    position: 'Посада',
    salaryFrom: 'Зарплата від',
    salaryTo: 'Зарплата до',
    currency: 'Валюта',
  },
} as const;

const bulk = {
  label: 'Дії з обраними картками',
  picked: (count: number) => `${countedUk(count, CARDS_TAKEN)} обрано`,
  next: 'Перенести далі',
  withdraw: 'Відкликати',
  clear: 'Скинути вибір',
  confirm: {
    title: (count: number) => `Відкликати ${countedUk(count, CARDS_TAKEN)}?`,
    description:
      'Етап «відкликав» остаточний, повернути картку з нього не вийде. Картки, які вже закриті, лишаться як є.',
    cancel: 'Скасувати',
    confirm: 'Відкликати',
  },
} as const;

export const applicationsTable = {
  title: 'Таблиця',
  label: 'Вакансії в таблиці',
  search: { label: 'Пошук у таблиці', placeholder: 'компанія, роль, стек…' },
  columns,
  columnsMenu: { trigger: 'Колонки', label: 'Видимі колонки' },
  select: {
    all: 'Обрати всі картки',
    row: (company: string) => `Обрати «${company}»`,
  },
  sortRank: (rank: number) => `, ключ сортування ${String(rank)}`,
  noValue: '—',
  days: (count: number) => `${String(count)} дн`,
  csv,
  bulk,
  total: (count: number) => `усього ${countedUk(count, CARDS)}`,
} as const;
