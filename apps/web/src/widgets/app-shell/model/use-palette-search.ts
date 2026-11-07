import { type ApplicationSearch, useApplicationSearch } from '@/features/search-applications';
import { swapLayout } from '@/shared/lib/keyboard-layout';

export function usePaletteSearch(text: string): ApplicationSearch {
  const typed = useApplicationSearch(text);
  const nothingFound = typed.isSuccess && !typed.isPlaceholderData && typed.data.items.length === 0;
  const swapped = useApplicationSearch(nothingFound ? swapLayout(text) : '');
  return nothingFound ? swapped : typed;
}
