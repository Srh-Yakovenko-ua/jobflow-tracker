import { buildDesignSources } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { rowTexts } from '@/test/table-rows';

import { sourceBarsOf } from './source-bars';

describe('sourceBarsOf', () => {
  it('plots the ranked sources with five samples or more at their served conversion and interval', () => {
    const { plotted } = sourceBarsOf(buildDesignSources());

    expect(
      plotted.map(({ label, value, whisker, href }) => [label.join(' / '), value, whisker, href]),
    ).toEqual([
      ['Djinni / 24 відгуки', 45, [26, 66], '/board?source=djinni'],
      ['DOU / 6 відгуків', 40, [12, 77], '/board?source=dou'],
      ['LinkedIn / 16 відгуків', 22, [6, 55], '/board?source=linkedin'],
    ]);
  });

  it('the tooltip of a plotted source reads the served percent with its interval and the raw counts', () => {
    const [djinni] = sourceBarsOf(buildDesignSources()).plotted;

    expect(djinni?.tip).toEqual(['конверсія у скринінг: 45% (26–66%)', '24 відгуки, 9 скринінгів']);
  });

  it('sends a source under five samples to the n<5 note with raw counts and the served note, never a percent', () => {
    const { small, plotted } = sourceBarsOf(buildDesignSources());

    expect(small.map(({ line, note }) => `${line} ${note}`)).toEqual([
      'рефералка: 3 відгуки, 3 скринінги. вибірка мала, але напрям однозначний',
      'сайт компанії: 2 відгуки, 1 скринінг. Відсоток на такій вибірці лише шум.',
      'robota.ua: 3 відгуки, 0 скринінгів. Відсоток на такій вибірці лише шум.',
    ]);
    expect(plotted.map(({ source }) => source)).toEqual(['djinni', 'dou', 'linkedin']);
  });

  it('the table lists every source with raw counts, and a share only above the sample floor', () => {
    const { rows } = sourceBarsOf(buildDesignSources());

    expect(rowTexts(rows)).toEqual([
      ['Djinni', '24', '9', '45%'],
      ['DOU', '6', '2', '40%'],
      ['LinkedIn', '16', '2', '22%'],
      ['рефералка', '3', '3', 'мало даних · Ще 2 відгуки до першого висновку'],
      ['сайт компанії', '2', '1', 'мало даних · Ще 3 відгуки до першого висновку'],
      ['robota.ua', '3', '0', 'мало даних · Ще 4 відгуки до першого висновку'],
    ]);
    expect(rows[2]?.cells[0]?.href).toBe('/board?source=linkedin');
  });
});
