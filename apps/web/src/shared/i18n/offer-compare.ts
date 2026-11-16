import { countedUk, type PluralForms } from '@jobflow/shared';

const MISSING_OFFERS = {
  one: 'офера',
  few: 'оферів',
  other: 'оферів',
} as const satisfies PluralForms;

const outOfFive = (value: number) => `${String(value)} з 5`;

export const offerCompare = {
  title: 'Порівняння оферів',
  printTitle: 'Порівняння оферів для друку',
  lead: 'Офери поруч: гроші, стек, формат, ріст і стабільність. Нотатки й позначки зберігаються лише на цьому пристрої.',
  ranking: 'Офери за балом',
  leader: (company: string) => `Перше місце: ${company}`,
  weights: {
    title: 'Наскільки для тебе важливо',
    criteria: {
      money: 'Гроші',
      stack: 'Стек',
      format: 'Формат',
      growth: 'Ріст',
      stability: 'Стабільність',
    },
    value: outOfFive,
    preferredMode: 'Бажаний формат',
    note: 'Бал допомагає зважити офери, але рішення ухвалюєш ти.',
  },
  column: {
    rank: (rank: number) => `№${String(rank)}`,
    score: 'бал',
    noScore: '—',
    salary: 'Зарплата',
    usdNet: (amount: string) => `$${amount} нетто на місяць`,
    notConverted: 'не перераховано',
    workMode: 'Формат',
    location: 'Локація',
    matchScore: 'Match Score',
    unknown: '—',
    notes: 'Команда і продукт',
    benefits: 'Бенефіти',
    benefit: {
      equipment: 'Техніка для роботи',
      education: 'Бюджет на навчання',
      medical: 'Медичне страхування',
      vacation: 'Оплачувана відпустка',
    },
    noBenefits: 'нічого не відмічено',
    growthNote: 'Коментар про ріст',
    growthRating: 'Оцінка росту',
    rating: outOfFive,
  },
  empty: {
    eyebrow: 'порівняння оферів',
    title: (missing: number) => `Бракує ще ${countedUk(missing, MISSING_OFFERS)}`,
    hint: 'Порівняння відкривається, коли на дошці щонайменше 2 картки на етапі «офер».',
    meter: 'Офери на дошці',
    toBoard: 'До дошки',
  },
  toolbar: { toPrint: 'Версія для друку', back: 'До порівняння', print: 'Друкувати' },
} as const;
