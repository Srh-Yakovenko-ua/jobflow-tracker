import { countedUk, type GhostRateVsMarket, type PluralForms, pluralUk } from '@jobflow/shared';

import { FORMS } from './analytics-forms';

export type GhostMarket = Readonly<{
  percent: number;
  points: number;
  position: NonNullable<GhostRateVsMarket['gap']>['position'];
}>;

const CARDS = { one: 'картка', few: 'картки', other: 'карток' } as const satisfies PluralForms;

const FRESH_CARDS = { one: 'свіжої картки', other: 'свіжих карток' } as const satisfies PluralForms;

const LETTERS = { one: 'лист', few: 'листи', other: 'листів' } as const satisfies PluralForms;

const LETTERS_OF = { one: 'листа', other: 'листів' } as const satisfies PluralForms;

const SUPPORTIVE = 'Вони не входять у конверсії.';

const SHARE = (percent: number) => `Це ${String(percent)}% твоїх відгуків`;

const MARKET: Record<GhostMarket['position'], (market: GhostMarket) => string> = {
  below: ({ percent, points }) => `${SHARE(percent)}, на ${String(points)} п.п. менше за ринок.`,
  above: ({ percent, points }) => `${SHARE(percent)}, на ${String(points)} п.п. більше за ринок.`,
  within: ({ percent }) => `${SHARE(percent)}, у межах ринку.`,
};

export const ghosted = {
  eyebrow: (count: number) => `ghosted · ${countedUk(count, CARDS)}`,
  title: (count: number) => `${countedUk(count, FORMS.company)} ${pluralUk(count, FORMS.silent)}`,
  supportive: SUPPORTIVE,
  hint: (market: GhostMarket | null) =>
    market === null ? SUPPORTIVE : `${MARKET[market.position](market)} ${SUPPORTIVE}`,
  action: (fresh: number) =>
    `Написати фоллоу-ап для ${String(fresh)} ${pluralUk(fresh, FRESH_CARDS)}`,
  sheet: {
    title: 'Фоллоу-апи для ghosted',
    progress: (sent: number, total: number) =>
      `AI пише ${String(sent)} з ${String(total)} ${pluralUk(total, LETTERS_OF)}`,
    note: 'Нічого не надсилається само. Кожен лист можна правити, скопіювати або пропустити.',
    close: 'Закрити',
    skip: 'Пропустити',
    next: 'наступний у черзі',
    ahead: (count: number) => `у черзі · ${countedUk(count, LETTERS)} перед цим`,
  },
} as const;
