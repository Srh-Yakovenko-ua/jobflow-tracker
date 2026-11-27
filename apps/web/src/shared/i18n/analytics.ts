import { countedUk, pluralUk, THRESHOLDS } from '@jobflow/shared';

import { evidence } from './analytics-evidence';
import { applications, FORMS, type SourceCounts, sourceCounts } from './analytics-forms';
import { report } from './analytics-report';

const EYEBROW = 'аналітика воронки';

const MINUS = '−';

const signed = (value: number) => `${value > 0 ? '+' : MINUS}${String(Math.abs(value))}`;

const weeks = (count: number) => countedUk(count, FORMS.week);

const afterApplications = (goal: number) => `після ${countedUk(goal, FORMS.ofApplication)}`;

export type DataGoal = Readonly<{ goal: number; have: number }>;

export const analytics = {
  title: 'Аналітика',
  forms: FORMS,
  eyebrow: EYEBROW,
  eyebrowWeeks: (weeks: number) => `${EYEBROW} · ${countedUk(weeks, FORMS.week)}`,
  heading: 'Де ти втрачаєш можливості',
  search: {
    label: 'Пошук',
    current: 'поточний пошук',
    archived: 'архів',
    applications,
    period: (start: string, end: string) => `${start}–${end}`,
  },
  empty: {
    content: {
      eyebrow: 'Аналітика · 4 відгуки',
      title: 'Порахувати ще нічого',
      hint: `Перші висновки з'являться ${afterApplications(THRESHOLDS.MIN_N_INSIGHT)}, прогноз офера ${afterApplications(THRESHOLDS.MIN_N_FORECAST)}.`,
    },
  },
  noValue: '—',
  lowData: (...details: string[]) => ['мало даних', ...details].join(' · '),
  percent: (value: number) => `${String(value)}%`,
  summary: (caption: string, parts: readonly string[]) => `${caption}: ${parts.join(', ')}`,
  interval: {
    label: 'діапазон',
    range: (low: number, high: number) => `можливо ${String(low)}–${String(high)}%`,
  },
  small: { tag: 'мало даних', noise: 'Відсоток на такій вибірці лише шум.' },
  kpi: {
    sent: {
      label: 'Відгуків надіслано',
      change: signed,
      pace: (perWeek: string) => `${perWeek} на тиждень`,
    },
    screening: {
      label: 'Дійшли до скринінгу',
      of: (successes: number, trials: number) => `${String(successes)} із ${String(trials)}`,
    },
    response: { label: 'Медіана відповіді', threshold: (days: string) => `поріг тиші: ${days}` },
    ghost: {
      label: 'Частка ghosted',
      gap: (points: number) => `${signed(points)} п.п.`,
      market: (low: number, high: number) => `ринок: ${String(low)}–${String(high)}%`,
    },
  },
  blocks: {
    sankey: {
      eyebrow: 'головне · воронка цілком',
      title: (sent: number) => `Куди пішли всі ${applications(sent)}`,
      nodes: { in_progress: 'у процесі', other: 'інші' },
      split: 'розбити відмови за причинами',
      expand: 'показати всі причини',
      funnel: 'етапи воронки',
      biggestDrop: 'найбільша втрата',
      endings: 'чим закінчились',
      table: { caption: 'Воронка відгуків', from: 'звідки', to: 'куди', count: 'відгуків' },
      tooltip: {
        reached: (reached: number, passed: number) =>
          `дійшло ${String(reached)}, пройшло ${String(passed)}`,
        conversion: ({
          step,
          value,
          low,
          high,
        }: Readonly<Record<'value' | 'low' | 'high', number> & { step: string }>) =>
          `конверсія ${step}: ${String(value)}% (${String(low)}–${String(high)}%)`,
        ghost: 'не входить у розрахунок конверсій',
      },
      notes: { label: 'Висновки про воронку', lead: (title: string) => `${title}.` },
      ghost: {
        lead: 'Сіра гілка: ghosted.',
        body: (companies: number) =>
          `${countedUk(companies, FORMS.company)} ${pluralUk(companies, FORMS.silent)}. ${pluralUk(companies, FORMS.excluded)} у розрахунок конверсій.`,
      },
    },
    reasons: {
      eyebrow: 'причини відмов за етапами',
      fallback: 'Де відмовляють найчастіше',
      sides: { company: 'компанія', candidate: 'ти' },
      table: {
        caption: 'Причини відмов за етапами',
        stage: 'етап',
        side: 'сторона',
        reason: 'причина',
        count: 'відмов',
        share: 'частка',
      },
      tooltip: {
        title: (stage: string, side: string) => `${stage} · ${side}`,
        count: (reason: string, count: number) => `${reason}: ${String(count)}`,
        share: (percent: string) => `${percent} відмов етапу`,
      },
      empty: {
        title: 'Причин ще немає',
        hint: "Тут з'являться відмови, для яких указано причину.",
      },
    },
    sources: {
      eyebrow: 'конверсія за джерелами',
      fallback: 'Яке джерело працює',
      step: 'у скринінг',
      counts: sourceCounts,
      table: {
        caption: 'Конверсія за джерелами',
        source: 'джерело',
        applications: 'відгуків',
        screenings: 'скринінгів',
        conversion: 'конверсія у скринінг',
      },
      small: {
        line: ({ label, ...counts }: SourceCounts & Readonly<{ label: string }>) =>
          `${label}: ${sourceCounts(counts)}.`,
      },
      empty: {
        title: 'Джерел ще немає',
        hint: "Тут з'явиться конверсія кожного майданчика, звідки ти відгукуєшся.",
      },
    },
    ...evidence,
    forecast: {
      eyebrow: 'прогноз офера',
      span: (low: number, high: number) => `${String(low)}–${weeks(high)}`,
      weeks,
      beyond: (count: number) => `понад ${weeks(count)}`,
      openEnd: ({ low, horizon }: Readonly<{ low: number; horizon: number }>) =>
        `від ${String(low)} до понад ${String(horizon)} ${FORMS.week.other}`,
      fraction: (value: string) => `${value} ${FORMS.weekFraction.other}`,
      caption: ({ pace, improved }: Readonly<{ pace: string; improved: boolean }>) =>
        `Темп ${pace} на тиждень, ${improved ? "техінтерв'ю 60%" : 'поточні конверсії'}.`,
      legend: {
        likely: (span: string) => `ймовірний коридор ${span}`,
        interval: (span: string) => `увесь 80% діапазон: ${span}`,
        median: (value: string) => `медіана: ${value}`,
      },
      odds: (four: string, eight: string) => `Офер за 4 тижні: ${four}, за 8 тижнів: ${eight}`,
      note: ({ applications: sent, offers }: Readonly<Record<'applications' | 'offers', number>>) =>
        `Дані: ${applications(sent)} і ${countedUk(offers, FORMS.offer)}.`,
      ticks: {
        start: '0',
        weeks: (count: number) => `${String(count)} тиж`,
        end: (count: number) => `${String(count)}+`,
      },
      rate: { label: 'Відгуків на тиждень', value: (pace: string) => `${pace} на тиждень` },
      tech: "Якщо конверсія техінтерв'ю дійде до 60%",
      method: {
        label: 'Як рахується прогноз',
        title: '10 000 симуляцій на твоїх даних',
        body: [
          'Прогноз бере твій темп і конверсії етапів, 10 000 разів розігрує пошук і дивиться, коли приходить офер.',
          'Суцільна смуга це ймовірний коридор, половина симуляцій. Смугаста це 80% діапазон, 8 симуляцій із 10.',
        ],
      },
      empty: {
        title: (missing: number) => `Ще ${applications(missing)} до прогнозу`,
        meter: 'Прогрес до прогнозу',
      },
    },
  },
  whatToDo: { eyebrow: 'що зробити', list: 'Що зробити далі' },
  report,
  lowDataState: {
    firstWeek: 'перший тиждень',
    week: (week: number) => `тиждень ${String(week)} пошуку`,
    screening: {
      label: 'Конверсія у скринінг',
      when: ({ goal, have }: DataGoal) =>
        `З'явиться ${afterApplications(goal)}. Зараз ${String(have)}.`,
    },
    forecast: {
      label: 'Прогноз офера',
      when: ({ goal, have }: DataGoal) =>
        `Прогноз з'явиться ${afterApplications(goal)}. Зараз ${String(have)}.`,
    },
    action: {
      title: 'Що зараз корисніше за аналітику',
      body: ({ goal, have }: DataGoal) =>
        `Додай ще ${applications(goal - have)}, і ${afterApplications(goal)} аналітика ввімкнеться сама.`,
      cta: 'Додати вакансію',
    },
  },
} as const;
