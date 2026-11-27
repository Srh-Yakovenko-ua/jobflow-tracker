const EYEBROW = 'місячне AI-саммарі';

export const summary = {
  eyebrow: EYEBROW,
  eyebrowMonth: (month: string) => `${EYEBROW} · ${month}`,
  ready: (stamp: string) => `готово · ${stamp}`,
  heading: (month: string) => `Як пройшов ${month}`,
  actions: (monthIn: string) => `що зробити у ${monthIn}`,
  chartLink: (block: string) => `Дивитись на графіку: ${block}`,
  blocks: {
    kpis: 'відгуки',
    funnel: 'воронка',
    reasons: 'причини відмов',
    sources: 'джерела',
    resumeAb: 'версії резюме',
    forecast: 'прогноз офера',
  },
  keywords: {
    resumeAb: /CV|резюме/iu,
    sources: /djinni|dou|linkedin|рефера|джерел/iu,
    reasons: /відмов|причин/iu,
    forecast: /прогноз|тижн/iu,
    funnel: /скринінг|конверс|техінтерв|фінал|офер/iu,
    kpis: /відгук|надіслав/iu,
  },
  generating: 'AI пише саммарі',
  plan: {
    save: 'Зберегти як план',
    saved: 'План збережено.',
    open: 'Відкрити в нагадуваннях',
    failed: 'Не вдалося зберегти план. Спробуй ще раз.',
  },
  regenerate: {
    action: 'Перегенерувати',
    noSearch: 'Немає активного пошуку, тож саммарі нема з чого писати.',
    noActivity: 'За минулий місяць у пошуку не було подій, саммарі нема з чого писати.',
    rateLimited: 'Забагато запитів до AI за годину. Спробуй трохи пізніше.',
    failed: 'Не вдалося запустити саммарі. Спробуй ще раз.',
  },
  empty: {
    eyebrow: EYEBROW,
    title: 'Перше саммарі прийде 1-го числа',
    hint: 'Коли набереться місяць даних, AI назве вузьке місце й запропонує план.',
    action: 'Згенерувати зараз',
  },
  page: {
    title: 'Місячне саммарі',
    heading: (month: string, year: string) => `Саммарі за ${month} ${year}`,
    back: 'До аналітики',
  },
  notFound: {
    eyebrow: EYEBROW,
    title: (month: string, year: string) => `За ${month} ${year} саммарі немає`,
    hint: 'Саммарі пишеться за місяць, що минув. Останнє вже чекає.',
    hintNoLatest: 'Перше саммарі прийде 1-го числа, коли набереться місяць даних.',
    action: 'До останнього саммарі',
  },
  archive: {
    title: 'попередні місяці',
    month: (month: string, year: string) => `${month} ${year}`,
    progress: (done: number, items: number) => `${String(done)} з ${String(items)} виконано`,
    noPlan: 'план не збережено',
  },
} as const;
