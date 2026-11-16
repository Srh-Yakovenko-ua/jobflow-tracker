import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { OfferComparison } from '@/widgets/offer-comparison';

export const metadata: Metadata = { title: uk.offerCompare.printTitle };

export default function OfferComparePrintRoute() {
  return <OfferComparison view={{ mode: 'print' }} />;
}
