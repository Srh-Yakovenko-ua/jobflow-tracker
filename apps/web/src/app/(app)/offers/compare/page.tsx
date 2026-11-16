import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { OfferComparison } from '@/widgets/offer-comparison';

export const metadata: Metadata = { title: uk.offerCompare.title };

export default function OfferCompareRoute() {
  return <OfferComparison view={{ mode: 'screen' }} />;
}
