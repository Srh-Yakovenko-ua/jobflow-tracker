import { ApplicationSheet } from './application-sheet';

export async function ApplicationSheetRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationSheet id={id} />;
}
