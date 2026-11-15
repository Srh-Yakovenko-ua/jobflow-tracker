import type { ReactNode } from 'react';

import type { AiSection, AiSectionReady } from '../model/ai-poll';
import { AiSectionBody } from './ai-section-body';
import { ApplicationSection } from './application-section';

export type AiPageSectionProps<Data> = Readonly<{
  title: string;
  section: AiSection<Data>;
  children: (ready: AiSectionReady<Data>) => ReactNode;
}>;

export function AiPageSection<Data>({ title, section, children }: AiPageSectionProps<Data>) {
  if (!section.shown) return null;
  return (
    <ApplicationSection
      title={{ text: title, look: 'eyebrow' }}
      view={{
        className:
          'flex animate-fade-in flex-col gap-4 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: section.load.pending,
      }}
    >
      <AiSectionBody section={section}>{children}</AiSectionBody>
    </ApplicationSection>
  );
}
