import type { ApplicationResponse } from '@jobflow/shared';
import { buildDesignOffers, buildOfferList, type DesignOfferCount } from '@jobflow/shared/testing';
import type { Page } from '@playwright/test';

import { apiUrl } from './stack';

const OFFER_LIST = apiUrl('/applications?');

export async function routeDesignOffers(
  page: Page,
  count: DesignOfferCount,
): Promise<ApplicationResponse[]> {
  const offers = buildDesignOffers(count);
  await page.route(
    (url) => url.href.startsWith(OFFER_LIST) && url.searchParams.get('stage') === 'offer',
    (route) => route.fulfill({ json: buildOfferList(offers) }),
  );
  for (const offer of offers) {
    await page.route(apiUrl(`/applications/${offer.id}`), (route) =>
      route.fulfill({ json: offer }),
    );
  }
  return offers;
}
