export const interviewPrep = {
  title: 'Підготовка',
  idle: 'AI збере ймовірні теми, питання й план. Нотаток він не бачить.',
  request: 'Підготувати до співбесіди',
  waiting: 'Можеш закрити картку: підготовка зʼявиться тут.',
  failed: {
    timeout: 'AI не відповів за 30 секунд.',
    other: 'Підготовка не вийшла.',
  },
  unbuildable:
    'Для підготовки потрібна запланована співбесіда і вимоги або Match Score у вакансії.',
  topicsTitle: 'Ймовірні теми',
  why: {
    trigger: 'Чому ця тема?',
    of: (topic: string) => `Чому ця тема? ${topic}`,
    source: { weakSpot: 'Слабке місце з аналітики', requirement: 'Вимога вакансії' },
  },
  questionsTitle: 'Питання для практики',
  questions: { show: 'Показати питання для практики', hide: 'Сховати питання для практики' },
  hint: (hint: string) => `Підказка: ${hint}`,
  asked: {
    title: 'Що питали?',
    save: 'Зберегти',
    skip: 'Пропустити',
    note: (labels: readonly string[]) => `Що питали: ${labels.join(', ')}`,
  },
  askCompanyTitle: 'Що спитати в компанії',
  plans: {
    label: 'Тривалість плану',
    options: { plan30: '30 хв', plan120: '2 год' },
    title: { plan30: 'План на 30 хвилин', plan120: 'План на 2 години' },
  },
  minutes: (minutes: number) => `${String(minutes)} хв`,
} as const;
