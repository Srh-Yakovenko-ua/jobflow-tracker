import { APPLICATION_FORMS_UK, countedUk, type PluralForms } from '@jobflow/shared';

export const FORMS = {
  application: APPLICATION_FORMS_UK,
  screening: { one: 'скринінг', few: 'скринінги', other: 'скринінгів' },
  week: { one: 'тиждень', few: 'тижні', other: 'тижнів' },
  weekFraction: { other: 'тижня' },
  offer: { one: 'офер', few: 'офери', other: 'оферів' },
  company: { one: 'компанія', few: 'компанії', other: 'компаній' },
  silent: { one: 'не відповіла', other: 'не відповіли' },
  excluded: { one: 'Вона не входить', other: 'Вони не входять' },
  sample: { one: 'замір', few: 'заміри', other: 'замірів' },
  leftOut: { one: 'не входить', other: 'не входять' },
  followup: { one: 'фоллоу-ап', few: 'фоллоу-апи', other: 'фоллоу-апів' },
  ofApplication: { one: 'відгуку', other: 'відгуків' },
} as const satisfies Record<string, PluralForms>;

export type SourceCounts = Readonly<{ applied: number; screened: number }>;

export const applications = (count: number) => countedUk(count, FORMS.application);

export const sourceCounts = ({ applied, screened }: SourceCounts) =>
  `${applications(applied)}, ${countedUk(screened, FORMS.screening)}`;
