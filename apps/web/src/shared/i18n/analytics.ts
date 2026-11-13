import { countedUk, type PluralForms, pluralUk } from '@jobflow/shared';

const FORMS = {
  application: { one: 'відгук', few: 'відгуки', other: 'відгуків' },
  week: { one: 'тиждень', few: 'тижні', other: 'тижнів' },
  company: { one: 'компанія', few: 'компанії', other: 'компаній' },
  silent: { one: 'не відповіла', other: 'не відповіли' },
  excluded: { one: 'Вона не входить', other: 'Вони не входять' },
} as const satisfies Record<string, PluralForms>;

const EYEBROW = 'аналітика воронки';

const MINUS = '−';

const signed = (value: number) => `${value > 0 ? '+' : MINUS}${String(Math.abs(value))}`;

const applications = (count: number) => countedUk(count, FORMS.application);

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
      caption: {
        thickness: 'товщина = кількість відгуків',
        hover: 'наведи на потік, щоб побачити точні числа',
      },
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
    reasons: { eyebrow: 'причини відмов за етапами', fallback: 'Де відмовляють найчастіше' },
    sources: { eyebrow: 'конверсія за джерелами', fallback: 'Яке джерело працює' },
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
