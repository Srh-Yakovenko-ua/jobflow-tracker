import { buildForecast } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { DESIGN_FORECAST_TEXT } from '@/test/forecast-fixtures';

import { forecastViewOf, type OkForecast } from './forecast-view';

const viewOf = (change: Partial<OkForecast> = {}) =>
  forecastViewOf({ forecast: { ...buildForecast(), ...change }, improved: false });

describe('forecastViewOf', () => {
  it('reads the 28 application forecast as the drawn block: corridor headline, legend, both odds and what the model saw', () => {
    const view = viewOf();

    expect(view.headline).toBe(DESIGN_FORECAST_TEXT.headline);
    expect(view.caption).toBe(DESIGN_FORECAST_TEXT.caption);
    expect(view.legend).toEqual(DESIGN_FORECAST_TEXT.legend);
    expect(view.odds).toBe(DESIGN_FORECAST_TEXT.odds);
    expect(view.note).toBe(DESIGN_FORECAST_TEXT.note);
  });

  it('the tech interview what-if names the 60% conversion in the caption instead of the current ones', () => {
    const view = forecastViewOf({ forecast: buildForecast(), improved: true });

    expect(view.caption).toBe(
      "Ймовірний коридор: половина симуляцій. Темп 2,0 на тиждень, техінтерв'ю 60%.",
    );
  });

  it('places the corridor, the 80% interval and the median on a 16 week axis, pinning the interval end past 16+', () => {
    const { band } = viewOf();

    expect(band.ticks).toEqual(['0', '4 тиж', '8 тиж', '12 тиж', '16+']);
    expect(band.likely).toEqual({ left: 14.31, width: 39.19 });
    expect(band.interval).toEqual({ left: 12.5, width: 87.5 });
    expect(band.median).toBe(27.44);
  });

  it('a corridor ending past 16 weeks stretches the axis to 32', () => {
    const { band, headline } = viewOf({ likely: { low: 10.4, high: 20.8 } });

    expect(band.ticks).toEqual(['0', '8 тиж', '16 тиж', '24 тиж', '32+']);
    expect(band.likely).toEqual({ left: 32.5, width: 32.5 });
    expect(headline).toBe('10–21 тиждень');
  });

  it('a corridor with no upper bound inside the horizon reads from its low bound to past the horizon and spans to the edge of a 52 week axis', () => {
    const view = viewOf({ likely: { low: 2.29, high: null } });

    expect(view.headline).toBe('від 2 до понад 52 тижнів');
    expect(view.legend[0]).toBe('ймовірний коридор від 2 до понад 52 тижнів');
    expect(view.band.ticks).toEqual(['0', '13 тиж', '26 тиж', '39 тиж', '52+']);
    expect(view.band.likely).toEqual({ left: 4.4, width: 95.6 });
  });

  it('a forecast entirely past the horizon says "понад 52 тижні" for the corridor and the median', () => {
    const view = viewOf({
      medianWeeks: null,
      likely: { low: null, high: null },
      interval: { low: 30.5, high: null },
    });

    expect(view.headline).toBe('понад 52 тижні');
    expect(view.legend).toEqual([
      'ймовірний коридор понад 52 тижні',
      'увесь 80% інтервал: від 31 до понад 52 тижнів',
      'медіана: понад 52 тижні',
    ]);
    expect(view.band.median).toBe(100);
    expect(view.band.likely).toEqual({ left: 98.5, width: 1.5 });
  });

  it('an 80% interval from week 0 with no upper bound starts at 1 week and names the horizon instead of "понад 0 тижнів"', () => {
    const view = viewOf({ interval: { low: 0, high: null } });

    expect(view.legend[1]).toBe('увесь 80% інтервал: від 1 до понад 52 тижнів');
  });

  it('a median under one week reads "1 тиждень" like the headline, never "0,0 тижня"', () => {
    const view = viewOf({ medianWeeks: 0.04, likely: { low: 0.02, high: 0.3 } });

    expect(view.headline).toBe('1 тиждень');
    expect(view.legend[2]).toBe('медіана: 1 тиждень');
  });

  it('bounds that round to the same week read as one count, and a zero width corridor stays visible', () => {
    const view = viewOf({ likely: { low: 5, high: 5.2 } });

    expect(view.headline).toBe('5 тижнів');
    expect(view.band.likely).toEqual({ left: 31.25, width: 1.5 });
  });
});
