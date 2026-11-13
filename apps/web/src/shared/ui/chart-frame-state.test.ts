import { describe, expect, it, vi } from 'vitest';

import { chartFrameStateOf, type FrameQuery } from './chart-frame-state';

const SETTLED: FrameQuery = {
  data: undefined,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};

const NEED_MORE = { status: 'insufficient_data', have: 4, need: 11, message: 'Ще 11 відгуків' };

describe('chartFrameStateOf', () => {
  it('a query still waiting for its first answer is loading', () => {
    expect(chartFrameStateOf({ ...SETTLED, isFetching: true })).toEqual({ status: 'loading' });
  });

  it('a failed query offers a retry that asks again', () => {
    const refetch = vi.fn();
    const state = chartFrameStateOf({ ...SETTLED, isError: true, refetch });
    if (state.status !== 'failed') throw new Error(`expected failed, got ${state.status}`);

    state.onRetry();

    expect(state.retrying).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('a failed query asked again stays failed with its retry spinning', () => {
    const state = chartFrameStateOf({ ...SETTLED, isError: true, isFetching: true });

    expect(state).toMatchObject({ status: 'failed', retrying: true });
  });

  it('an answer below the threshold says how many records are missing', () => {
    expect(chartFrameStateOf({ ...SETTLED, data: NEED_MORE })).toEqual(NEED_MORE);
  });

  it('any other answer is ready, even when a later refetch failed', () => {
    expect(chartFrameStateOf({ ...SETTLED, data: { stages: [] }, isError: true })).toEqual({
      status: 'ready',
    });
  });
});
