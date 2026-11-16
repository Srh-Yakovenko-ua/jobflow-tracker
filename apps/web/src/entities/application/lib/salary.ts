import {
  type ApplicationCard,
  type ApplicationResponse,
  SALARY_NORMALISATION,
  vacancyCurrencySchema,
  vacancyParseOutputSchema,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const COPY = uk.application.salary;

const AMOUNT_FORMAT = new Intl.NumberFormat(uk.locale, { maximumFractionDigits: 0 });

export function formatAmount(value: number): string {
  return AMOUNT_FORMAT.format(value);
}

export type SalarySource = Pick<ApplicationCard, 'salaryMin' | 'salaryMax' | 'currency'>;

function currencySymbolOf(currency: string | null): string {
  if (currency === null) {
    return '';
  }
  const parts = new Intl.NumberFormat(uk.locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

export type UsdNetSource = Pick<
  ApplicationResponse,
  'salaryMin' | 'salaryMax' | 'currency' | 'aiParsed'
>;

function netShareOf(aiParsed: UsdNetSource['aiParsed']): number {
  const tax = vacancyParseOutputSchema.shape.salaryTax.safeParse(aiParsed?.salaryTax);
  return tax.success && tax.data.value === 'gross' ? SALARY_NORMALISATION.netShareOfGross : 1;
}

export function usdNetPerMonthOf({
  salaryMin,
  salaryMax,
  currency,
  aiParsed,
}: UsdNetSource): number | null {
  const low = salaryMin ?? salaryMax;
  const high = salaryMax ?? salaryMin;
  const rate = vacancyCurrencySchema.safeParse(currency);
  if (low === null || high === null || !rate.success) return null;
  const perUsd = SALARY_NORMALISATION.perUsd[rate.data];
  return Math.round((((low + high) / 2) * netShareOf(aiParsed)) / perUsd);
}

export function formatSalaryRange({ salaryMin, salaryMax, currency }: SalarySource): string | null {
  const symbol = currencySymbolOf(currency);
  const amount = (value: number) => `${symbol}${formatAmount(value)}`;
  if (salaryMin !== null && salaryMax !== null) {
    return salaryMin === salaryMax
      ? amount(salaryMin)
      : COPY.range(amount(salaryMin), formatAmount(salaryMax));
  }
  if (salaryMin !== null) {
    return COPY.from(amount(salaryMin));
  }
  return salaryMax === null ? null : COPY.to(amount(salaryMax));
}
