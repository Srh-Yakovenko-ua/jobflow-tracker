import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { contactsQueryOptions } from '@/entities/contact';

import { sectionLoadOf } from './section-load';

export function useApplicationRecruiter(application: ApplicationResponse) {
  const contacts = useQuery(contactsQueryOptions(application.id));
  const [editing, setEditing] = useState(false);
  const [added, setAdded] = useState(false);
  return {
    contact: contacts.data?.items[0] ?? null,
    suggestions: contacts.data?.suggestions ?? [],
    load: sectionLoadOf(contacts),
    editing,
    focusEditOnMount: added,
    actions: {
      onToggleEdit: () => {
        setEditing((open) => !open);
      },
      onClose: () => {
        setEditing(false);
      },
      onAdded: () => {
        setAdded(true);
      },
    },
  };
}

export type ApplicationRecruiter = ReturnType<typeof useApplicationRecruiter>;
