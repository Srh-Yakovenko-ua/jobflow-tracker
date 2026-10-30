import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { KanbanBoard } from '@/widgets/kanban-board';

export const metadata: Metadata = { title: uk.board.title };

export default function BoardPage() {
  return <KanbanBoard />;
}
