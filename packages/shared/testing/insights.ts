import type {
  Insight,
  InsightAction,
  InsightsResponse,
} from '../src/schemas/analytics-insights.js';

const DESIGN_INSIGHTS: Insight[] = [
  {
    block: 'funnel',
    title: 'Найширша втеча — на першому кроці',
    body: '21 відмова і 14 тиш із 54 — воронка закінчується там, де ти ще ні з ким не говорив.',
    severity: 'neutral',
    evidence: { stage: 'applied', reached: 54, rejected: 21, ghosted: 14 },
  },
  {
    block: 'funnel',
    title: "Техінтерв'ю — найдорожчий етап",
    body: 'Дійшло 9, пройшли 4. Кожна втрата тут — це 2–3 тижні вже витраченого часу.',
    severity: 'warning',
    evidence: {
      stage: 'tech_interview',
      reached: 9,
      passed: 4,
      lost: 5,
      investedDaysMedian: 17,
    },
  },
  {
    block: 'reasons',
    title: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
    body: '3 із 4 відмов на цьому етапі — «не вистачає скілів».',
    severity: 'warning',
    evidence: { stage: 'tech_interview', code: 'skills_gap', count: 3, of: 4 },
  },
  {
    block: 'sources',
    title: "LinkedIn з'їдає час, рефералки — ні",
    body: '16 відгуків через LinkedIn дали 2 скринінги. Djinni при 24 — 9.',
    severity: 'warning',
    evidence: {
      weak: 'linkedin',
      weakApplications: 16,
      weakScreenings: 2,
      strong: 'referral',
      strongApplications: 3,
      strongScreenings: 3,
      comparison: 'djinni',
      comparisonApplications: 24,
      comparisonScreenings: 9,
    },
  },
  {
    block: 'resume_ab',
    title: 'Схоже, CV v2 працює краще',
    body: 'Після переходу на CV v2 конверсія виросла з 24% до 41%.',
    severity: 'positive',
    evidence: { challenger: 2, baseline: 1, beforePercent: 24, afterPercent: 41 },
  },
  {
    block: 'ghosted',
    title: '17 компаній не відповіли',
    body: 'Це 31% твоїх відгуків — на 9 п.п. більше за ринок.',
    severity: 'neutral',
    evidence: {
      ghosted: 17,
      applications: 54,
      sharePercent: 31,
      position: 'above',
      gapPoints: 9,
    },
  },
];

const DESIGN_ACTIONS: InsightAction[] = [
  {
    block: 'funnel',
    title: "Підготуватися до наступного техінтерв'ю",
    expectedEffect:
      'Прогноз офера звузиться до діапазону від 4 до 12 тижнів, якщо конверсія дійде до 60%.',
  },
  {
    block: 'sources',
    title: 'Прибрати LinkedIn з рутини',
    expectedEffect: 'Ті самі 16 відгуків через Djinni дали б 6 скринінгів замість 2.',
  },
  {
    block: 'sources',
    title: 'Попросити ще кілька рефералок',
    expectedEffect:
      '3 скринінги на 3 відгуки через рефералки. Вибірка мала, але напрям однозначний.',
  },
  {
    block: 'resume_ab',
    title: 'Відгукуватися з CV v2',
    expectedEffect: 'Конверсія у скринінг 41% проти 24% до переходу на CV v2.',
  },
];

export function designInsightsBody(): InsightsResponse {
  return {
    insights: DESIGN_INSIGHTS.map((insight) => ({ ...insight, evidence: { ...insight.evidence } })),
    actions: DESIGN_ACTIONS.map((action) => ({ ...action })),
  };
}
