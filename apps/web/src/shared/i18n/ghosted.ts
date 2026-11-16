import { countedUk, type GhostRateVsMarket, type PluralForms, pluralUk } from '@jobflow/shared';

import { FORMS } from './analytics-forms';

export type GhostMarket = Readonly<{
  percent: number;
  points: number;
  position: NonNullable<GhostRateVsMarket['gap']>['position'];
}>;

const CARDS = { one: 'картка', few: 'картки', other: 'карток' } as const satisfies PluralForms;

const FRESH = { one: 'свіжій', other: 'свіжих' } as const satisfies PluralForms;

const DRAFTS = { one: 'драфт', few: 'драфти', other: 'драфтів' } as const satisfies PluralForms;

const SUPPORTIVE = 'Ці картки не впливають на конверсії й нічого не кажуть про тебе.';

const SHARE = (percent: number) => `Це ${String(percent)}% твоїх відгуків`;

const MARKET: Record<GhostMarket['position'], (market: GhostMarket) => string> = {
  below: ({ percent, points }) => `${SHARE(percent)}, на ${String(points)} п.п. менше за ринок.`,
  above: ({ percent, points }) => `${SHARE(percent)}, на ${String(points)} п.п. більше за ринок.`,
  within: ({ percent }) => `${SHARE(percent)}, у межах ринку.`,
};

export const ghosted = {
  eyebrow: (count: number) => `Ghosted · ${countedUk(count, CARDS)}`,
  title: (count: number) => `${countedUk(count, FORMS.company)} ${pluralUk(count, FORMS.silent)}`,
  supportive: SUPPORTIVE,
  hint: (market: GhostMarket | null) =>
    market === null ? SUPPORTIVE : `${MARKET[market.position](market)} ${SUPPORTIVE}`,
  action: (fresh: number) => `Спробувати фоллоу-ап по ${String(fresh)} ${pluralUk(fresh, FRESH)}`,
  sheet: {
    title: 'Фоллоу-апи для ghosted',
    progress: (sent: number, total: number) =>
      `${String(sent)} з ${countedUk(total, DRAFTS)} передано в AI`,
    note: 'Нічого не надсилається само. Кожен драфт можна правити, скопіювати або пропустити.',
    close: 'Закрити',
    skip: 'Пропустити',
    next: 'наступний у черзі',
    ahead: (count: number) => `у черзі · ${countedUk(count, DRAFTS)} перед цим`,
  },
} as const;
