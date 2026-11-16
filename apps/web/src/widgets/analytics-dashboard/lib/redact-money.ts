import { uk } from '@/shared/i18n';

const COPY = uk.analytics.report;

const SPACE_CHARS = ' \\u00a0\\u2009\\u202f';

const SPACE = `[${SPACE_CHARS}]`;

const NUMBER = `(?:\\d{1,3}(?:[${SPACE_CHARS},.]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)`;

const AMOUNT = `${NUMBER}(?:${SPACE}?(?:k|${COPY.scaleWords.source})(?!\\p{L}))?`;

const SIGN = '[$€₴]';

const RANGE = `${AMOUNT}(?:${SPACE}?[-–—]${SPACE}?${SIGN}?${AMOUNT})?`;

const BEFORE = `(?:${SIGN}|(?:USD|EUR|UAH)${SPACE})`;

const AFTER = `(?:${SIGN}|USD|EUR|UAH|${COPY.currencyWords.source})`;

const MONEY = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BEFORE}${SPACE}?${RANGE}|${RANGE}${SPACE}?${AFTER})(?![\\p{L}\\p{N}])`,
  'gu',
);

export function redactMoney(text: string): string {
  return text.replace(MONEY, COPY.hidden);
}
