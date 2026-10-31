import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OUTAGES } from '@/test/api-handlers';
import { waitForQuery } from '@/test/query-status';
import { regionOf, renderLoadedSettings, SUGGESTIONS_KEY } from '@/test/render-settings-page';

vi.mock('next/navigation', () => import('@/test/navigation'));

const FINAL_STAGE =
  'На етапі «фінал» поріг автоматично подвоюється: там 24 дні — норма, і нагадування були б хибними.';

const searchRegion = () => within(regionOf('Пошук і тиша'));

const hint = () => searchRegion().getByText(/На етапі «фінал»/).textContent;

afterEach(() => {
  toast.dismiss();
});

describe('SearchSection', () => {
  it('a stored 12 days shows the big number with no preset picked', async () => {
    await renderLoadedSettings();

    expect(searchRegion().getByText('днів після останньої події')).toBeDefined();
    expect(searchRegion().getByText('12')).toBeDefined();
    const presets = searchRegion().getByRole('radiogroup', { name: 'Поріг тиші в днях' });
    expect(
      within(presets)
        .getAllByRole('radio')
        .map((radio) => [radio.textContent, radio.getAttribute('aria-checked')]),
    ).toEqual([
      ['3', 'false'],
      ['7', 'false'],
      ['14', 'false'],
      ['21', 'false'],
    ]);
  });

  it('a preset sends only the threshold, shows it at once and then says it is saved', async () => {
    const { user, routes } = await renderLoadedSettings();

    await user.click(searchRegion().getByRole('radio', { name: '14' }));

    expect(searchRegion().getByRole('radio', { name: '14' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(await searchRegion().findByText('Збережено')).toBeDefined();
    expect(routes.patches).toEqual([{ silenceDays: 14 }]);
    expect(hint()).toContain('там 28 днів — норма');
  });

  it('the hint recommends the preset that covers the suggestion and names the final-stage doubling', async () => {
    await renderLoadedSettings();
    await waitForQuery({ queryKey: SUGGESTIONS_KEY, status: 'success' });

    expect(hint()).toBe(
      `Твоя медіана відповіді — 6 днів, тому 14 — розумний поріг. ${FINAL_STAGE}`,
    );
  });

  it('with too few answers the hint gives the starting value instead of a median', async () => {
    await renderLoadedSettings({
      suggestions: () =>
        HttpResponse.json({ silenceDays: 7, medianResponseDays: null, answeredApplications: 1 }),
    });
    await waitForQuery({ queryKey: SUGGESTIONS_KEY, status: 'success' });

    expect(hint()).toBe(
      `Поки замало відповідей, щоб порадити поріг; 7 днів — стартове значення. ${FINAL_STAGE}`,
    );
  });

  it.each(OUTAGES)(
    'when the suggestions $name the hint keeps only the final-stage sentence and raises no alarm',
    async ({ reply, settled }) => {
      await renderLoadedSettings({ suggestions: reply });
      await waitForQuery({ queryKey: SUGGESTIONS_KEY, status: settled });

      expect(hint()).toBe(FINAL_STAGE);
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('turning auto ghost on saves the 30-day default', async () => {
    const { user, routes } = await renderLoadedSettings();
    const autoGhost = searchRegion().getByRole('switch', { name: /після 30 днів тиші/ });

    await user.click(autoGhost);

    await waitFor(() => {
      expect(routes.patches).toEqual([{ autoGhostDays: 30 }]);
    });
    expect(autoGhost.getAttribute('aria-checked')).toBe('true');
  });

  it('a stored 45 days names its own number, and turning it off saves no auto ghost', async () => {
    const { user, routes } = await renderLoadedSettings({ settings: { autoGhostDays: 45 } });

    await user.click(searchRegion().getByRole('switch', { name: /після 45 днів тиші/ }));

    await waitFor(() => {
      expect(routes.patches).toEqual([{ autoGhostDays: null }]);
    });
  });

  it.each(OUTAGES)(
    'when saving $name the switch goes back and the reader is told, or it says it is saving',
    async ({ reply, settled }) => {
      const { user } = await renderLoadedSettings({ patch: { reply } });
      const askReason = searchRegion().getByRole('switch', { name: /Питати причину/ });

      await user.click(askReason);

      if (settled === 'pending') {
        expect(await searchRegion().findByText('Зберігаю…')).toBeDefined();
        expect(askReason.getAttribute('aria-checked')).toBe('false');
        return;
      }
      expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
      expect(askReason.getAttribute('aria-checked')).toBe('true');
    },
  );
});
