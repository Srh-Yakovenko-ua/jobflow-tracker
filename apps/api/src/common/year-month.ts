import { userNow, type YearMonth } from '@jobflow/shared';
import { addMonths, format, parse } from 'date-fns';
import { uk } from 'date-fns/locale/uk';

const firstLocalDayOf = (month: YearMonth) => parse(month, 'yyyy-MM', new Date(0));

export const yearMonthOf = (date: Date): YearMonth => format(date, 'yyyy-MM');

export const localMonthOf = (timezone: string, instant: Date): YearMonth =>
  yearMonthOf(userNow({ timezone }, instant));

export const shiftMonth = (month: YearMonth, months: number): YearMonth =>
  yearMonthOf(addMonths(firstLocalDayOf(month), months));

export const previousLocalMonthOf = (timezone: string, instant: Date): YearMonth =>
  shiftMonth(localMonthOf(timezone, instant), -1);

export const monthNameOf = (month: YearMonth): string =>
  format(firstLocalDayOf(month), 'LLLL', { locale: uk });

export const firstDayOf = (month: YearMonth): Date => new Date(`${month}-01T00:00:00.000Z`);
