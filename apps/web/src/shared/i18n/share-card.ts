import { countedUk, type PluralForms } from '@jobflow/shared';

import { applications, FORMS } from './analytics-forms';

const TECH_INTERVIEW_FORMS = { other: "техінтерв'ю" } as const satisfies PluralForms;

export type ShareStoryCounts = Readonly<{ sent: number; interviews: number; offers: number }>;

export const shareCard = {
  button: 'Поділитися',
  dialog: {
    title: 'Поділитися пошуком',
    description:
      'Картинка 1200×630 для LinkedIn чи DOU. Лише числа й етапи, без компаній, зарплат і нотаток. Нічого не йде на сервер.',
  },
  theme: 'Тема картинки',
  hideNumbers: 'Приховати числа',
  download: 'Завантажити PNG',
  copy: 'Скопіювати в буфер',
  failed: {
    eyebrow: 'Картинка',
    title: 'Не вдалося намалювати картинку',
    body: 'Браузер не дав полотно для малювання. Спробуй ще раз або відкрий сторінку в іншому браузері.',
  },
  story: ({ sent, interviews, offers }: ShareStoryCounts) =>
    `${applications(sent)}, ${countedUk(interviews, TECH_INTERVIEW_FORMS)}, ${countedUk(offers, FORMS.offer)}`,
  storyHidden: 'Воронка мого пошуку роботи',
  period: (weeks: number) => `за ${countedUk(weeks, FORMS.week)}`,
  kpi: { sent: 'відгуки', interviews: "техінтерв'ю", offers: 'офери' },
  alt: (lines: readonly string[]) => `Картка пошуку роботи. ${lines.join('. ')}.`,
} as const;
