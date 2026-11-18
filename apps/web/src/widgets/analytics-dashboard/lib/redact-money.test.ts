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
    {
      form: 'a comma thousands separator',
      text: 'Нижче $4,000 на місяць',
      hidden: 'Нижче приховано на місяць',
    },
    {
      form: 'thousands written as тис.',
      text: 'Просили 4 тис. грн на руки',
      hidden: 'Просили приховано на руки',
    },
    {
      form: 'thousands written as a k',
      text: 'Офер на $4k прийшов',
      hidden: 'Офер на приховано прийшов',
    },
    {
      form: 'a euro sign before the amount',
      text: 'Вилка €3 500 нетто',
      hidden: 'Вилка приховано нетто',
    },
    { form: 'euro spelled out', text: 'Вилка 3 500 євро нетто', hidden: 'Вилка приховано нетто' },
    {
      form: 'EUR before the amount',
      text: 'Вилка EUR 3.500 нетто',
      hidden: 'Вилка приховано нетто',
    },
    {
      form: 'a hryvnia sign after the amount',
      text: 'Вилка 90 000₴ нетто',
      hidden: 'Вилка приховано нетто',
    },
    {
      form: 'hryvnias spelled out',
      text: 'Вилка 90 тисяч гривень нетто',
      hidden: 'Вилка приховано нетто',
    },
    { form: 'a range', text: 'Вилка $3,800–4,200 нетто', hidden: 'Вилка приховано нетто' },
    {
      form: 'an uppercase K before USD',
      text: 'Офер на 4K USD прийшов',
      hidden: 'Офер на приховано прийшов',
    },
    {
      form: 'a Cyrillic capital К before грн',
      text: 'Вилка 4 К грн нетто',
      hidden: 'Вилка приховано нетто',
    },
  ])('hides $form', ({ text, hidden }) => {
    expect(redactMoney(text)).toBe(hidden);
  });

  it('$4K, 4000 usd and the lower end of від 3000 до 4000 грн are hidden', () => {
    expect(redactMoney('Офер $4K, потім 4000 usd, вилка від 3000 до 4000 грн')).toBe(
      'Офер приховано, потім приховано, вилка від приховано',
    );
  });

  it('hides both ends of від 3000 до $4000 and від 3000 до USD 4000', () => {
    expect(redactMoney('вилка від 3000 до $4000')).toBe('вилка від приховано');
    expect(redactMoney('вилка від 3000 до USD 4000')).toBe('вилка від приховано');
  });

  it('hides 5000 PLN and £4000', () => {
    expect(redactMoney('Офер 5000 PLN, раніше £4000')).toBe('Офер приховано, раніше приховано');
  });

  it('$4,000 and 4 тис. грн are hidden', () => {
    expect(redactMoney('Від $4,000 до 4 тис. грн на місяць')).toBe(
      'Від приховано до приховано на місяць',
    );
  });

  it('hides every amount in a text that holds several', () => {
    expect(redactMoney('Від $3 800 до 4 100 USD.')).toBe('Від приховано до приховано.');
  });

  it('starts an amount at a word boundary, so a number glued to a word stays', () => {
    const text = 'Збірка v2 USD-рахунку та IPv4 грн-гаманця.';

    expect(redactMoney(text)).toBe(text);
  });

  it('leaves a text with no money in it as it was, counts and percents included', () => {
    const text = '54 відгуки, 17 скринінгів, конверсія 43%. Ще 2 000 кроків до офера.';

    expect(redactMoney(text)).toBe(text);
  });
});
