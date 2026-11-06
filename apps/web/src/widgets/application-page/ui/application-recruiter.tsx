import type { ApplicationResponse } from '@jobflow/shared';
import { Pencil } from 'lucide-react';
import { useId, useRef } from 'react';

import { AddContactForm, ContactEditForm } from '@/features/save-contact';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { IconAction } from '@/shared/ui/icon-action';
import { Reveal } from '@/shared/ui/reveal';
import { TextSkeleton } from '@/shared/ui/skeleton';
import { STATE_TEXT } from '@/shared/ui/state-text';

import {
  type ApplicationRecruiter as Recruiter,
  useApplicationRecruiter,
} from '../model/use-application-recruiter';
import { RecruiterDetails } from './recruiter-details';

export type ApplicationRecruiterProps = Readonly<{ application: ApplicationResponse }>;

type RecruiterBodyProps = Readonly<{
  application: ApplicationResponse;
  recruiter: Recruiter;
  actions: { onClose: () => void; onAdded: () => void };
}>;

const COPY = uk.contact;

function RecruiterBody({ application, recruiter, actions }: RecruiterBodyProps) {
  const { load, contact, editing } = recruiter;
  if (load.pending) return <TextSkeleton />;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  if (contact === null) {
    return (
      <AddContactForm
        application={application}
        suggestions={recruiter.suggestions}
        actions={{ onDone: actions.onAdded }}
      />
    );
  }
  return (
    <div className="animate-fade-in">
      <Reveal shown={!editing}>
        <RecruiterDetails contact={contact} application={application} />
      </Reveal>
      <Reveal shown={editing}>
        <ContactEditForm
          contact={contact}
          actions={{ onDone: actions.onClose, onCancel: actions.onClose }}
        />
      </Reveal>
    </div>
  );
}

export function ApplicationRecruiter({ application }: ApplicationRecruiterProps) {
  const recruiter = useApplicationRecruiter(application);
  const headingId = useId();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const focusEdit = () => {
    editButtonRef.current?.focus();
  };
  const bodyActions = {
    onClose: () => {
      recruiter.actions.onClose();
      focusEdit();
    },
    onAdded: () => {
      recruiter.actions.onAdded();
      focusEdit();
    },
  };
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={recruiter.load.pending || undefined}
      className="flex flex-col gap-3.5 rounded-lg bg-surface p-4.5 shadow-e1"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>
          {COPY.kicker}
        </h2>
        {recruiter.contact !== null && (
          <IconAction
            ref={editButtonRef}
            autoFocus={recruiter.focusEditOnMount}
            label={COPY.edit}
            icon={Pencil}
            aria-expanded={recruiter.editing}
            onClick={recruiter.actions.onToggleEdit}
            className="-my-1.5"
          />
        )}
      </div>
      <RecruiterBody application={application} recruiter={recruiter} actions={bodyActions} />
    </section>
  );
}
