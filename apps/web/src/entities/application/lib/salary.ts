import type { ApplicationCard } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const COPY = uk.application.salary;

const AMOUNT_FORMAT = new Intl.NumberFormat(uk.locale, { maximumFractionDigits: 0 });

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

export function formatSalaryRange({ salaryMin, salaryMax, currency }: SalarySource): string | null {
  const symbol = currencySymbolOf(currency);
  const amount = (value: number) => `${symbol}${AMOUNT_FORMAT.format(value)}`;
  if (salaryMin !== null && salaryMax !== null) {
    return salaryMin === salaryMax
      ? amount(salaryMin)
      : COPY.range(amount(salaryMin), AMOUNT_FORMAT.format(salaryMax));
  }
  if (salaryMin !== null) {
    return COPY.from(amount(salaryMin));
  }
  return salaryMax === null ? null : COPY.to(amount(salaryMax));
}
