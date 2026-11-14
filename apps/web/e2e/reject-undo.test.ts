import { type ErrorResponse, REJECTION_REASONS, STAGE_MOVE_LIMITS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { addByHand, type HandCard, uniqueCompany } from './test/applications';
import { boardCard, keyboardMove, stageColumn } from './test/board';
import { expect, test } from './test/session';
import { dismissToastByKeyboard, toastRegion } from './test/toasts';

const REJECT = uk.board.reject;

const CONFLICT = uk.board.move.conflict;

const MOVED_ELSEWHERE: ErrorResponse = {
  type: 'conflict',
  title: CONFLICT.title,
  status: 409,
  requestId: 'e2e-moved-elsewhere',
};

test.describe('reject with a reason, undo and a refused move', () => {
  test('a card rejected by keyboard with a reason comes back to відгук through undo', async ({
    page,
  }) => {
    const card: HandCard = { company: uniqueCompany('Reject'), position: 'QA Engineer' };
    await addByHand(page, card);
    await page.goto('/board');

    await keyboardMove(page, { card, stage: 'rejected' });
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: REJECT.title })).toBeVisible();
    await dialog.getByRole('button', { name: REJECTION_REASONS.skills_gap.labelUk }).click();
    await expect(dialog.getByText(REJECT.saved.eyebrow)).toBeVisible();
    await dialog
      .getByRole('button', { name: REJECT.saved.undo })
      .click({ timeout: STAGE_MOVE_LIMITS.undoWindowMs });

    await expect(stageColumn(page, 'applied').filter({ has: boardCard(page, card) })).toBeVisible();
  });

  test('a move refused with 409 rolls back, names the reason in a toast and closes by keyboard', async ({
    page,
  }) => {
    const card: HandCard = { company: uniqueCompany('Conflict'), position: 'QA Engineer' };
    await addByHand(page, card);
    await page.goto('/board');
    await page.route('**/api/v1/applications/*/events', (route) =>
      route.fulfill({ status: 409, json: MOVED_ELSEWHERE }),
    );

    await keyboardMove(page, { card, stage: 'screening' });

    await expect(toastRegion(page).getByText(CONFLICT.title)).toBeVisible();
    await expect(stageColumn(page, 'applied').filter({ has: boardCard(page, card) })).toBeVisible();
    await dismissToastByKeyboard(page, CONFLICT.title);
  });
});
