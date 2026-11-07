import { describe, expect, it } from 'vitest';

import { modelDataItems } from './model-data-items';

describe('modelDataItems', () => {
  it('lists one line for each field an AI kind sends to the model, and nothing the code does not send', () => {
    expect(modelDataItems()).toEqual([
      {
        id: 'vacancy_parse.text',
        text: 'Текст вакансії: з нього модель дістає компанію, посаду, зарплату, формат роботи й стек.',
      },
    ]);
  });
});
