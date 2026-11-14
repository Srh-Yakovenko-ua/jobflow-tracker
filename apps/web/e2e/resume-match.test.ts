import path from 'node:path';

import { uk } from '@/shared/i18n';

import { addByPaste, boardAfterParse, parsedSampleCard } from './test/applications';
import { boardCard } from './test/board';
import { reloadUntilVisible } from './test/reload';
import { expect, test } from './test/session';
import { postAnswered, REPO_ROOT } from './test/stack';

const QA_JUNIOR_CV = path.join(REPO_ROOT, 'apps/api/src/modules/ai/evals/resume/03-qa-junior.pdf');

const RESUMES = uk.resumes;

const MATCH = uk.applicationPage.match;

const PARSED = parsedSampleCard();

function scorePattern(copyOf: (score: number) => string): RegExp {
  return new RegExp(copyOf(0).replace('0', String.raw`\d+`), 'u');
}

test('an uploaded CV gives a pasted vacancy its Match Score and an open breakdown', async ({
  page,
}) => {
  await page.goto('/resumes');
  await page.getByLabel(RESUMES.upload.pick).first().setInputFiles(QA_JUNIOR_CV);
  const created = postAnswered(page, '/resumes/versions');
  await page.getByRole('button', { name: RESUMES.upload.submit, exact: true }).click();
  expect((await created).ok()).toBe(true);
  await reloadUntilVisible(page, page.getByText(RESUMES.aiProfile.done));

  await addByPaste(page);
  await boardAfterParse(page);

  const card = boardCard(page, PARSED);
  const score = card.getByRole('img', { name: scorePattern(uk.application.score.value) });
  await reloadUntilVisible(page, score);
  await card.click();

  await expect(page.getByText(scorePattern(MATCH.score))).toBeVisible();
  await expect(
    page
      .getByRole('list', { name: MATCH.matched })
      .or(page.getByRole('list', { name: MATCH.missing }))
      .first(),
  ).toBeVisible();
});
