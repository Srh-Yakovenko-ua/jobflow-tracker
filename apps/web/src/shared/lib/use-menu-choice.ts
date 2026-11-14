import { useRef } from 'react';

export function useMenuChoice(afterChoice: (() => void) | undefined) {
  const chosenRef = useRef(false);
  return {
    choose: () => {
      chosenRef.current = true;
    },
    onCloseAutoFocus: (event: Event) => {
      if (!chosenRef.current || afterChoice === undefined) return;
      chosenRef.current = false;
      event.preventDefault();
      afterChoice();
    },
  };
}
