import { uk } from '@/shared/i18n';

const COPY = uk.bookmarklet.privacy;

const NOTES = Object.entries(COPY.notes);

export function PrivacyNotes() {
  return (
    <ul
      aria-label={COPY.label}
      className="flex list-disc flex-col gap-1.5 ps-5 text-[13px] leading-[1.5] text-ink-2"
    >
      {NOTES.map(([id, text]) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}
