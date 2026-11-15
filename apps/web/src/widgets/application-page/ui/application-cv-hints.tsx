import { CvHintsPanel } from '@/features/suggest-cv-hints';
import { uk } from '@/shared/i18n';

import {
  type ApplicationCvHintsInput,
  useApplicationCvHints,
} from '../model/use-application-cv-hints';
import { AiSectionBody } from './ai-section-body';
import { ApplicationSection } from './application-section';

export type ApplicationCvHintsProps = ApplicationCvHintsInput;

export function ApplicationCvHints({ application, match }: ApplicationCvHintsProps) {
  const hints = useApplicationCvHints({ application, match });
  if (!hints.shown) return null;
  return (
    <ApplicationSection
      title={{ text: uk.cvHints.title, look: 'eyebrow' }}
      view={{
        className:
          'flex animate-fade-in flex-col gap-4 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: hints.load.pending,
      }}
    >
      <AiSectionBody section={hints}>
        {(ready) => <CvHintsPanel application={application} hints={ready} />}
      </AiSectionBody>
    </ApplicationSection>
  );
}
