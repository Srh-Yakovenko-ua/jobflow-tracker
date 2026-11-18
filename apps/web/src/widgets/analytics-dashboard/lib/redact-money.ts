import { uk } from '@/shared/i18n';

const COPY = uk.analytics.report;

const SPACE_CHARS = ' \\u00a0\\u2009\\u202f';

const SPACE = `[${SPACE_CHARS}]`;

const NUMBER = `(?:\\d{1,3}(?:[${SPACE_CHARS},.]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)`;

const AMOUNT = `${NUMBER}(?:${SPACE}?(?:k|${COPY.scaleWords.source})(?!\\p{L}))?`;

const SIGN = '[$€₴£]';

const CODE = `(?:${Intl.supportedValuesOf('currency').join('|')})`;

const RANGE = `${AMOUNT}(?:${SPACE}?[-–—]${SPACE}?${SIGN}?${AMOUNT})?`;

const TO = `${SPACE}+(?:${COPY.rangeWords.source})${SPACE}+`;

const RANGE_TO = `${AMOUNT}${TO}${AMOUNT}`;

const BEFORE = `(?:${SIGN}|${CODE}${SPACE})`;

const RANGE_TO_BEFORE = `${AMOUNT}${TO}${BEFORE}${SPACE}?${AMOUNT}`;

const AFTER = `(?:${SIGN}|${CODE}|${COPY.currencyWords.source})`;

const MONEY = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BEFORE}${SPACE}?${RANGE}|${RANGE_TO_BEFORE}|(?:${RANGE_TO}|${RANGE})${SPACE}?${AFTER})(?![\\p{L}\\p{N}])`,
  'giu',
);

export function redactMoney(text: string): string {
  return text.replace(MONEY, COPY.hidden);
}
