import { z } from 'zod';

export const REJECTION_SIDES = ['company', 'candidate', 'system'] as const;

export const rejectionSideSchema = z.enum(REJECTION_SIDES);

export type RejectionSide = z.infer<typeof rejectionSideSchema>;

export const REJECTION_REASON_CODES = [
  'skills_gap',
  'english_level',
  'salary_expectations',
  'chose_other',
  'position_closed',
  'no_explanation',
  'low_salary',
  'office_schedule',
  'red_flags',
  'accepted_other',
  'silence_timeout',
  'unspecified',
] as const;

export const rejectionReasonCodeSchema = z.enum(REJECTION_REASON_CODES);

export type RejectionReasonCode = z.infer<typeof rejectionReasonCodeSchema>;

export type RejectionReason = {
  side: RejectionSide;
  labelUk: string;
  labelEn: string;
  sortOrder: number;
};

export const REJECTION_REASONS: Record<RejectionReasonCode, RejectionReason> = {
  skills_gap: {
    side: 'company',
    labelUk: 'не вистачає скілів',
    labelEn: 'Skills gap',
    sortOrder: 1,
  },
  english_level: {
    side: 'company',
    labelUk: 'рівень англійської',
    labelEn: 'English level',
    sortOrder: 2,
  },
  salary_expectations: {
    side: 'company',
    labelUk: 'зарплатні очікування',
    labelEn: 'Salary expectations',
    sortOrder: 3,
  },
  chose_other: {
    side: 'company',
    labelUk: 'обрали іншого',
    labelEn: 'Chose another candidate',
    sortOrder: 4,
  },
  position_closed: {
    side: 'company',
    labelUk: 'вакансію закрили',
    labelEn: 'Position closed',
    sortOrder: 5,
  },
  no_explanation: {
    side: 'company',
    labelUk: 'без пояснення',
    labelEn: 'No explanation',
    sortOrder: 6,
  },
  low_salary: { side: 'candidate', labelUk: 'низька вилка', labelEn: 'Low salary', sortOrder: 7 },
  office_schedule: {
    side: 'candidate',
    labelUk: 'офіс/графік',
    labelEn: 'Office or schedule',
    sortOrder: 8,
  },
  red_flags: { side: 'candidate', labelUk: 'ред флаги', labelEn: 'Red flags', sortOrder: 9 },
  accepted_other: {
    side: 'candidate',
    labelUk: 'прийняв інший офер',
    labelEn: 'Accepted another offer',
    sortOrder: 10,
  },
  silence_timeout: { side: 'system', labelUk: 'тиша', labelEn: 'Silence timeout', sortOrder: 11 },
  unspecified: {
    side: 'system',
    labelUk: 'не хочу зараз вказувати',
    labelEn: 'Rather not say now',
    sortOrder: 12,
  },
};
