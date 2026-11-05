import { countedUk, type PluralForms, STAGE_LABELS } from '@jobflow/shared';

const CARDS_IN_WORK = {
  one: 'картка в роботі',
  few: 'картки в роботі',
  other: 'карток у роботі',
} as const satisfies PluralForms;

type StageNames = { from: string; to: string };

type DropNames = { position: string; stage: string | undefined };

const move = {
  dropHere: 'відпустити тут',
  keyboardHint: {
    chip: 'SPACE',
    picked: 'Картку взято з клавіатури.',
    keys: [
      { key: '←/→', action: 'етап' },
      { key: 'SPACE', action: 'відпустити' },
      { key: 'ESC', action: 'скасувати' },
    ],
  },
  failed: {
    title: 'Не вдалося перенести',
    description: 'Картка повернулася на місце. Спробуй ще раз.',
  },
  conflict: {
    title: 'Картка вже на іншому етапі',
    description:
      'Її перенесли в іншій вкладці чи на іншому пристрої. Дошка оновилася й показує, де вона зараз.',
  },
  illegal: ({ from, to }: StageNames) => ({
    title: 'Такий перехід неможливий',
    description: `З «${from}» картка не переходить у «${to}». Вона повернулася на місце.`,
  }),
  a11y: {
    roleDescription: 'картка для перетягування',
    instructions:
      'Щоб змінити етап, натисни пробіл і стрілками вліво чи вправо обери колонку. Етапи, куди картка не може перейти, пропускаються. Пробіл відпускає картку, ESC скасовує. Мишею або довгим дотиком картку можна перетягнути.',
    pickedUp: (position: string) => `Картку «${position}» взято.`,
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

const REJECTED = STAGE_LABELS.rejected.labelUk;

type SavedTitle = { company: string; reason: string | undefined };

const reject = {
  eyebrow: ({ company, from }: { company: string; from: string }) =>
    `${company} · ${from} → ${REJECTED}`,
  title: 'Що сталося?',
  description:
    'Один клік, і картка переїде. Причина потрібна, щоб аналітика знала, де саме ти застряг.',
  sides: { company: 'Відмовила компанія', candidate: 'Відмовився я' },
  skip: 'Не хочу зараз вказувати',
  keysHint: 'ENTER: остання причина · ESC: скасувати',
  saved: {
    eyebrow: 'записано в аналітику',
    title: ({ company, reason }: SavedTitle) =>
      reason === undefined ? `${company} → ${REJECTED}` : `${company} → ${REJECTED}: ${reason}`,
    reasonsAt: (stage: string) => `причини відмов на ${stage}`,
    undo: 'Скасувати перенос',
    addNote: 'Додати нотатку',
    done: 'Готово',
  },
  insight: {
    total: ({ stage, total }: { stage: string; total: number }) =>
      `Відмов на етапі «${stage}»: ${String(total)}.`,
    pickedTop: (reason: string) => `Причина «${reason}» стала найчастішою на цьому етапі.`,
    otherTop: (reason: string) => `Найчастіша причина на цьому етапі: «${reason}».`,
  },
  note: {
    title: 'Нотатка до відмови',
    label: "Що варто запам'ятати",
    blank: 'Напиши хоча б кілька слів',
    tooLong: 'Нотатка задовга',
    save: 'Зберегти',
    saved: 'Нотатку збережено',
  },
  undoExpired: {
    title: 'Час на скасування минув',
    description: `Картка лишилася у «${REJECTED}».`,
  },
} as const;

export const board = {
  title: 'Дошка',
  eyebrow: (inWork: number) => `активний пошук · ${countedUk(inWork, CARDS_IN_WORK)}`,
  firstRun: {
    title: 'Тут буде твоя воронка',
    hint: 'Почни з однієї вакансії, на яку вже відгукнувся цього тижня. Далі буде швидко: букмарклет додає картку одним кліком зі сторінки вакансії.',
    footnote: "колонки «відмова» і «ghosted» з'являться, коли будуть потрібні",
  },
  finalNote: ['Тут буває тісно рідко.', 'Це нормально.'],
  columnEmpty: ['тут поки порожньо'],
  move,
  reject,
} as const;
