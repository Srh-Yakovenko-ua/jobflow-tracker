import { type ApplicationSearch, useApplicationSearch } from '@/features/search-applications';
import { swapLayout } from '@/shared/lib/keyboard-layout';

export function usePaletteSearch(text: string): ApplicationSearch {
  const typed = useApplicationSearch(text);
  const typedEmpty = typed.isSuccess && typed.data.items.length === 0;
  const swapped = useApplicationSearch(typedEmpty ? swapLayout(text) : '');
  return typedEmpty ? swapped : typed;
}
