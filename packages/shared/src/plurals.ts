export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export const DAY_FORMS_UK: PluralForms = { one: 'день', few: 'дні', other: 'днів' };

const UKRAINIAN_PLURALS = new Intl.PluralRules('uk');

export function pluralUk(count: number, forms: PluralForms): string {
  return forms[UKRAINIAN_PLURALS.select(count)] ?? forms.other;
}

export function countedUk(count: number, forms: PluralForms): string {
  return `${String(count)} ${pluralUk(count, forms)}`;
}
