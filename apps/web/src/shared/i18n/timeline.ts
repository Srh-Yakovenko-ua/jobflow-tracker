import { countedUk, DAY_FORMS_UK, type PluralForms, type Stage } from '@jobflow/shared';

const EVENT_FORMS = { one: 'подія', few: 'події', other: 'подій' } as const satisfies PluralForms;

const daysOf = (count: number) => countedUk(count, DAY_FORMS_UK);

type SilenceCopy = { days: number; threshold: number };

type RemindCopy = SilenceCopy & { remindOn: string };

export const timeline = {
  kicker: (count: number) => `Таймлайн · ${countedUk(count, EVENT_FORMS)}`,
  heading: 'Історія відгуку',
  today: 'сьогодні',
  waiting: (stageGenitive: string) => `Чекаєш на відповідь після ${stageGenitive}`,
  silence: ({ days, threshold, remindOn }: RemindCopy) =>
    `${daysOf(days)} тиші. Поріг фоллоу-апу: ${daysOf(threshold)}, нагадаємо ${remindOn}.`,
  silencePassed: ({ days, threshold }: SilenceCopy) =>
    `${daysOf(days)} тиші. Поріг фоллоу-апу в ${daysOf(threshold)} пройдено.`,
  stageGenitive: {
    applied: 'відгуку',
    screening: 'скринінгу',
    tech_interview: "техінтерв'ю",
    final: 'фіналу',
    offer: 'оферу',
    rejected: 'відмови',
    ghosted: 'ghosted',
    withdrawn: 'відкликання',
  } satisfies Record<Stage, string>,
  sentWithCv: (title: string, number: number) => `${title} · CV v${String(number)}`,
  movedByHand: 'Перенесено вручну.',
  daysInStage: (days: number, stageGenitive: string) =>
    `${daysOf(days)} на етапі ${stageGenitive}.`,
  reason: (label: string) => `Причина: ${label}.`,
  via: (source: string) => `Через ${source}.`,
  silenceMeta: 'Автоматична подія. Картка приглушилась на дошці.',
  fieldsChecked: {
    alone: 'Поля перевірено вручну',
    after: (parse: string) => `${parse}, поля перевірено вручну`,
  },
  empty: 'Подій ще немає',
} as const;
