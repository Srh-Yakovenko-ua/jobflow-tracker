import type { FollowupLanguage, FollowupTone } from '@jobflow/shared';

export const followup = {
  kicker: 'Фоллоу-ап',
  idle: 'AI напише лист від твого імені, його можна правити.',
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
    note: 'AI не бачить нотаток, тож важливе напиши тут.',
  },
  waiting: 'Можеш закрити картку: повідомимо, коли лист буде готовий.',
  ready: 'лист готовий · можна правити',
  own: 'свій текст · пиши тут',
  subject: 'Тема листа',
  body: 'Текст листа',
  copy: 'Скопіювати',
  variant: 'Ще варіант',
  markSent: 'Позначити як надіслано',
  sent: 'Фоллоу-ап позначено надісланим',
  failed: {
    timeout: 'AI не відповів за 30 секунд.',
    other: 'Лист не вийшов.',
    budget: 'Ліміт AI на сьогодні вичерпано, напиши лист вручну.',
    rateLimited: 'Забагато запитів до AI, спробуй трохи пізніше.',
    retry: 'Спробувати ще',
    manual: 'Написати вручну',
  },
  hintTooLong: (max: number) => `Не більше ${String(max)} символів.`,
} as const;
