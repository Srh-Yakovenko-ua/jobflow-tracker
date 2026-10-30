import { screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { axeViolations, findLiveToaster, renderGallery, specimenOf } from '@/test/dev-ui';
import { quietLogs } from '@/test/quiet-logs';

const DEMO = uk.devUi.errorPanels.crashDemo;

const EMPTY_TITLES = [
  'Тут буде твоя воронка',
  'Завантаж перше резюме',
  'Усі відповіли',
  'Немає карточок за «kafka»',
  '17 компаній не відповіли',
  'Офер прийнято',
];

const SPECIMEN_LINES = [
  "колонки «відмова» і «ghosted» з'являться, коли будуть потрібні",
  'перетягни PDF або DOCX',
  '0 карточок у тиші',
  'AI пише саммарі',
  'у черзі · 2 задачі перед твоєю · ~30 с',
  'готово за 6 с',
  'AI не впорався',
  'Усе збережене раніше ціле. Аналітика поки показує дані на 15:42.',
  'Розбір затримується',
  '3 карточки чекають',
  'Резюме важить 8,4 МБ',
  'Не вдалося завантажити',
  'код 5f3a · 07.09, 16:04',
  'CV v2 працює краще',
  "41% проти 24%. Нові відгуки прив'язуємо до v2.",
  'Перші висновки — на 10 відгуках, прогноз — на 15. Зараз 4.',
];

const STATE_ACTIONS = [
  'Додати першу вакансію',
  'Встановити букмарклет',
  'Спробувати фоллоу-ап по 4 свіжих',
  'Заархівувати пошук',
  'Зробити вручну',
  'Спробувати ще раз',
  'Спробувати зараз',
  'Обрати інший файл',
  'Перезавантажити',
  'Зламати блок',
];

function skeletonSection(): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: 'Скелетони' }).closest('section');
  if (section === null) throw new Error('the 03 skeleton section is missing');
  return section;
}

function shimmeringBars(container: HTMLElement): number {
  return container.querySelectorAll('[class*="animate-shimmer"]').length;
}

describe('/dev/ui states from the empty states screen', () => {
  afterEach(() => {
    toast.dismiss();
    vi.restoreAllMocks();
  });

  it('shows every empty, loading and error specimen of sections 01 to 04 and the #s13 banners', () => {
    renderGallery();

    for (const title of EMPTY_TITLES) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeDefined();
    }
    expect(screen.getAllByRole('heading', { level: 2, name: 'Порахувати ще нічого' })).toHaveLength(
      2,
    );
    for (const line of SPECIMEN_LINES) {
      expect(screen.getAllByText(line).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Працюєш офлайн')).toHaveLength(2);
    expect(screen.getAllByText('крок 2 з 3 · обробляється')).toHaveLength(2);
    expect(screen.getAllByText('~20 с · можна закрити сторінку')).toHaveLength(2);
  });

  it('the analytics specimen fills 4 of 10 meter segments', () => {
    renderGallery();

    const meter = screen.getByRole('meter', { name: 'Прогрес до першого висновку' });
    expect(meter.getAttribute('aria-valuenow')).toBe('4');
    expect(meter.getAttribute('aria-valuetext')).toBe('4 / 10');
    expect(meter.querySelectorAll('.bg-stage-screening')).toHaveLength(4);
  });

  it('the failed AI job offers the manual path first and a retry second', () => {
    renderGallery();

    const failed = screen.getByText('AI не впорався').closest<HTMLElement>('[role="status"]');
    const labels = [...(failed?.querySelectorAll('button') ?? [])].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual(['Зробити вручну', 'Спробувати ще раз']);
  });

  it('every state action grows to a 44 px touch target under md and keeps its drawn height above', () => {
    renderGallery();

    const actions = STATE_ACTIONS.flatMap((name) => screen.getAllByRole('button', { name }));
    expect(actions).toHaveLength(11);
    for (const action of actions) {
      expect(action.className).toContain('max-md:min-h-11');
      expect(action.className).toMatch(/\bh-control-(md|lg)\b/);
    }
  });

  it('the 03 skeletons shimmer, and 20 more card skeletons turn every one static', async () => {
    const user = renderGallery();
    expect(shimmeringBars(skeletonSection())).toBe(7);

    await user.click(screen.getByRole('switch', { name: '20 скелетонів одразу' }));

    expect(shimmeringBars(skeletonSection())).toBe(0);
  });

  it('a crashed widget shows the crash panel while the live toast elsewhere still fires, and reload brings it back', async () => {
    const logged = quietLogs();
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: DEMO.break }));
    const demo = specimenOf(DEMO.eyebrow);
    expect(demo.getByText('Блок впав')).toBeDefined();
    expect(demo.queryByText(DEMO.widget)).toBeNull();
    expect(logged).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: uk.devUi.feedback.fireToast }));
    expect((await findLiveToaster()).getByText(uk.devUi.feedback.realToast.title)).toBeDefined();

    await user.click(demo.getByRole('button', { name: 'Перезавантажити' }));
    expect(demo.getByText(DEMO.widget)).toBeDefined();
    expect(demo.queryByText('Блок впав')).toBeNull();
  });

  it('has no axe violations with the widget crashed and 20 skeletons on', async () => {
    quietLogs();
    const user = renderGallery();

    await user.click(screen.getByRole('button', { name: DEMO.break }));
    await user.click(screen.getByRole('switch', { name: '20 скелетонів одразу' }));

    expect(await axeViolations()).toEqual([]);
  });
});
