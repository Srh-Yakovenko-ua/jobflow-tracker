import type { Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { addByHand, type HandCard, uniqueCompany } from './test/applications';
import { reloadUntilVisible } from './test/reload';
import { expect, test } from './test/session';
import { WORKER_WAIT } from './test/stack';
import { makeSilent } from './test/time-travel';
import { toastRegion } from './test/toasts';

const FOLLOWUP = uk.followup;

const SCHEDULE = uk.applicationPage.schedule;

const CALENDAR_LOAD = { timeout: 10_000 } as const;

function followupPanelIn(page: Page, card: HandCard) {
  return page
    .getByRole('dialog', { name: card.position })
    .getByRole('region', { name: FOLLOWUP.kicker });
}

async function sendFollowup(page: Page): Promise<void> {
  const panel = page.getByRole('region', { name: FOLLOWUP.kicker });
  await panel.getByRole('button', { name: FOLLOWUP.generate }).click();
  await panel.getByRole('button', { name: FOLLOWUP.markSent }).click(WORKER_WAIT);
  await expect(toastRegion(page).getByText(FOLLOWUP.sent)).toBeVisible();
}

async function openFromCalendar(page: Page, card: HandCard): Promise<void> {
  await page.goto('/calendar');
  const event = page.getByRole('main').getByRole('button', { name: card.company }).first();
  const inShownPeriod = await event.waitFor(CALENDAR_LOAD).then(
    () => true,
    () => false,
  );
  if (!inShownPeriod) await page.getByRole('button', { name: uk.calendarPage.next }).click();
  await event.click();
}

async function scheduleTomorrow(page: Page): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: SCHEDULE.action, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: SCHEDULE.titles.schedule });
  await dialog.getByRole('button', { name: SCHEDULE.save.schedule, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('a silent card reaches reminders, gets a follow-up, and the panel opens from the table and the calendar', async ({
  page,
  request,
  user,
}) => {
  const card: HandCard = { company: uniqueCompany('Silent'), position: 'Middle QA Engineer' };
  const applicationId = await addByHand(page, card);
  await makeSilent({ request, user, applicationId });

  await page.goto('/reminders');
  const row = page.getByRole('article', { name: card.company });
  await reloadUntilVisible(page, row);
  await row.getByRole('link', { name: uk.reminders.actions.followUp }).click();
  await page.waitForURL(`**/applications/${applicationId}#follow-up`);
  await sendFollowup(page);
  await scheduleTomorrow(page);

  await page.goto('/applications');
  await page.getByRole('link').filter({ hasText: card.company }).first().click();
  await expect(followupPanelIn(page, card)).toBeVisible();

  await openFromCalendar(page, card);
  await expect(followupPanelIn(page, card)).toBeVisible();
});
