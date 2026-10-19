import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.board.title };

export default function BoardPage() {
  return <h1 className="font-display text-display">{uk.board.title}</h1>;
}
