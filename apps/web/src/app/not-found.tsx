import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui/empty-state';

const COPY = uk.states.notFound;

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col px-5 py-13 sm:px-7">
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
    </main>
  );
}
