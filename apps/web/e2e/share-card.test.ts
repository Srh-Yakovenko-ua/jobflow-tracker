import { readFile } from 'node:fs/promises';

import { DEMO_USER, type FunnelKpis, funnelResponseSchema } from '@jobflow/shared';
import type { Locator, Page } from '@playwright/test';
import { z } from 'zod';

import { uk } from '@/shared/i18n';
import { searchWeeks } from '@/shared/lib/search-weeks';

import { seriousViolations } from './test/axe';
import { demoPrivateTexts } from './test/demo';
import { expect, signedOutTest, signIn } from './test/session';
import { ANALYTICS_ORIGIN } from './test/stack';

const COPY = uk.shareCard;

const SCHEMES = ['light', 'dark'] as const;

const PNG_SIZE = { widthAt: 16, heightAt: 20 } as const;

const WRITES = new Set(['POST', 'PUT', 'PATCH']);

const NODE_COUNT_LABEL = /^відгук \d+$/;

async function recordDrawnText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const drawn: string[] = [];
    const prototype = CanvasRenderingContext2D.prototype;
    const fillText: unknown = Object.getOwnPropertyDescriptor(prototype, 'fillText')?.value;
    if (typeof fillText !== 'function') return;
    Reflect.set(window, 'drawnTexts', drawn);
    prototype.fillText = function recorded(
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D['fillText']>
    ) {
      if (!this.canvas.isConnected) drawn.push(args[0]);
      Reflect.apply(fillText, this, args);
    };
  });
}

async function drawnTexts(page: Page): Promise<string[]> {
  const drawn: unknown = await page.evaluate((): unknown => Reflect.get(window, 'drawnTexts'));
  return z.array(z.string()).parse(drawn);
}

async function cardDrawn(dialog: Locator): Promise<void> {
  await expect(dialog.getByRole('button', { name: COPY.download })).toBeEnabled();
}

async function openAnalytics(page: Page): Promise<FunnelKpis> {
  await signIn(page, DEMO_USER);
  const funnel = page.waitForResponse((response) =>
    response.url().startsWith(`${ANALYTICS_ORIGIN}/analytics/funnel`),
  );
  await page.goto('/analytics');
  return funnelResponseSchema.parse(await (await funnel).json()).kpis;
}

async function openShareDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: COPY.button }).click();
  const dialog = page.getByRole('dialog', { name: COPY.dialog.title });
  await cardDrawn(dialog);
  return dialog;
}

async function downloadedPngSize(page: Page, dialog: Locator) {
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: COPY.download }).click();
  const file = await download;
  const png = await readFile(await file.path());
  return {
    name: file.suggestedFilename(),
    width: png.readUInt32BE(PNG_SIZE.widthAt),
    height: png.readUInt32BE(PNG_SIZE.heightAt),
  };
}

signedOutTest(
  "the demo user's share card draws no company, position or note text, and hiding numbers drops every count",
  async ({ page, request }) => {
    const privateTexts = await demoPrivateTexts(request);
    await recordDrawnText(page);
    const kpis = await openAnalytics(page);
    const dialog = await openShareDialog(page);

    const counted = await drawnTexts(page);
    expect(counted.some((text) => NODE_COUNT_LABEL.test(text))).toBe(true);
    expect(counted).toContain(String(kpis.sent.total));
    expect(privateTexts.filter((text) => counted.some((drawn) => drawn.includes(text)))).toEqual(
      [],
    );

    await dialog.getByRole('switch', { name: COPY.hideNumbers }).click();
    await cardDrawn(dialog);

    const period = COPY.period(searchWeeks(kpis.daysInSearch));
    const hidden = (await drawnTexts(page)).slice(counted.length);
    expect(hidden).toContain(COPY.storyHidden);
    expect(hidden.filter((text) => text !== period && /\d/.test(text))).toEqual([]);
  },
);

for (const colorScheme of SCHEMES) {
  signedOutTest(
    `in ${colorScheme} the share card downloads a 1200x630 jobflow-funnel.png, copies a PNG, sends nothing to a server and has no serious axe violations`,
    async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await openAnalytics(page);
      const writes: string[] = [];
      page.on('request', (sent) => {
        if (WRITES.has(sent.method())) writes.push(`${sent.method()} ${sent.url()}`);
      });
      const dialog = await openShareDialog(page);
      await dialog.getByRole('radio', { name: uk.theme[colorScheme] }).click();
      await cardDrawn(dialog);

      expect(await downloadedPngSize(page, dialog)).toEqual({
        name: 'jobflow-funnel.png',
        width: 1200,
        height: 630,
      });
      await dialog.getByRole('button', { name: COPY.copy }).click();
      await expect(page.getByText(uk.ui.copied)).toBeVisible();
      const types = await page.evaluate(async () =>
        (await navigator.clipboard.read()).flatMap((item) => [...item.types]),
      );
      expect(types).toContain('image/png');
      expect(writes).toEqual([]);
      expect(await seriousViolations(page)).toEqual([]);
    },
  );
}
