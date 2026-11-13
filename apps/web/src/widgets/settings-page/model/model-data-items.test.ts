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
      {
        id: 'followup.recruiterFirstName',
        text: 'Імʼя рекрутера, лише перше слово: щоб привітатися. Без нього лист почнеться загальним вітанням.',
      },
      { id: 'followup.company', text: 'Назва компанії: щоб лист був саме про неї.' },
      { id: 'followup.position', text: 'Посада з картки: щоб назвати роль, на яку ти подавався.' },
      { id: 'followup.stage', text: 'Поточний етап: щоб модель знала, після чого ти пишеш.' },
      { id: 'followup.silenceDays', text: 'Скільки днів тиші: щоб тон відповідав паузі.' },
      {
        id: 'followup.lastInterview',
        text: 'Тип і дата останньої співбесіди, що вже відбулася: щоб подякувати саме за неї.',
      },
      {
        id: 'followup.senderName',
        text: 'Твоє імʼя з профілю: для підпису. Без нього лист буде без підпису.',
      },
      {
        id: 'followup.language',
        text: 'Мова листа: українська чи англійська, за мовою вакансії або твоїм вибором.',
      },
      { id: 'followup.tone', text: 'Тон, який ти обрав: нейтральний, теплий чи короткий.' },
      {
        id: 'followup.hint',
        text: 'Підказка з поля «Що згадати», якщо ти її написав. Нотатки в модель не йдуть.',
      },
    ]);
  });
});
