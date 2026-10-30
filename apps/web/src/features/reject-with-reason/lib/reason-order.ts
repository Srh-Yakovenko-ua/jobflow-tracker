import {
  REJECTION_REASON_CODES,
  REJECTION_REASONS,
  REJECTION_SIDES,
  type RejectionReasonCode,
  type RejectionSide,
} from '@jobflow/shared';

export type PickedSide = Exclude<RejectionSide, 'system'>;

export const PICKED_SIDES: readonly PickedSide[] = REJECTION_SIDES.filter(
  (side): side is PickedSide => side !== 'system',
);

const PICK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function reasonsOf(side: PickedSide): RejectionReasonCode[] {
  return REJECTION_REASON_CODES.filter((code) => REJECTION_REASONS[code].side === side).sort(
    (left, right) => REJECTION_REASONS[left].sortOrder - REJECTION_REASONS[right].sortOrder,
  );
}

const PICKABLE_REASONS = PICKED_SIDES.flatMap(reasonsOf);

export function keyForReason(code: RejectionReasonCode): string | undefined {
  return PICK_KEYS[PICKABLE_REASONS.indexOf(code)];
}

export function reasonForKey(key: string): RejectionReasonCode | undefined {
  return PICKABLE_REASONS[PICK_KEYS.indexOf(key)];
}
