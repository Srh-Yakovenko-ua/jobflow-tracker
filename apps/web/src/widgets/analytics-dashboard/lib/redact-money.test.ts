import { describe, expect, it } from 'vitest';

import { redactMoney } from './redact-money';

const NBSP = ' ';

const THIN = ' ';

describe('redactMoney', () => {
  it.each([
    { form: 'a dollar sign before the amount', text: 'Нижче $4 000.', hidden: 'Нижче приховано.' },
    {
      form: 'a dollar sign with a no-break thousands space',
      text: `Нижче $4${NBSP}500.`,
      hidden: 'Нижче приховано.',
    },
    {
      form: 'a dollar sign after the amount',
      text: 'Підняти до 4000 $ на місяць',
      hidden: 'Підняти до приховано на місяць',
    },
    {
      form: 'USD after the amount',
      text: `Офер на 4${THIN}000 USD прийшов`,
      hidden: 'Офер на приховано прийшов',
    },
    {
      form: 'dollars spelled out',
      text: 'Просили 5 200 доларів, дали менше',
      hidden: 'Просили приховано, дали менше',
    },
    { form: 'hryvnias', text: 'Вилка 120 000 грн на руки', hidden: 'Вилка приховано на руки' },
  ])('hides $form', ({ text, hidden }) => {
    expect(redactMoney(text)).toBe(hidden);
  });

  it('hides every amount in a text that holds several', () => {
    expect(redactMoney('Від $3 800 до 4 100 USD.')).toBe('Від приховано до приховано.');
  });

  it('leaves a text with no money in it as it was, counts and percents included', () => {
    const text = '54 відгуки, 17 скринінгів, конверсія 43%. Ще 2 000 кроків до офера.';

    expect(redactMoney(text)).toBe(text);
  });
});
