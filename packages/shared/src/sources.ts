import { z } from 'zod';

import type { LocalizedLabel } from './labels.js';

export const SOURCES = [
  'djinni',
  'dou',
  'robota',
  'workua',
  'linkedin',
  'referral',
  'company_site',
  'other',
] as const;

export const sourceSchema = z.enum(SOURCES);

export type Source = z.infer<typeof sourceSchema>;

export const SOURCE_LABELS: Record<Source, LocalizedLabel> = {
  djinni: { labelUk: 'Djinni', labelEn: 'Djinni' },
  dou: { labelUk: 'DOU', labelEn: 'DOU' },
  robota: { labelUk: 'robota.ua', labelEn: 'robota.ua' },
  workua: { labelUk: 'Work.ua', labelEn: 'Work.ua' },
  linkedin: { labelUk: 'LinkedIn', labelEn: 'LinkedIn' },
  referral: { labelUk: 'рефералка', labelEn: 'Referral' },
  company_site: { labelUk: 'сайт компанії', labelEn: 'Company site' },
  other: { labelUk: 'інше', labelEn: 'Other' },
};
