import { ApplicationSheet } from '@/widgets/application-page';

export default async function ApplicationSheetRoute({ params }: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationSheet id={id} />;
}
