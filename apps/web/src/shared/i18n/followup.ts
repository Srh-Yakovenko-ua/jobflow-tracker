import type { FollowupLanguage, FollowupTone } from '@jobflow/shared';

export const followup = {
  kicker: 'Фоллоу-ап',
  idle: 'AI напише драфт від твого імені. Ти зможеш його відредагувати перед відправкою.',
  generate: 'Згенерувати фоллоу-ап',
  tone: {
    label: 'Тон',
    options: {
      neutral: 'нейтральний',
      warm: 'теплий',
      short: 'короткий',
    } satisfies Record<FollowupTone, string>,
  },
  language: {
    label: 'Мова',
    options: { uk: 'українська', en: 'англійська' } satisfies Record<FollowupLanguage, string>,
  },
  hint: {
    label: 'Що згадати (необовʼязково)',
    placeholder: 'згадай, що я дорозвʼязав задачу',
    note: 'Нотатки в модель не йдуть. Те, що варто згадати, напиши тут.',
  },
  waiting: 'Можеш закрити картку: повідомимо, коли драфт буде готовий.',
  ready: 'драфт готовий · можна правити',
  own: 'свій текст · пиши тут',
  subject: 'Тема листа',
  body: 'Текст листа',
  copy: 'Скопіювати',
  variant: 'Ще варіант',
  markSent: 'Позначити як надіслано',
  sent: 'Фоллоу-ап позначено надісланим',
  failed: {
    timeout: 'Генерація не вдалася: модель не відповіла за 30 секунд. Твої дані нікуди не зникли.',
    other: 'Генерація не вдалася. Твої дані нікуди не зникли.',
    retry: 'Спробувати ще',
    manual: 'Написати самому',
  },
  hintTooLong: (max: number) => `Не більше ${String(max)} символів.`,
} as const;
