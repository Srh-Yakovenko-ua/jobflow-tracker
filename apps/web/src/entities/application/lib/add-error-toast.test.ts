import { describe, expect, it } from 'vitest';

import { HTTP_STATUS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { apiErrorOf, STILL_RUNNING } from '@/test/api-handlers';

import { addErrorToastOf } from './add-error-toast';

const COPY = uk.add.errors;

const toastOf = addErrorToastOf('requestLimit');

describe('addErrorToastOf', () => {
  it('a first attempt still running asks to wait, not to start a search', () => {
    expect(toastOf(apiErrorOf(STILL_RUNNING))).toEqual(COPY.stillRunning);
  });

  it('any other 409 says no search is active', () => {
    expect(toastOf(apiErrorOf({ status: HTTP_STATUS.conflict, type: 'no_active_search' }))).toEqual(
      COPY.noActiveSearch,
    );
  });

  it('a 429 names the limit and says to try later', () => {
    expect(
      toastOf(apiErrorOf({ status: HTTP_STATUS.tooManyRequests, type: 'rate_limited' })),
    ).toEqual({
      title: COPY.requestLimit.title,
      description: COPY.requestLimit.later,
    });
  });

  it('a network failure falls back to save failed', () => {
    expect(toastOf(new TypeError('Failed to fetch'))).toEqual(uk.errors.saveFailed);
  });
});
