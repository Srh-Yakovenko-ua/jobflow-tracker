import { AUTH_ROUTES } from '@jobflow/shared';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { applicationFiltersOf } from '@/features/filter-applications';
import { uk } from '@/shared/i18n';
import { BOARD_DENSITY_COOKIE, boardDensityFromCookie, KanbanBoard } from '@/widgets/kanban-board';

export const metadata: Metadata = { title: uk.board.title };

export default async function BoardPage({ searchParams }: PageProps<typeof AUTH_ROUTES.home>) {
  const value = (await cookies()).get(BOARD_DENSITY_COOKIE)?.value;
  const filters = applicationFiltersOf(await searchParams);
  return <KanbanBoard initial={{ ...boardDensityFromCookie(value), filters }} />;
}
