import { describe, expect, it, vi } from 'vitest';

import { sectionLoadOf, type SectionQuery } from './section-load';

const SETTLED: SectionQuery = {
  data: undefined,
  isError: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch: vi.fn(),
};

const LOADED: SectionQuery = { ...SETTLED, data: { items: [] } };

const ASKED_AGAIN: SectionQuery = { ...SETTLED, isFetching: true, errorUpdateCount: 1 };

describe('sectionLoadOf', () => {
  it('a section waiting for its first answer is pending', () => {
    expect(sectionLoadOf({ ...SETTLED, isFetching: true })).toMatchObject({
      pending: true,
      failed: false,
      stale: false,
      retrying: false,
    });
  });

  it('a failed section asked again stays failed with its retry running', () => {
    expect(sectionLoadOf(ASKED_AGAIN)).toMatchObject({
      pending: false,
      failed: true,
      stale: false,
      retrying: true,
    });
  });

  it('a failed refetch over shown data is stale, not failed', () => {
    expect(sectionLoadOf({ ...LOADED, isError: true })).toMatchObject({
      pending: false,
      failed: false,
      stale: true,
      retrying: false,
    });
  });

  it('a stale section asked again keeps its data with its retry running', () => {
    expect(sectionLoadOf({ ...LOADED, isError: true, isFetching: true })).toMatchObject({
      failed: false,
      stale: true,
      retrying: true,
    });
  });

  it('a background refetch long after an old failure is no retry', () => {
    expect(sectionLoadOf({ ...LOADED, isFetching: true, errorUpdateCount: 1 })).toMatchObject({
      pending: false,
      failed: false,
      stale: false,
      retrying: false,
    });
  });

  it('one failed query fails the whole section and the others stop pending', () => {
    expect(sectionLoadOf(LOADED, { ...SETTLED, isError: true })).toMatchObject({
      pending: false,
      failed: true,
    });
  });

  it('a retry asks every query of the section again', () => {
    const failing = vi.fn();
    const healthy = vi.fn();

    sectionLoadOf(
      { ...SETTLED, isError: true, refetch: failing },
      { ...LOADED, refetch: healthy },
    ).onRetry();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
