import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { renderGallery, sectionTitled, specimenOf } from '@/test/dev-ui';

const COPY = uk.devUi.charts;

function chartIn(frame: string) {
  return within(screen.getByRole('region', { name: frame })).getByRole('img');
}

describe('/dev/ui charts', () => {
  it('draws the #s14 rejection bar chart on a canvas named with every reason and its count', () => {
    renderGallery();

    const bar = chartIn(COPY.rejections.header.eyebrow);
    expect(bar.tagName).toBe('CANVAS');
    expect(bar.getAttribute('aria-label')).toBe(
      'Причини відмов: обрали іншого 10, без пояснення 6, вакансію закрили 4, не вистачає скілів 4, рівень англійської 3, зарплатні очікування 5',
    );
  });

  it('draws the sankey funnel on a canvas named with every flow from stage to outcome', () => {
    renderGallery();

    const funnel = chartIn(COPY.funnel.header.eyebrow);
    expect(funnel.tagName).toBe('CANVAS');
    expect(funnel.getAttribute('aria-label')).toBe(
      "Воронка відгуків: відгук → скринінг 14, відгук → відмова 8, відгук → ghosted 10, скринінг → техінтерв'ю 8, скринінг → відмова 4, скринінг → ghosted 2, техінтерв'ю → офер 2, техінтерв'ю → відмова 6",
    );
  });

  it('shows the chart frame loading, short of data and failed', () => {
    renderGallery();

    expect(specimenOf(COPY.states.loading.eyebrow).getByRole('status').textContent).toBe(
      'Завантаження…',
    );
    const meter = specimenOf(COPY.states.insufficient.eyebrow).getByRole('meter');
    expect(meter.getAttribute('aria-valuetext')).toBe('4 / 10');
    const failed = specimenOf(COPY.states.failed.eyebrow);
    expect(failed.getByRole('alert').textContent).toContain('Не вдалося завантажити');
    expect(failed.getByRole('button', { name: 'Спробувати ще раз' })).toBeDefined();
  });

  it('colours nothing in the section with a raw hex class', () => {
    renderGallery();

    const classes = [...sectionTitled(COPY.title).querySelectorAll('[class]')].map(
      (element) => element.getAttribute('class') ?? '',
    );
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((className) => /#[0-9a-f]{3,8}/i.test(className))).toEqual([]);
  });
});
