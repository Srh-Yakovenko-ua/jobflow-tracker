import { randomUUID } from 'node:crypto';

import {
  type ApplicationResponse,
  type CreateApplicationInput,
  createApplicationResponseSchema,
} from '@jobflow/shared';
import { buildVacancyParseOutput, VACANCY_SAMPLE_TEXT } from '@jobflow/shared/testing';
import type { Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { postAnswered, WORKER_WAIT } from './stack';

export type HandCard = Pick<CreateApplicationInput, 'company' | 'position'>;

const COPY = uk.add;

export function parsedSampleCard(): HandCard {
  const { company, position } = buildVacancyParseOutput();
  if (company.value === null || position.value === null) {
    throw new Error('the vacancy parse fixture lost its company or position');
  }
  return { company: company.value, position: position.value };
}

export function uniqueCompany(name: string): string {
  return `${name} ${randomUUID().slice(0, 8)}`;
}

export async function addByHand(page: Page, card: HandCard): Promise<ApplicationResponse['id']> {
  await page.goto('/add');
  const created = postAnswered(page, '/applications');
  await page.getByLabel(COPY.manual.fields.company, { exact: true }).fill(card.company);
  await page.getByLabel(COPY.manual.fields.position, { exact: true }).fill(card.position);
  await page.getByRole('button', { name: COPY.manual.submit }).click();
  return createApplicationResponseSchema.parse(await (await created).json()).id;
}

export async function addByPaste(page: Page, text: string = VACANCY_SAMPLE_TEXT): Promise<void> {
  await page.goto('/add');
  await page.getByLabel(COPY.paste.fields.text, { exact: true }).fill(text);
  await page.getByRole('button', { name: COPY.paste.submit }).click();
}

export async function boardAfterParse(page: Page): Promise<void> {
  const live = page.getByRole('region', { name: COPY.explainer.title });
  const ready = live.getByRole('link', { name: COPY.added.toBoard });
  const review = live
    .getByRole('form', { name: COPY.review.title })
    .getByRole('button', { name: COPY.review.confirm });
  await ready.or(review).click(WORKER_WAIT);
  await page.waitForURL('**/board');
}
