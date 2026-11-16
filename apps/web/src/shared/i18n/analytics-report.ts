export const report = {
  title: 'Звіт про пошук роботи',
  eyebrow: 'звіт для ментора',
  link: 'Звіт для друку',
  print: 'Завантажити PDF',
  hideSalary: 'Приховати зарплати',
  today: 'сьогодні',
  hidden: 'приховано',
  currencyWords: /грн\.?|гривн\p{L}*|гривен\p{L}*|долар\p{L}*|євро/u,
  scaleWords: /к|тис\.?|тисяч\p{L}*/u,
  rangeWords: /до/u,
  insights: {
    eyebrow: 'висновки',
    title: 'Що показують дані',
    empty: 'Висновків за цей пошук ще немає.',
  },
} as const;
