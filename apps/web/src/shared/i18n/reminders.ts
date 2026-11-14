import { countedUk, DAY_FORMS_UK, type PlanProgress, type PluralForms } from '@jobflow/shared';

import { shell } from './shell';

const PLAN_ITEM_FORMS = {
  one: 'пункту',
  few: 'пунктів',
  other: 'пунктів',
} as const satisfies PluralForms;

export const reminders = {
  title: shell.nav.reminders,
  silence: { title: 'Тиша' },
  interviews: {
    title: 'Найближчі співбесіди',
    empty: 'На найближчі два тижні співбесід немає.',
  },
  row: { position: (position: string, stage: string) => `${position} · ${stage}` },
  actions: {
    followUp: shell.palette.actions.followUp,
    reply: 'Відповідь є',
    replyTo: (company: string) => `Куди перемістити ${company} після відповіді`,
    snooze: 'Почекати ще',
    snoozeFor: (days: number) => countedUk(days, DAY_FORMS_UK),
  },
  plan: {
    title: 'План',
    progress: ({ items, done }: PlanProgress) =>
      `з ${countedUk(items, PLAN_ITEM_FORMS)} виконано ${String(done)}`,
    due: (day: string) => `до ${day}`,
    empty: "Плану ще немає. Його можна зберегти з дій місячного саммарі, і пункти з'являться тут.",
    toggleFailed: {
      title: 'Не вдалося позначити пункт',
      description: 'Пункт лишився як був. Спробуй ще раз трохи згодом.',
    },
  },
  snoozeFailed: {
    title: 'Не вдалося відкласти нагадування',
    description: 'Картка знову в списку. Спробуй ще раз трохи згодом.',
  },
} as const;
