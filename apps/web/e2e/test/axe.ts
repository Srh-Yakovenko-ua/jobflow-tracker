import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

export type SeriousViolation = Readonly<{ id: string; targets: string[] }>;

export async function seriousViolations(page: Page): Promise<SeriousViolation[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations
    .filter(({ impact }) => BLOCKING_IMPACTS.has(impact ?? ''))
    .map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target.join(' ')) }));
}
