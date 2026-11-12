import { describe, expect, it } from 'vitest';

import { modelDataItems } from './model-data-items';

describe('modelDataItems', () => {
  it('lists one line for each field an AI kind sends to the model, and nothing the code does not send', () => {
    expect(modelDataItems()).toEqual([
      {
        id: 'vacancy_parse.text',
        text: 'Текст вакансії: з нього модель дістає компанію, посаду, зарплату, формат роботи й стек.',
      },
      {
        id: 'resume_parse.text',
        text: 'Текст резюме без email, телефону, Telegram і адреси: з нього модель збирає навички, роки досвіду, рівень і англійську.',
      },
      {
        id: 'resume_parse.pages',
        text: 'Сторінки скану резюме як зображення, до трьох: лише коли у файлі немає тексту.',
      },
      {
        id: 'match.vacancy',
        text: 'Посада, стек і текст вакансії: з них модель виділяє вимоги та їхню вагу.',
      },
      {
        id: 'match.profile',
        text: 'Профіль резюме без цитат, компаній і контактів: навички з роками, рівень, англійська, домени й досвід лідерства. З ним модель звіряє кожну вимогу.',
      },
    ]);
  });
});
