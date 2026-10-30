import Link from 'next/link';

import { uk } from '@/shared/i18n';

import { EmptyState } from './empty-state';

const COPY = uk.states.notFound;

export function NotFoundState() {
  return (
    <>
      <h1 className="sr-only">{COPY.pageTitle}</h1>
      <EmptyState
        content={{ eyebrow: COPY.eyebrow, title: COPY.title, hint: COPY.hint }}
        view={{ size: 'page' }}
        slots={{
          action: (
            <Link
              href="/board"
              className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
            >
              {COPY.action}
            </Link>
          ),
        }}
      />
    </>
  );
}
