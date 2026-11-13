import { Chart } from 'chart.js';
import { describe, expect, it } from 'vitest';

import { seriesEntryDelay } from './register';

const ENTRY = { type: 'data', mode: 'default', dataIndex: 0, datasetIndex: 0 };

describe('chart registration', () => {
  it('series enter in 820 ms easeOutQuart, 45 ms later per point and 90 ms later per series', () => {
    expect(Chart.defaults.animation).toMatchObject({
      duration: 820,
      easing: 'easeOutQuart',
      delay: seriesEntryDelay,
    });
    expect(seriesEntryDelay({ ...ENTRY, dataIndex: 1 })).toBe(45);
    expect(seriesEntryDelay({ ...ENTRY, datasetIndex: 1 })).toBe(90);
    expect(seriesEntryDelay({ ...ENTRY, dataIndex: 2, datasetIndex: 1 })).toBe(180);
  });

  it('only the first draw is staggered, an update or a resize moves every point at once', () => {
    expect(seriesEntryDelay({ ...ENTRY, dataIndex: 3, mode: 'resize' })).toBe(0);
    expect(seriesEntryDelay({ ...ENTRY, dataIndex: 3, type: 'dataset' })).toBe(0);
  });

  it('hover and tooltip answer in the fast token', () => {
    expect(Chart.defaults.transitions['active']?.animation).toEqual({
      duration: 180,
      easing: 'easeOutQuart',
    });
    expect(Chart.defaults.plugins.tooltip.animation).toMatchObject({
      duration: 180,
      easing: 'easeOutQuart',
    });
  });

  it('draws the #s14 tooltip and legend shape: radius 10, padding 10, 9 px colour boxes', () => {
    expect(Chart.defaults.font.size).toBe(11);
    expect(Chart.defaults.plugins.tooltip).toMatchObject({
      cornerRadius: 10,
      padding: 10,
      boxWidth: 9,
      boxHeight: 9,
      displayColors: true,
      titleFont: { size: 12, weight: 600 },
      bodyFont: { size: 12 },
    });
    expect(Chart.defaults.plugins.legend.labels).toMatchObject({
      boxWidth: 9,
      boxHeight: 9,
      padding: 14,
      usePointStyle: false,
      font: { size: 11.5 },
    });
  });

  it('registers the bar and the sankey controllers the charts draw with', () => {
    expect(Chart.registry.getController('bar')).toBeDefined();
    expect(Chart.registry.getController('sankey')).toBeDefined();
    expect(Chart.registry.getElement('flow')).toBeDefined();
  });
});
