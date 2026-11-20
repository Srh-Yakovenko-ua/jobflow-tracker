import { countedUk, DAY_FORMS_UK, type SilenceItem, type Summary } from '@jobflow/shared';

import { monthNameOf } from '../../common/year-month.js';

export type NotificationCopy = { title: string; body: string };

export const NOTIFICATION_FALLBACK_PATH = '/notifications';

export const FOLLOW_UP_HINT = 'Час нагадати про себе: відкрий картку і напиши фоллоу-ап.';

export const withoutReply = (counted: string) => `${counted} без відповіді`;

export const silentDaysOf = (days: number) => withoutReply(countedUk(days, DAY_FORMS_UK));

export const silenceTitleOf = ({ company, days }: Pick<SilenceItem, 'company' | 'days'>) =>
  `${company}: ${silentDaysOf(days)}`;

export const summaryReadyCopyOf = (month: Summary['month']): NotificationCopy => ({
  title: `Саммарі за ${monthNameOf(month)} готове`,
  body: 'Що вийшло за місяць і які кроки зробити далі.',
});
