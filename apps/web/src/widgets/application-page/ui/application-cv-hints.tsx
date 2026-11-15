import { CvHintsPanel } from '@/features/suggest-cv-hints';
import { uk } from '@/shared/i18n';

import {
  type ApplicationCvHintsInput,
  useApplicationCvHints,
} from '../model/use-application-cv-hints';
import { AiPageSection } from './ai-page-section';

export type ApplicationCvHintsProps = ApplicationCvHintsInput;

export function ApplicationCvHints({ application, match }: ApplicationCvHintsProps) {
  const hints = useApplicationCvHints({ application, match });
  return (
    <AiPageSection title={uk.cvHints.title} section={hints}>
      {(ready) => <CvHintsPanel application={application} hints={ready} />}
    </AiPageSection>
  );
}
