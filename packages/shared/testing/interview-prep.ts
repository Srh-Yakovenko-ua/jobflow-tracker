import {
  type InterviewPrepInput,
  interviewPrepInputSchema,
  type InterviewPrepOutput,
} from '../src/ai/interview-prep.js';

export const INTERVIEW_PREP_INPUT: InterviewPrepInput = interviewPrepInputSchema.parse({
  position: 'Senior React developer',
  interviewKind: 'tech_interview',
  requirements: ['React + TypeScript', 'Node.js у проді', 'AWS / інфраструктура', 'GraphQL'],
  gaps: [
    { name: 'AWS / інфраструктура', coverage: 'missing' },
    { name: 'GraphQL', coverage: 'partial' },
  ],
  weakSpots: {
    reasons: [{ stage: 'tech_interview', code: 'skills_gap', count: 3 }],
    topics: ['algorithms', 'live_coding'],
  },
});

const PRACTICE_TOPICS = [
  'React',
  'TypeScript',
  'GraphQL',
  'AWS',
  'Node.js',
  'алгоритми',
  'live coding',
  'тести',
  'кешування',
  'рев’ю коду',
];

const question = (topic: string) => ({
  question: `Розкажи, як ти підходиш до задачі на ${topic}?`,
  hint: 'Почни з обмежень задачі, назви складність рішення і чесно скажи, що перевіриш тестом.',
});

export const INTERVIEW_PREP_OUTPUT: InterviewPrepOutput = {
  topics: [
    {
      name: 'React + TypeScript',
      why: 'Основний стек вакансії, на техінтерв’ю його перевіряють першим.',
      basis: 'React + TypeScript',
    },
    {
      name: 'Алгоритми',
      why: "Три відмови на техінтерв'ю через скіли, і нотатки згадують алгоритми.",
      basis: 'algorithms',
    },
    {
      name: 'Live coding',
      why: 'Повторюється у твоїх слабких місцях, варто потренувати вголос.',
      basis: 'live_coding',
    },
    {
      name: 'AWS',
      why: 'Вакансія просить AWS, а в CV його немає.',
      basis: 'AWS / інфраструктура',
    },
    {
      name: 'GraphQL',
      why: 'Вимога вакансії, у CV покрита частково.',
      basis: 'GraphQL',
    },
  ],
  questions: PRACTICE_TOPICS.map(question),
  askCompany: [
    'Як виглядає перший місяць у команді?',
    'Хто рев’юїть код і як швидко?',
    'Яка частка часу йде на підтримку, а яка на нові фічі?',
  ],
  plan30: [
    { minutes: 15, task: 'Пройди дві задачі на масиви вголос.' },
    { minutes: 15, task: 'Перечитай вимоги вакансії і підготуй приклад з React.' },
  ],
  plan120: [
    { minutes: 45, task: 'Розв’яжи три задачі на алгоритми з таймером.' },
    { minutes: 45, task: 'Зроби маленький GraphQL-запит у пет-проєкті.' },
    { minutes: 30, task: 'Прочитай огляд сервісів AWS, які згадує вакансія.' },
  ],
};
