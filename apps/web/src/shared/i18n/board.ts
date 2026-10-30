import { countedUk, type PluralForms, STAGE_LABELS } from '@jobflow/shared';

const CARDS_IN_WORK = {
  one: 'карточка в роботі',
  few: 'карточки в роботі',
  other: 'карточок в роботі',
} as const satisfies PluralForms;

type StageNames = { from: string; to: string };

type DropNames = { position: string; stage: string | undefined };

const move = {
  dropHere: 'відпустити тут',
  failed: {
    title: 'Не вдалося перенести',
    description: 'Карточка повернулася на місце. Спробуй ще раз.',
  },
  conflict: {
    title: 'Карточка вже на іншому етапі',
    description:
      'Її перенесли в іншій вкладці чи на іншому пристрої. Дошка оновилася й показує, де вона зараз.',
  },
  illegal: ({ from, to }: StageNames) => ({
    title: 'Такий перехід неможливий',
    description: `З «${from}» карточка не переходить у «${to}». Вона повернулася на місце.`,
  }),
  a11y: {
    roleDescription: 'карточка для перетягування',
    instructions:
      'Щоб змінити етап, перетягни карточку мишею або довгим дотиком в іншу колонку. ESC скасовує.',
    pickedUp: (position: string) => `Карточку «${position}» взято.`,
    over: ({ position, stage }: DropNames) =>
      stage === undefined
        ? `«${position}» поза колонками.`
        : `«${position}» над колонкою «${stage}».`,
    dropped: ({ position, stage }: DropNames) =>
      stage === undefined
        ? `«${position}» повернулася на місце.`
        : `«${position}» відпущено в колонці «${stage}».`,
    cancelled: (position: string) => `Перетягування скасовано, «${position}» на місці.`,
  },
} as const;

const reject = {
  eyebrow: ({ company, from }: { company: string; from: string }) =>
    `${company} · ${from} → ${STAGE_LABELS.rejected.labelUk}`,
  title: 'Що сталося?',
  description:
    'Один клік — і карточка переїде. Причина потрібна не для звітності, а щоб аналітика знала, де саме ти застряг.',
  sides: { company: 'Відмовила компанія', candidate: 'Відмовився я' },
  skip: 'Не хочу зараз вказувати',
} as const;

export const board = {
  title: 'Дошка',
  eyebrow: (inWork: number) => `активний пошук · ${countedUk(inWork, CARDS_IN_WORK)}`,
  firstRun: {
    title: 'Тут буде твоя воронка',
    hint: 'Почни з однієї вакансії, на яку вже відгукнувся цього тижня. Далі буде швидко: букмарклет додає карточку одним кліком зі сторінки вакансії.',
    footnote: "колонки «відмова» і «ghosted» з'являться, коли будуть потрібні",
  },
  finalNote: ['Тут буває тісно рідко.', 'Це нормально.'],
  columnEmpty: ['тут поки порожньо'],
  move,
  reject,
} as const;
