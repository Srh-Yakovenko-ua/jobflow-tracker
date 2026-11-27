import type { EmailedType } from '@jobflow/shared';

import { settings } from './settings';
import { emailTypes } from './settings-email';

export const unsubscribe = {
  pageTitle: 'Відписка від листів',
  eyebrow: 'листи JobFlow',
  confirm: {
    title: 'Відписатися від цих листів?',
    hint: 'Листи цього типу більше не приходитимуть. Інші листи й сповіщення лишаться як були.',
    action: 'Відписатися',
  },
  done: {
    title: 'Листи вимкнено',
    hint: (type: EmailedType) =>
      `Листи «${emailTypes[type].title}» більше не приходитимуть. Увімкнути знову можна в налаштуваннях.`,
  },
  invalid: {
    title: 'Посилання для відписки не працює',
    hint: `Воно пошкоджене або застаріло. Вимкнути листи можна в налаштуваннях, розділ «${settings.sections.notifications}».`,
  },
  settingsLink: 'Відкрити налаштування',
  failed: {
    title: 'Не вдалося відписатися',
    description: "Перевір з'єднання і спробуй ще раз.",
  },
} as const;
