import type { Locator, Page } from '@playwright/test';

const PAGE_OBJECT = /\/Type\s*\/Page(?!s)/g;

export function paperOf(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).getPropertyValue('--paper').trim());
}

export async function printedA4Pages(page: Page): Promise<number> {
  const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');
  return pdf.match(PAGE_OBJECT)?.length ?? 0;
}
