import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { apiErrorOf } from '@/test/api-handlers';

import { undoErrorMessage } from './undo-error-toast';

describe('undoErrorMessage', () => {
  it('a 409 conflict says the undo window has passed', () => {
    expect(undoErrorMessage(apiErrorOf({ status: 409, type: 'conflict' }))).toEqual({
      title: 'Час на скасування минув',
      description: 'Карточка лишилася у «відмова».',
    });
  });

  it.each([
    { name: 'a refused connection', error: new TypeError('Failed to fetch') },
    {
      name: 'a 409 illegal_transition',
      error: apiErrorOf({ status: 409, type: 'illegal_transition' }),
    },
    { name: 'a 500', error: apiErrorOf({ status: 500, type: 'internal_error' }) },
  ])('$name gives the generic failed copy', ({ error }) => {
    expect(undoErrorMessage(error)).toEqual(uk.board.move.failed);
  });
});
