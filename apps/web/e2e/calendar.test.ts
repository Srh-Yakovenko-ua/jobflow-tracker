import { uk } from '@/shared/i18n';

import { expect, test } from './test/session';

test('the unavailable Сьогодні stays still under the pointer while an enabled toolbar button lifts', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/calendar');
  const today = page.getByRole('button', { name: uk.calendar.today, exact: true });
  const next = page.getByRole('button', { name: uk.calendarPage.next });
  await expect(today).toHaveAttribute('aria-disabled', 'true');

  await today.hover();
  await expect(today).toHaveCSS('translate', 'none');

  await next.hover();
  await expect(next).toHaveCSS('translate', '0px -1px');
});
