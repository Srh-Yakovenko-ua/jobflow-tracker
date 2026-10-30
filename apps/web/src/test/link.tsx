import type { ComponentProps } from 'react';

import { push } from './navigation';

export type FakeLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href: string;
  scroll?: boolean;
  prefetch?: boolean | null;
};

export default function Link({ href, scroll, prefetch, onClick, ...anchor }: FakeLinkProps) {
  return (
    <a
      {...anchor}
      href={href}
      data-scroll={String(scroll ?? true)}
      data-prefetch={String(prefetch ?? 'auto')}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
        push(href);
      }}
    />
  );
}
