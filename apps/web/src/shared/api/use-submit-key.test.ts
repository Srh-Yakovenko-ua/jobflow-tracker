import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSubmitKey } from './use-submit-key';

const NOTE = { body: 'Попросили live coding 3' };

function renderSubmitKey() {
  return renderHook(() => useSubmitKey()).result;
}

describe('useSubmitKey', () => {
  it('a resubmit of the same body keeps the key of the first submit', () => {
    const submitKey = renderSubmitKey();

    const first = submitKey.current.keyFor(NOTE);

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(submitKey.current.keyFor({ ...NOTE })).toBe(first);
  });

  it('a submit with a changed body gets a new key', () => {
    const submitKey = renderSubmitKey();

    const first = submitKey.current.keyFor(NOTE);

    expect(submitKey.current.keyFor({ body: 'Попросили live coding 4' })).not.toBe(first);
  });

  it('after a reset the same body gets a new key', () => {
    const submitKey = renderSubmitKey();
    const first = submitKey.current.keyFor(NOTE);

    submitKey.current.reset();

    expect(submitKey.current.keyFor(NOTE)).not.toBe(first);
  });
});
