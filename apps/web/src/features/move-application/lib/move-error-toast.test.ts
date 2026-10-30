import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { apiErrorOf } from '@/test/api-handlers';

import { moveErrorMessage } from './move-error-toast';

const MOVE = { from: 'applied', to: 'offer' } as const;

const WENT_BACK = uk.board.move.failed;

describe('moveErrorMessage', () => {
  it('a 409 conflict says the card changed its stage elsewhere', () => {
    const error = apiErrorOf({ status: 409, type: 'conflict' });

    expect(moveErrorMessage({ error, move: MOVE })).toEqual(uk.board.move.conflict);
  });

  it('a 409 illegal_transition names both stages in Ukrainian', () => {
    const error = apiErrorOf({ status: 409, type: 'illegal_transition' });

    expect(moveErrorMessage({ error, move: MOVE })).toEqual({
      title: 'Такий перехід неможливий',
      description: 'З «відгук» карточка не переходить у «офер». Вона повернулася на місце.',
    });
  });

  it.each([
    { name: 'a refused connection', error: new TypeError('Failed to fetch') },
    {
      name: 'the 15 s timeout',
      error: new DOMException('Request timed out', 'TimeoutError'),
    },
    { name: 'a 422', error: apiErrorOf({ status: 422, type: 'validation_failed' }) },
    { name: 'a 500', error: apiErrorOf({ status: 500, type: 'internal_error' }) },
  ])('$name says the card went back to its place', ({ error }) => {
    expect(moveErrorMessage({ error, move: MOVE })).toEqual(WENT_BACK);
  });
});
