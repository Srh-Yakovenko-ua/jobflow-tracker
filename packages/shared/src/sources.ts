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

export const SOURCE_HOSTS = {
  djinni: 'djinni.co',
  dou: 'jobs.dou.ua',
  robota: 'robota.ua',
  linkedin: 'linkedin.com',
} satisfies Partial<Record<Source, string>>;

const hostOrSubdomainPattern = (host: string) =>
  new RegExp(`(^|\\.)${host.replaceAll('.', '\\.')}$`);

const sourceHosts: Partial<Record<Source, string>> = SOURCE_HOSTS;

const SOURCE_URL_SCHEMAS = SOURCES.flatMap((source) => {
  const host = sourceHosts[source];
  return host === undefined
    ? []
    : [{ source, urlSchema: z.url({ hostname: hostOrSubdomainPattern(host) }) }];
});

export function sourceOfUrl(url: string | null | undefined): Source {
  return (
    SOURCE_URL_SCHEMAS.find(({ urlSchema }) => urlSchema.safeParse(url).success)?.source ?? 'other'
  );
}
