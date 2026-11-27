'use client';

import { uk } from '@/shared/i18n';
import { DisclosureButton, useDisclosure } from '@/shared/ui/disclosure';

const COPY = uk.bookmarklet.privacy;

const NOTES = Object.entries(COPY.notes);

export function PrivacyNotes() {
  const disclosure = useDisclosure();
  return (
    <section aria-label={COPY.label} className="flex flex-col items-start gap-1.5">
      <p className="text-[13px] leading-[1.5] text-ink-2">{COPY.summary}</p>
      <DisclosureButton disclosure={disclosure} labels={COPY.more} />
      <div id={disclosure.regionId} className="self-stretch">
        {disclosure.shown && (
          <ul className="flex animate-fade-in list-disc flex-col gap-1.5 ps-5 text-[13px] leading-[1.5] text-ink-2">
            {NOTES.map(([id, text]) => (
              <li key={id}>{text}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
