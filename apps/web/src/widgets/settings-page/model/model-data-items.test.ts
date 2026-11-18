import { describe, expect, it } from 'vitest';

import { modelDataItems } from './model-data-items';

describe('modelDataItems', () => {
  it('lists one line for each AI feature with what it sends to the model, then says only dictionary theme words from notes reach the model', () => {
    expect(modelDataItems()).toEqual([
      { id: 'vacancy_parse', text: 'Розбір вакансії: текст вакансії.' },
      {
        id: 'resume_parse',
        text: 'Розбір резюме: текст резюме без контактів, скан, якщо немає тексту.',
      },
      { id: 'match', text: 'Match Score: текст вакансії, профіль резюме.' },
      {
        id: 'followup',
        text: 'Фоллоу-ап: імʼя рекрутера, компанія, посада, етап, дні тиші, остання співбесіда, твоє імʼя, мова, тон, твоя підказка.',
      },
      {
        id: 'monthly_summary',
        text: 'Місячне AI-саммарі: місяці, лише цифри статистики, висновки, поради, прогрес плану.',
      },
      {
        id: 'cv_hints',
        text: 'Підказки до CV: посада, Match Score, вимоги вакансії, профіль резюме.',
      },
      {
        id: 'interview_prep',
        text: 'Підготовка до співбесіди: посада, тип співбесіди, вимоги вакансії, прогалини резюме, слабкі місця.',
      },
      { id: 'notes', text: 'Текст нотаток у модель не йде, лише слова-теми зі словника.' },
    ]);
  });
});
