import { buildDesignOffers, buildOfferList } from '@jobflow/shared/testing';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { applicationRoute } from '@/test/application-fixtures';
import { pagedListRoute } from '@/test/list-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useOffers } from './use-offers';

const MISSING = () => errorReply({ status: 404, type: 'not_found' });

function renderOffers() {
  const [trident, northwind, lumen] = buildDesignOffers(3);
  if (!trident || !northwind || !lumen) throw new Error('the design offers lost an offer');
  const list = pagedListRoute({
    items: buildOfferList([trident, northwind, { ...lumen, isDraft: true }]).items,
  });
  const failing = applicationRoute({ application: northwind, reply: MISSING });
  const reads = [trident, lumen].map((application) => applicationRoute({ application }));
  server.use(list.handler, failing.handler, ...reads.map(({ handler }) => handler));
  const { result } = renderHookInApp(() => useOffers());
  return { result, list, failing, northwind, reads };
}

describe('useOffers', () => {
  it('reads up to 100 active offers by last event, skips a draft, and a failed offer read shows the error until a retry reads it', async () => {
    const { result, list, failing, northwind, reads } = renderOffers();

    await waitFor(() => {
      expect(result.current.kind).toBe('error');
    });
    expect(list.sent).toEqual(['stage=offer&limit=100&sort=-lastEventAt']);
    expect(failing.sent).toEqual([northwind.id]);
    server.use(applicationRoute({ application: northwind }).handler);
    act(() => {
      if (result.current.kind === 'error') result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.kind).toBe('ready');
    });
    const offers = result.current.kind === 'ready' ? result.current.offers : [];
    expect(offers.map(({ company, workMode, location }) => [company, workMode, location])).toEqual([
      ['Trident Systems', 'remote', 'Kyiv'],
      ['Northwind Labs', 'office', 'Lviv'],
    ]);
    expect(reads.map(({ sent }) => sent.length)).toEqual([1, 0]);
  });
});
