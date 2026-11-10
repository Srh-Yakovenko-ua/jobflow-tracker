import { uk } from '@/shared/i18n';

import { CARD_FRAME } from './card-frame';

export function ReviewMark() {
  return (
    <span className={CARD_FRAME.eyebrow}>
      <span aria-hidden className={CARD_FRAME.dot} />
      {uk.application.parsing.review}
    </span>
  );
}
