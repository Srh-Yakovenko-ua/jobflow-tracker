import { uk } from '@/shared/i18n';

const COPY = uk.analytics.report;

const SPACE = '[ \\u00a0\\u2009\\u202f]';

const AMOUNT = `(?:\\d{1,3}(?:${SPACE}\\d{3})+|\\d+)`;

const CURRENCY = `(?:\\$|USD|${COPY.currencyWords.source})`;

const MONEY = new RegExp(`\\$${SPACE}?${AMOUNT}|${AMOUNT}${SPACE}?${CURRENCY}`, 'gu');

export function redactMoney(text: string): string {
  return text.replace(MONEY, COPY.hidden);
}
