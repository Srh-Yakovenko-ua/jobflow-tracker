import type { ApplicationResponse } from '@jobflow/shared';

import { NoteMarkdown } from '@/entities/note';
import { NoteEditor } from '@/features/write-note';
import { uk } from '@/shared/i18n';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';

import { type ApplicationNotesState, useApplicationNotes } from '../model/use-application-notes';
import { ApplicationSection } from './application-section';
import { NotesPrivacy } from './notes-privacy';

export type ApplicationNotesProps = Readonly<{ application: ApplicationResponse }>;

type NoteListProps = Readonly<{ notes: ApplicationNotesState }>;

const COPY = uk.applicationPage.notes;

function NoteList({ notes }: NoteListProps) {
  const { load, entries } = notes;
  if (load.pending) return <TextSkeleton />;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  if (entries.length === 0) return null;
  return (
    <ul className="flex animate-fade-in flex-col gap-3">
      {entries.map(({ note, context }) => (
        <li key={note.id} className="flex flex-col gap-1.5 rounded-lg bg-surface p-3.5 shadow-e1">
          <span className="text-[10px] leading-[1.3] font-semibold text-ink-3 tabular-nums">
            {context}
          </span>
          <NoteMarkdown note={note} />
        </li>
      ))}
    </ul>
  );
}

export function ApplicationNotes({ application }: ApplicationNotesProps) {
  const notes = useApplicationNotes(application);
  return (
    <ApplicationSection
      title={{ text: COPY.kicker, look: 'eyebrow' }}
      header={{ after: <NotesPrivacy />, className: 'flex items-center gap-1' }}
      view={{
        className: 'flex flex-col gap-4 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: notes.load.pending,
      }}
    >
      <div className="flex flex-col gap-3">
        <NoteList notes={notes} />
        <NoteEditor application={application} actions={{ onDraftChange: notes.onDraftChange }} />
      </div>
    </ApplicationSection>
  );
}
