import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { SearchHistory } from '@/widgets/search-history';

export const metadata: Metadata = { title: uk.searches.history.title };

export default function SearchHistoryRoute() {
  return <SearchHistory />;
}
