import { NotFoundState } from '@/shared/ui/not-found-state';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col px-5 py-13 sm:px-7">
      <NotFoundState />
    </main>
  );
}
