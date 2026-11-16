import type { EmailedType } from '@jobflow/shared';

export const emailTypes = {
  monthly_summary_ready: {
    title: 'Місячне AI-саммарі',
    description: 'Лист першого числа, коли саммарі за місяць готове.',
  },
  silence: {
    title: 'Тиша на картках',
    description: 'Лист зі списком вакансій, де давно немає відповіді.',
  },
  interview_prep_ready: {
    title: 'Співбесіда завтра',
    description: 'Лист за добу до співбесіди з підготовкою до неї.',
  },
} as const satisfies Record<EmailedType, { title: string; description: string }>;
