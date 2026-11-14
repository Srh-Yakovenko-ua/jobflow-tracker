import { countedUk, DAY_FORMS_UK } from '@jobflow/shared';

import { shell } from './shell';

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
  snoozeFailed: {
    title: 'Не вдалося відкласти нагадування',
    description: 'Картка знову в списку. Спробуй ще раз трохи згодом.',
  },
} as const;
