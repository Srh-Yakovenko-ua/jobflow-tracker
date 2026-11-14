import {
  type MonthlySummaryInput,
  monthlySummaryInputSchema,
  type MonthlySummaryOutput,
  monthlySummaryOutputSchema,
} from '../src/ai/monthly-summary.js';

const DESIGN_INPUT: MonthlySummaryInput = {
  period: { month: '2026-08', name: 'серпень', previousName: 'липень' },
  activity: {
    sent: { month: 19, previousMonth: 15, change: 4 },
    interviews: { month: 5, previousMonth: 3, change: 2 },
    offers: { month: 1, previousMonth: 0, change: 1 },
    daysInSearch: 84,
  },
  funnel: [
    { stage: 'applied', reached: 54, passed: 17, conversionPercent: 43 },
    { stage: 'screening', reached: 17, passed: 9, conversionPercent: 60 },
    { stage: 'tech_interview', reached: 9, passed: 4, conversionPercent: 50 },
    { stage: 'final', reached: 4, passed: 1, conversionPercent: null },
    { stage: 'offer', reached: 1, passed: null, conversionPercent: null },
  ],
  reasons: [{ stage: 'tech_interview', code: 'skills_gap', count: 3, of: 4 }],
  sources: [
    { source: 'djinni', applications: 24, screenings: 9, conversionPercent: 45 },
    { source: 'dou', applications: 6, screenings: 2, conversionPercent: 40 },
    { source: 'linkedin', applications: 16, screenings: 2, conversionPercent: 22 },
    { source: 'referral', applications: 3, screenings: 3, conversionPercent: null },
    { source: 'company_site', applications: 2, screenings: 1, conversionPercent: null },
    { source: 'robota', applications: 3, screenings: 0, conversionPercent: null },
  ],
  resumeAb: {
    versions: [
      { number: 3, applications: 3, conversionPercent: null },
      { number: 2, applications: 27, conversionPercent: 41 },
      { number: 1, applications: 21, conversionPercent: 24 },
    ],
    switch: { number: 2, beforePercent: 24, afterPercent: 41 },
  },
  forecast: {
    status: 'ok',
    medianWeeks: 4,
    likelyLow: 2,
    likelyHigh: 9,
    applicationsPerWeek: 2,
    applications: 28,
    offers: 2,
  },
  whatIf: {
    stage: 'tech_interview',
    conversionPercent: 60,
    medianWeeks: 6,
    likelyLow: 4,
    likelyHigh: 12,
  },
  insights: [
    {
      title: 'Найширша втеча — на першому кроці',
      text: '21 відмова і 14 тиш із 54 — воронка закінчується там, де ти ще ні з ким не говорив.',
    },
    {
      title: "Техінтерв'ю — найдорожчий етап",
      text: 'Дійшло 9, пройшли 4. Кожна втрата тут — це 2–3 тижні вже витраченого часу.',
    },
    {
      title: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
      text: '3 із 4 відмов на цьому етапі — «не вистачає скілів».',
    },
    {
      title: "LinkedIn з'їдає час, рефералки — ні",
      text: '16 відгуків через LinkedIn дали 2 скринінги. Djinni при 24 — 9.',
    },
    {
      title: 'Схоже, CV v2 працює краще',
      text: 'Після переходу на CV v2 конверсія виросла з 24% до 41%.',
    },
    {
      title: '17 компаній не відповіли',
      text: 'Це 31% твоїх відгуків — на 9 п.п. більше за ринок.',
    },
  ],
  ruleActions: [
    {
      title: "Підготуватися до наступного техінтерв'ю",
      expectedEffect:
        'Прогноз офера звузиться до діапазону від 4 до 12 тижнів, якщо конверсія дійде до 60%.',
    },
    {
      title: 'Прибрати LinkedIn з рутини',
      expectedEffect: 'Ті самі 16 відгуків через Djinni дали б 6 скринінгів замість 2.',
    },
    {
      title: 'Попросити ще кілька рефералок',
      expectedEffect:
        '3 скринінги на 3 відгуки через рефералки. Вибірка мала, але напрям однозначний.',
    },
    {
      title: 'Відгукуватися з CV v2',
      expectedEffect: 'Конверсія у скринінг 41% проти 24% до переходу на CV v2.',
    },
  ],
  previousPlan: { items: 4, done: 3 },
};

const DESIGN_OUTPUT: MonthlySummaryOutput = {
  summary:
    "За серпень ти надіслав 19 відгуків, на 4 більше, ніж у липні. Конверсія у скринінг зросла з 24% до 41% після переходу на CV v2. Але з 9 техінтерв'ю ти пройшов 4, і в 3 з 4 відмов там причина одна: «не вистачає скілів». Далі об'єм відгуків уже не допоможе: воронка звужується не на вході. З минулого плану ти виконав 3 пункти з 4.",
  actions: [
    {
      title: "Два тижні алгоритмів перед техінтерв'ю",
      why: "3 з 4 відмов на техінтерв'ю: «не вистачає скілів», а пройшов ти 4 з 9.",
      expectedEffect: "Якщо конверсія техінтерв'ю дійде до 60%, прогноз офера: від 4 до 12 тижнів.",
      metric: "Конверсія техінтерв'ю: зараз 50%, ціль 60%",
    },
    {
      title: 'Прибрати LinkedIn Easy Apply',
      why: '16 відгуків через LinkedIn дали 2 скринінги, Djinni при 24 відгуках дав 9.',
      expectedEffect: 'Конверсія у скринінг через Djinni 45% проти 22% через LinkedIn.',
      metric: 'Частка відгуків через LinkedIn',
    },
    {
      title: 'Відгукуватися лише з CV v2',
      why: 'З CV v2 конверсія у скринінг 41%, з CV v1 була 24%.',
      expectedEffect: 'Конверсія у скринінг тримається на рівні 41%.',
      metric: 'Конверсія у скринінг за версією CV',
    },
    {
      title: 'Попросити 2 рефералки',
      why: 'Рефералки дали 3 скринінги на 3 відгуки.',
      expectedEffect: 'Більше скринінгів без нових холодних відгуків.',
      metric: 'Відгуки через рефералки',
    },
  ],
};

export function buildMonthlySummaryInput(): MonthlySummaryInput {
  return monthlySummaryInputSchema.parse(DESIGN_INPUT);
}

export function buildMonthlySummaryOutput(): MonthlySummaryOutput {
  return monthlySummaryOutputSchema.parse(DESIGN_OUTPUT);
}
