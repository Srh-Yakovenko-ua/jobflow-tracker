import { countedUk, type PluralForms, type SilenceLevel, STAGE_LABELS } from '@jobflow/shared';

import { FORMS } from './analytics-forms';

const CARDS_IN_WORK = {
  one: 'картка в роботі',
  few: 'картки в роботі',
  other: 'карток у роботі',
} as const satisfies PluralForms;

const CARDS_BELOW = {
  one: 'картка нижче',
  few: 'картки нижче',
  other: 'карток нижче',
} as const satisfies PluralForms;

const CARDS_TAKEN = {
  one: 'картку',
  few: 'картки',
  other: 'карток',
} as const satisfies PluralForms;

const DRAFTS = {
  one: 'чернетку',
  few: 'чернетки',
  other: 'чернеток',
} as const satisfies PluralForms;

type StageNames = { from: string; to: string };

type BoardCounts = Readonly<{ inWork: number; offers: number }>;

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
    description: 'Її вже перенесли в іншій вкладці, дошка оновилася.',
  },
  illegal: ({ from, to }: StageNames) => ({
    title: 'Такий перехід неможливий',
    description: `З «${from}» картка не переходить у «${to}». Вона повернулася на місце.`,
  }),
  done: { title: (stage: string) => `Перенесено у «${stage}»`, undo: 'Скасувати' },
  bulk: {
    moved: (count: number) =>
      count === 0 ? 'Нічого не перенесено' : `Перенесено ${countedUk(count, CARDS_TAKEN)}`,
    failed: (count: number) => `Не вдалося перенести ${countedUk(count, CARDS_TAKEN)}.`,
    skipped: (count: number) =>
      `Пропущено ${countedUk(count, CARDS_TAKEN)}: для них такого переходу немає.`,
  },
  a11y: {
    roleDescription: 'картка для перетягування',
    instructions:
      'Пробіл бере й відпускає картку, стрілки вліво й вправо обирають етап, Esc скасовує.',
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
  description: 'Обери причину, так аналітика покаже, де губляться шанси.',
  sides: { company: 'Відмовила компанія', candidate: 'Моє рішення' },
  skip: 'Не хочу зараз вказувати',
  keysHint: 'Enter: остання причина · Esc: скасувати',
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
    refused: 'Цей текст не вдалося зберегти, зміни його й спробуй ще раз',
    save: 'Зберегти',
    saved: 'Нотатку збережено',
  },
  undoExpired: {
    title: 'Час на скасування минув',
    description: `Картка лишилася у «${REJECTED}».`,
  },
} as const;

const filters = {
  search: { label: 'Пошук карток', placeholder: 'Фільтр: компанія, посада, стек' },
  source: { menu: 'Джерело', pill: (picked: string) => `Джерело: ${picked}`, all: 'усі' },
  resumeVersion: {
    menu: 'Версія резюме',
    pill: (picked: string) => `Резюме: ${picked}`,
    all: 'усі',
    short: (number: number) => `CV v${String(number)}`,
    archived: (label: string) => `${label} · в архіві`,
    none: 'Ще немає жодної версії резюме',
  },
  more: {
    menu: 'Фільтри',
    pill: (count: number) => (count === 0 ? 'Фільтри' : `Фільтри · ${String(count)}`),
  },
  stage: 'Етап',
  hasScore: 'з Match Score',
  silentOnly: 'лише в тиші',
  salaryFrom: 'Зарплата від',
  chips: {
    label: 'Активні фільтри',
    source: (name: string) => `джерело: ${name}`,
    stage: (name: string) => `етап: ${name}`,
    unknownResumeVersion: 'невідома версія резюме',
    hasScore: { with: 'з Match Score', without: 'без Match Score' },
    silence: {
      none: 'без тиші',
      warn: 'тиша близько',
      silent: 'лише в тиші',
    } satisfies Record<SilenceLevel, string>,
    salaryFrom: (amount: string) => `зарплата від ${amount}`,
  },
  reset: 'Скинути фільтри',
} as const;

const emptySearch = {
  eyebrow: 'Пошук · нічого не знайдено',
  title: (query: string) => `Немає карток за «${query}»`,
  filteredTitle: 'Немає карток за цими фільтрами',
  hint: 'Спробуй частину слова або скинь фільтри.',
} as const;

export const board = {
  title: 'Дошка',
  eyebrow: ({ inWork, offers }: BoardCounts) =>
    offers === 0
      ? `активний пошук · ${countedUk(inWork, CARDS_IN_WORK)}`
      : `активний пошук · ${countedUk(inWork, CARDS_IN_WORK)} · ${countedUk(offers, FORMS.offer)}`,
  firstRun: {
    title: 'Тут буде твоя воронка',
    hint: 'Почни з вакансії цього тижня, далі букмарклет додаватиме їх одним кліком.',
    footnote: "колонки «відмова» і «ghosted» з'являться, коли будуть потрібні",
    bookmarklet: 'Встановити букмарклет',
    addFirst: 'Додати першу вакансію',
  },
  density: { label: 'Вигляд карток', full: 'Повні', compact: 'Щільні' },
  views: { label: 'Подання', board: 'Дошка', table: 'Таблиця' },
  scrollRight: 'Прокрутити до колонок праворуч',
  moreBelow: (count: number) => `ще ${countedUk(count, CARDS_BELOW)}`,
  finalNote: ['До фіналу доходять одиниці, це нормально.'],
  columnEmpty: ['тут поки порожньо'],
  compareOffers: 'Порівняти офери',
  parsing: (count: number) => `AI розбирає ${countedUk(count, DRAFTS)}`,
  filters,
  emptySearch,
  move,
  reject,
} as const;
