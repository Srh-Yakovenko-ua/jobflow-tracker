import type { Metadata } from 'next';

import { ImportWizard } from '@/features/import-applications';
import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.dataImport.title };

export default function ImportRoute() {
  return <ImportWizard />;
}
