import { useRef } from 'react';

import { focusPageHeading } from './page-heading';

export function useOpenerFocus() {
  const openerRef = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const opener = openerRef.current;
      if (opener?.isConnected === true) opener.focus();
      else focusPageHeading();
    },
  };
}
