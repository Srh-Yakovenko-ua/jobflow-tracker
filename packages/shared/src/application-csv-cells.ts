import { TZDate } from '@date-fns/tz';
import { z } from 'zod';

import type { Application } from './schemas/application.js';
import type { StageEvent } from './schemas/stage-event.js';

export type Salary = Pick<Application, 'salaryMin' | 'salaryMax' | 'currency'>;

export type HistoryEvent = Pick<StageEvent, 'toStage' | 'reasonCode' | 'occurredAt'>;

export type NamedCodeLookup<Code extends string> = Readonly<{
  text: string;
  codes: readonly Code[];
  namesOf: (code: Code) => readonly string[];
}>;

type DayParts = Readonly<{ year: number; month: number; day: number }>;

const PATTERNS = {
  currencyTail: /^(?<amount>.*?)\s*(?<currency>[A-Za-z]{3})?$/u,
  singleAmount: /^\d+$/u,
  rangeAmount: /^(?<min>\d*)-(?<max>\d*)$/u,
  historyEntry: /^(?<toStage>[^@]+)@(?<occurredAt>[^@]+?)(?::(?<reasonCode>[a-z_]+))?$/u,
  isoDay: /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u,
  dottedDay: /^(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})$/u,
} as const;

const instantSchema = z.iso.datetime({ offset: true });

const nameKeyOf = (name: string) => name.trim().toLocaleLowerCase('uk');

export function codeNamedBy<Code extends string>({
  text,
  codes,
  namesOf,
}: NamedCodeLookup<Code>): Code | undefined {
  const wanted = nameKeyOf(text);
  return codes.find((code) => namesOf(code).some((name) => nameKeyOf(name) === wanted));
}

const amountText = (amount: number | null) => (amount === null ? '' : String(amount));

export function salaryText({ salaryMin, salaryMax, currency }: Salary): string {
  const range =
    salaryMin === null && salaryMax === null
      ? ''
      : `${amountText(salaryMin)}-${amountText(salaryMax)}`;
  return [range, currency ?? ''].filter((part) => part !== '').join(' ');
}

const amountOf = (digits: string | undefined) =>
  digits === undefined || digits === '' ? null : Number(digits);

function rangeOf(amount: string): Omit<Salary, 'currency'> | undefined {
  if (amount === '') return { salaryMin: null, salaryMax: null };
  if (PATTERNS.singleAmount.test(amount)) {
    return { salaryMin: Number(amount), salaryMax: Number(amount) };
  }
  const range = PATTERNS.rangeAmount.exec(amount)?.groups;
  if (range === undefined) return undefined;
  return { salaryMin: amountOf(range.min), salaryMax: amountOf(range.max) };
}

export function salaryOf(text: string): Salary | undefined {
  const parts = PATTERNS.currencyTail.exec(text.trim())?.groups;
  const amount = (parts?.amount ?? '').replaceAll(/\s/gu, '').replaceAll(/[–—]/gu, '-');
  const range = rangeOf(amount);
  if (range === undefined) return undefined;
  return { ...range, currency: parts?.currency?.toUpperCase() ?? null };
}

export function stageHistoryText(history: readonly HistoryEvent[]): string {
  return history
    .map(({ toStage, reasonCode, occurredAt }) =>
      reasonCode === null ? `${toStage}@${occurredAt}` : `${toStage}@${occurredAt}:${reasonCode}`,
    )
    .join(';');
}

function historyEntryOf(entry: string): unknown {
  const groups = PATTERNS.historyEntry.exec(entry)?.groups;
  if (groups?.toStage === undefined || groups.occurredAt === undefined) return entry;
  return {
    toStage: groups.toStage,
    reasonCode: groups.reasonCode ?? null,
    occurredAt: groups.occurredAt,
  };
}

export function stageHistoryOf(text: string): unknown[] {
  return text
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map(historyEntryOf);
}

function dayPartsOf(text: string): DayParts | undefined {
  const groups = (PATTERNS.isoDay.exec(text) ?? PATTERNS.dottedDay.exec(text))?.groups;
  if (groups === undefined) return undefined;
  return { year: Number(groups.year), month: Number(groups.month), day: Number(groups.day) };
}

function dayStartOf(parts: DayParts, timeZone: string): string | undefined {
  const start = new TZDate(parts.year, parts.month - 1, parts.day, timeZone);
  const isRealDay =
    start.getFullYear() === parts.year &&
    start.getMonth() === parts.month - 1 &&
    start.getDate() === parts.day;
  return isRealDay ? new Date(start.getTime()).toISOString() : undefined;
}

export function importedInstantOf(text: string, timeZone: string): string {
  if (instantSchema.safeParse(text).success) return new Date(text).toISOString();
  const parts = dayPartsOf(text);
  return (parts === undefined ? undefined : dayStartOf(parts, timeZone)) ?? text;
}
