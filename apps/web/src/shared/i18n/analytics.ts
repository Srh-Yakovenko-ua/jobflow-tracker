import { countedUk, type PluralForms, pluralUk } from '@jobflow/shared';

const FORMS = {
  application: { one: 'відгук', few: 'відгуки', other: 'відгуків' },
  screening: { one: 'скринінг', few: 'скринінги', other: 'скринінгів' },
  week: { one: 'тиждень', few: 'тижні', other: 'тижнів' },
  company: { one: 'компанія', few: 'компанії', other: 'компаній' },
  silent: { one: 'не відповіла', other: 'не відповіли' },
  excluded: { one: 'Вона не входить', other: 'Вони не входять' },
} as const satisfies Record<string, PluralForms>;

const EYEBROW = 'аналітика воронки';

const MINUS = '−';

const signed = (value: number) => `${value > 0 ? '+' : MINUS}${String(Math.abs(value))}`;

const applications = (count: number) => countedUk(count, FORMS.application);

const sourceCounts = ({ applied, screened }: SourceCounts) =>
  `${applications(applied)}, ${countedUk(screened, FORMS.screening)}`;

export type SourceCounts = Readonly<{ applied: number; screened: number }>;

export const analytics = {
  title: 'Дашборд аналітики',
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
      hint: "Перші висновки з'являються з 10 відгуків, прогноз офера з 15. До того аналітика показувала б випадковість.",
    },
  },
  noValue: '—',
  lowData: (...details: string[]) => ['мало даних', ...details].join(' · '),
  percent: (value: number) => `${String(value)}%`,
  summary: (caption: string, parts: readonly string[]) => `${caption}: ${parts.join(', ')}`,
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
    response: {
      label: 'Медіана відповіді',
      threshold: (days: string) => `поріг тиші: ${days}`,
    },
    ghost: {
      label: 'Ghost rate',
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
      ghost: {
        lead: 'Сіра гілка не твоя провина.',
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
      interval: 'інтервал',
      counts: sourceCounts,
      table: {
        caption: 'Конверсія за джерелами',
        source: 'джерело',
        applications: 'відгуків',
        screenings: 'скринінгів',
        conversion: 'конверсія у скринінг',
      },
      small: {
        tag: 'n<5',
        line: ({ label, ...counts }: SourceCounts & Readonly<{ label: string }>) =>
          `${label}: ${sourceCounts(counts)}.`,
        noise: 'Відсоток на такій вибірці лише шум.',
      },
      empty: {
        title: 'Джерел ще немає',
        hint: "Тут з'явиться конверсія кожного майданчика, звідки ти відгукуєшся.",
      },
    },
    resume_ab: { eyebrow: 'A/B версій резюме', fallback: 'Яка версія CV працює краще' },
    forecast: { eyebrow: 'прогноз офера' },
    timings: { eyebrow: 'час на етапах · медіана' },
  },
  lowDataState: {
    firstWeek: 'перший тиждень',
    week: (week: number) => `тиждень ${String(week)} пошуку`,
    screening: {
      label: 'Конверсія у скринінг',
      when: (goal: number) => `буде на ${String(goal)} відгуках`,
    },
    forecast: {
      label: 'Прогноз офера',
      when: (goal: number) => `З'явиться після ${String(goal)} відгуків`,
      why: 'Раніше він показував би «2–30 тижнів». Це не інформація, а тривога. Краще нічого.',
    },
    action: {
      title: 'Що зараз корисніше за аналітику',
      body: (missing: number) =>
        `Додати ще ${applications(missing)} цього тижня. Аналітика вмикається сама.`,
      cta: 'Додати вакансію',
    },
  },
} as const;
