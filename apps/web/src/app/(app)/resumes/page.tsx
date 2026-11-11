import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';
import { ResumesPage } from '@/widgets/resumes-page';

export const metadata: Metadata = { title: uk.resumes.title };

export default function ResumesRoute() {
  return <ResumesPage />;
}
