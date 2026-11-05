import { Fragment } from 'react';

import { uk } from '@/shared/i18n';
import { Kbd } from '@/shared/ui/kbd';

const COPY = uk.board.move.keyboardHint;

const LAST_KEY = COPY.keys.length - 1;

export function KeyboardHint() {
  return (
    <p
      aria-hidden
      className="mt-2.5 flex items-start gap-2.5 rounded-lg bg-accent-tint px-3 py-2.75 text-[12px] leading-normal text-accent-ink max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(var(--spacing)*18_+_env(safe-area-inset-bottom))] max-md:z-30 max-md:shadow-e2"
    >
      <Kbd className="flex-none px-1.5 py-0.75 leading-normal text-accent-ink inset-ring-accent/20">
        {COPY.chip}
      </Kbd>
      <span>
        {COPY.picked}
        {COPY.keys.map(({ key, action }, index) => (
          <Fragment key={key}>
            {' '}
            <span className="font-semibold">{key}</span> {action}
            {index === LAST_KEY ? '.' : ','}
          </Fragment>
        ))}
      </span>
    </p>
  );
}
