import { ApplicationSheet } from './application-sheet';

export async function ApplicationSheetRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationSheet id={id} />;
}

export async function TableApplicationSheetRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationSheet id={id} origin="table" />;
}

export async function CalendarApplicationSheetRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationSheet id={id} origin="calendar" />;
}
